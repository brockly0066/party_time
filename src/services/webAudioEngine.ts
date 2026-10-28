export interface ActiveTrack {
  id: string;
  title: string;
  artist: string;
  duration: number; // in seconds
  url?: string;
  isCustom?: boolean;
}

export const DEFAULT_TRACK: ActiveTrack = {
  id: 'one-sun-one-moon',
  title: 'One Sun One Moon',
  artist: 'Jailer · Anirudh Ravichander',
  duration: 219, // ~3 min 39 sec
  url: '/assets/aistudio/One_Sun_One_Moon_Jailer_2_128_Kbps_12882caf.mp3',
};

export class WebAudioEngine {
  private ctx: AudioContext | null = null;
  private currentBuffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private analyserNode: AnalyserNode | null = null;

  private currentVolume: number = 1.0;
  private isPlaying: boolean = false;
  private startTimeContext: number = 0;
  private startOffsetSec: number = 0;
  private scheduledTimer: ReturnType<typeof setTimeout> | null = null;
  private currentTrack: ActiveTrack = DEFAULT_TRACK;
  private trackCache: Map<string, AudioBuffer> = new Map();

  constructor() {}

  public getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.initNodes();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private initNodes() {
    if (!this.ctx) return;
    const ctx = this.ctx;

    this.gainNode = ctx.createGain();
    this.gainNode.gain.setValueAtTime(this.currentVolume, ctx.currentTime);

    // Dynamic compressor for party loudness without speaker distortion/clipping
    this.compressorNode = ctx.createDynamicsCompressor();
    this.compressorNode.threshold.setValueAtTime(-10, ctx.currentTime);
    this.compressorNode.knee.setValueAtTime(25, ctx.currentTime);
    this.compressorNode.ratio.setValueAtTime(4, ctx.currentTime);
    this.compressorNode.attack.setValueAtTime(0.003, ctx.currentTime);
    this.compressorNode.release.setValueAtTime(0.2, ctx.currentTime);

    this.analyserNode = ctx.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.8;

    // Direct clean stereo routing: gain -> compressor -> analyser -> speakers
    this.gainNode.connect(this.compressorNode);
    this.compressorNode.connect(this.analyserNode);
    this.analyserNode.connect(ctx.destination);
  }

  public setVolume(volume: number) {
    this.currentVolume = Math.max(0, Math.min(2.0, volume));
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setTargetAtTime(this.currentVolume, this.ctx.currentTime, 0.05);
    }
  }

  public getVolume(): number {
    return this.currentVolume;
  }

  public setMaxVolume() {
    this.setVolume(2.0); // Boost to 200% with compressor limiter active
  }

  /**
   * Loads an audio file from a direct URL (like user's uploaded MP3).
   * Ensures previous buffers are unloaded so ONLY this song plays.
   */
  public async loadAudioUrl(url: string, title?: string, artist?: string): Promise<AudioBuffer> {
    const ctx = this.getContext();
    this.stopLocalNode();

    if (this.trackCache.has(url)) {
      this.currentBuffer = this.trackCache.get(url)!;
      this.currentTrack = {
        id: url,
        title: title || 'One Sun One Moon',
        artist: artist || 'Jailer',
        duration: this.currentBuffer.duration,
        url,
      };
      return this.currentBuffer;
    }

    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);

    this.trackCache.set(url, decodedBuffer);
    this.currentBuffer = decodedBuffer;
    this.currentTrack = {
      id: url,
      title: title || 'One Sun One Moon',
      artist: artist || 'Jailer',
      duration: decodedBuffer.duration,
      url,
    };

    return decodedBuffer;
  }

  /**
   * Loads a custom audio file picked by the user from phone storage.
   * Completely replaces current song so ONLY this song plays.
   */
  public async loadCustomAudioFile(file: File): Promise<AudioBuffer> {
    const ctx = this.getContext();
    this.stopLocalNode();

    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const trackId = `file-${file.name}-${Date.now()}`;

    this.trackCache.set(trackId, audioBuffer);
    this.currentBuffer = audioBuffer;
    this.currentTrack = {
      id: trackId,
      title: file.name.replace(/\.[^/.]+$/, ''), // Clean file name without extension
      artist: 'Local Phone Storage',
      duration: audioBuffer.duration,
      isCustom: true,
    };

    return audioBuffer;
  }

  public getCurrentTrack(): ActiveTrack {
    return this.currentTrack;
  }

  public getTrackDuration(): number {
    return this.currentBuffer ? this.currentBuffer.duration : this.currentTrack.duration;
  }

  /**
   * Schedule playback for synchronized multi-device launch.
   * @param targetLocalEpochMs Local wall-clock epoch timestamp when playback should start.
   * @param seekOffsetMs Audio position offset in milliseconds.
   */
  public schedulePlay(targetLocalEpochMs: number, seekOffsetMs: number = 0) {
    const ctx = this.getContext();
    if (!this.currentBuffer) return;

    if (this.scheduledTimer) {
      clearTimeout(this.scheduledTimer);
      this.scheduledTimer = null;
    }

    this.stopLocalNode();

    const nowEpoch = Date.now();
    const delayMs = targetLocalEpochMs - nowEpoch;
    const seekSec = seekOffsetMs / 1000;
    const duration = this.currentBuffer.duration;
    const safeSeekSec = duration > 0 ? seekSec % duration : 0;

    if (delayMs > 0) {
      const waitContextSec = delayMs / 1000;
      const startAtContext = ctx.currentTime + waitContextSec;
      this.createAndStartSourceNode(startAtContext, safeSeekSec);
      this.isPlaying = true;
      this.startTimeContext = startAtContext;
      this.startOffsetSec = safeSeekSec;
    } else {
      const missedSec = Math.abs(delayMs) / 1000;
      const adjustedSeekSec = duration > 0 ? (safeSeekSec + missedSec) % duration : 0;
      this.createAndStartSourceNode(ctx.currentTime, adjustedSeekSec);
      this.isPlaying = true;
      this.startTimeContext = ctx.currentTime;
      this.startOffsetSec = adjustedSeekSec;
    }
  }

  private createAndStartSourceNode(whenContextTime: number, offsetSec: number) {
    if (!this.ctx || !this.currentBuffer || !this.gainNode) return;
    const ctx = this.ctx;

    this.stopLocalNode();

    this.sourceNode = ctx.createBufferSource();
    this.sourceNode.buffer = this.currentBuffer;
    this.sourceNode.loop = true;

    // Connect source directly to gain node (pure unaltered stereo)
    this.sourceNode.connect(this.gainNode);
    this.sourceNode.start(whenContextTime, offsetSec);
  }

  public pause() {
    if (this.scheduledTimer) {
      clearTimeout(this.scheduledTimer);
      this.scheduledTimer = null;
    }
    this.stopLocalNode();
    this.isPlaying = false;
  }

  public seek(positionSec: number) {
    if (!this.currentBuffer) return;
    const safeSec = Math.max(0, Math.min(this.currentBuffer.duration, positionSec));
    if (this.isPlaying) {
      const ctx = this.getContext();
      this.stopLocalNode();
      this.createAndStartSourceNode(ctx.currentTime, safeSec);
      this.startTimeContext = ctx.currentTime;
      this.startOffsetSec = safeSec;
    } else {
      this.startOffsetSec = safeSec;
    }
  }

  private stopLocalNode() {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch {}
      this.sourceNode = null;
    }
  }

  public handleSyncDrift(expectedPositionMs: number) {
    if (!this.isPlaying || !this.currentBuffer) return;
    const currentPosMs = this.getCurrentPositionMs();
    const diffMs = currentPosMs - expectedPositionMs;

    if (Math.abs(diffMs) > 35) {
      const ctx = this.getContext();
      const safeSeekSec = (expectedPositionMs / 1000) % this.currentBuffer.duration;
      this.stopLocalNode();
      this.createAndStartSourceNode(ctx.currentTime, safeSeekSec);
      this.startTimeContext = ctx.currentTime;
      this.startOffsetSec = safeSeekSec;
    }
  }

  public getCurrentPositionMs(): number {
    if (!this.isPlaying || !this.ctx || !this.currentBuffer) return this.startOffsetSec * 1000;
    const elapsedSec = this.ctx.currentTime - this.startTimeContext;
    if (elapsedSec < 0) return this.startOffsetSec * 1000;
    const posSec = (this.startOffsetSec + elapsedSec) % this.currentBuffer.duration;
    return Math.max(0, Math.round(posSec * 1000));
  }

  public getAnalyserData(freqArray: Uint8Array<ArrayBuffer> | any, timeArray: Uint8Array<ArrayBuffer> | any) {
    if (this.analyserNode) {
      this.analyserNode.getByteFrequencyData(freqArray);
      this.analyserNode.getByteTimeDomainData(timeArray);
    }
  }

  public getPlaying(): boolean {
    return this.isPlaying;
  }

  public playTestBeep(whenContextTime?: number) {
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, (whenContextTime || ctx.currentTime) + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    const start = whenContextTime || ctx.currentTime;
    osc.start(start);
    osc.stop(start + 0.25);
  }

  public destroy() {
    this.pause();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
