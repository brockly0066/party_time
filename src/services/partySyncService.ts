import { AudioStats, PartyMessage, PartyPeer, PlaybackStatus, SongRequest } from '../types/party';
import { WebAudioEngine } from './webAudioEngine';

export interface SyncEventListener {
  onPeersUpdated?: (peers: PartyPeer[]) => void;
  onStatusChange?: (status: PlaybackStatus) => void;
  onTrackChanged?: (trackId: string, trackTitle?: string, trackUrl?: string) => void;
  onStatsUpdated?: (stats: AudioStats) => void;
  onLogMessage?: (msg: string) => void;
  onStrobeBeat?: () => void;
  onSongRequestReceived?: (request: SongRequest) => void;
  onSongRequestApproved?: (requestId: string, songTitle: string) => void;
  onSongRequestDeclined?: (requestId: string) => void;
  onAdminChanged?: (newAdminId: string, isAdmin: boolean) => void;
}

export class PartySyncService {
  private roomId: string = '';
  private deviceId: string = '';
  private deviceName: string = '';
  private isHost: boolean = false;
  private currentAdminId: string = '';
  private broadcastChannel: BroadcastChannel | null = null;
  private eventSource: EventSource | null = null;
  private audioEngine: WebAudioEngine;

  private peers: Map<string, PartyPeer> = new Map();
  private pendingRequests: Map<string, SongRequest> = new Map();
  private listeners: SyncEventListener = {};

  // NTP Clock Sync state
  private clockOffsetMs: number = 0;
  private bestRttMs: number = Infinity;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private syncInterval: ReturnType<typeof setInterval> | null = null;

  private currentStatus: PlaybackStatus = 'idle';

  constructor(audioEngine: WebAudioEngine) {
    this.audioEngine = audioEngine;
    this.deviceId = `dev-${Math.random().toString(36).substring(2, 7)}`;
    this.deviceName = this.generateDeviceName();
  }

  private generateDeviceName(): string {
    const brands = ['Pixel', 'Galaxy', 'iPhone', 'OnePlus', 'Xperia', 'iPad'];
    const brand = brands[Math.floor(Math.random() * brands.length)];
    const num = Math.floor(100 + Math.random() * 900);
    return `${brand} ${num}`;
  }

  public setListeners(listeners: SyncEventListener) {
    this.listeners = listeners;
  }

  public getDeviceId(): string {
    return this.deviceId;
  }

  public getDeviceName(): string {
    return this.deviceName;
  }

  public setDeviceName(name: string) {
    this.deviceName = name;
    this.broadcastJoin();
  }

  public getIsHost(): boolean {
    return this.isHost;
  }

  public getIsAdmin(): boolean {
    return this.currentAdminId === this.deviceId;
  }

  public getAdminId(): string {
    return this.currentAdminId;
  }

  public getRoomId(): string {
    return this.roomId;
  }

  public getPeers(): PartyPeer[] {
    return Array.from(this.peers.values());
  }

  public hostNow(): number {
    return Date.now() + (this.getIsAdmin() ? 0 : this.clockOffsetMs);
  }

  public async initSession(roomId: string, asHost: boolean) {
    this.leaveSession();

    this.roomId = roomId.toUpperCase().trim();
    this.isHost = asHost;
    if (asHost) {
      this.currentAdminId = this.deviceId;
    }

    this.log(asHost ? `👑 You are the Admin of Party Speaker: ${this.roomId}` : `Joined Group: ${this.roomId}`);

    try {
      this.broadcastChannel = new BroadcastChannel(`party_speaker_${this.roomId}`);
      this.broadcastChannel.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    } catch {}

    this.connectServerEvents();
    this.broadcastJoin();
    this.startPingLoop();

    if (this.isHost) {
      this.startHostSyncLoop();
    }
  }

  private connectServerEvents() {
    try {
      const url = `/api/rooms/${this.roomId}/events?deviceId=${this.deviceId}&isHost=${this.isHost}`;
      this.eventSource = new EventSource(url);

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch {}
      };

      this.eventSource.onerror = () => {};
    } catch {}
  }

  private startPingLoop() {
    if (this.pingInterval) clearInterval(this.pingInterval);

    this.sendPing();
    setTimeout(() => this.sendPing(), 400);
    setTimeout(() => this.sendPing(), 900);

    this.pingInterval = setInterval(() => {
      this.sendPing();
    }, 2000);
  }

  private sendPing() {
    const clientTime = Date.now();
    const pingMsg: PartyMessage = {
      type: 'PING',
      senderId: this.deviceId,
      clientTime,
    };

    this.sendToPeers(pingMsg);

    fetch(`/api/rooms/${this.roomId}/ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientTime }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.serverTime) {
          this.processPong(data.clientTime, data.serverTime);
        }
      })
      .catch(() => {});
  }

  private processPong(clientTime: number, hostTime: number) {
    const t0 = clientTime;
    const th = hostTime;
    const t1 = Date.now();
    const rtt = Math.max(1, t1 - t0);

    const calculatedOffset = th - Math.round((t0 + t1) / 2);

    if (rtt <= this.bestRttMs + 10) {
      this.bestRttMs = Math.min(this.bestRttMs, rtt);
      if (this.clockOffsetMs === 0) {
        this.clockOffsetMs = calculatedOffset;
      } else {
        this.clockOffsetMs = Math.round(this.clockOffsetMs * 0.7 + calculatedOffset * 0.3);
      }
    }

    this.updateAudioStats(rtt);
  }

  private startHostSyncLoop() {
    if (this.syncInterval) clearInterval(this.syncInterval);
    this.syncInterval = setInterval(() => {
      if (!this.getIsAdmin() || !this.audioEngine.getPlaying()) return;
      const hostTime = this.hostNow();
      const currentPosMs = this.audioEngine.getCurrentPositionMs();

      this.sendToPeers({
        type: 'SYNC',
        senderId: this.deviceId,
        hostTime,
        positionMs: currentPosMs,
      });
    }, 2500);
  }

  private broadcastJoin() {
    const joinMsg: PartyMessage = {
      type: 'JOIN',
      senderId: this.deviceId,
      name: this.deviceName,
      isHost: this.getIsAdmin(),
    };
    this.sendToPeers(joinMsg);
  }

  public sendToPeers(message: PartyMessage) {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(message);
      } catch {}
    }

    fetch(`/api/rooms/${this.roomId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: this.roomId,
        message,
        senderId: this.deviceId,
      }),
    }).catch(() => {});
  }

  /**
   * ONLY the current Admin can transfer the Admin role to another friend!
   */
  public transferAdmin(newAdminId: string) {
    if (!this.getIsAdmin()) {
      this.log('Only the current Host Admin can transfer control.');
      return;
    }

    this.currentAdminId = newAdminId;
    this.isHost = this.deviceId === newAdminId;

    this.sendToPeers({
      type: 'TRANSFER_ADMIN',
      senderId: this.deviceId,
      newAdminId,
    });

    this.updatePeerAdminState();
    this.listeners.onAdminChanged?.(newAdminId, this.getIsAdmin());
    this.log(`Admin rights transferred to peer ${newAdminId}`);
  }

  /**
   * A guest sends a request to the Host to play a song.
   */
  public requestPlaySong(songTitle: string) {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const msg: PartyMessage = {
      type: 'REQUEST_PLAY_SONG',
      senderId: this.deviceId,
      senderName: this.deviceName,
      requestId,
      songTitle,
    };
    this.sendToPeers(msg);
    this.log(`Permission requested to play: "${songTitle}". Waiting for Host approval...`);
  }

  /**
   * Host approves the friend's song request and grants playback permission.
   */
  public approveSongRequest(requestId: string, songTitle: string) {
    if (!this.getIsAdmin()) return;

    this.sendToPeers({
      type: 'APPROVE_SONG_REQUEST',
      senderId: this.deviceId,
      requestId,
      songTitle,
    });

    this.log(`Approved request for: "${songTitle}"`);
    this.pendingRequests.delete(requestId);
  }

  /**
   * Host declines the song request.
   */
  public declineSongRequest(requestId: string) {
    if (!this.getIsAdmin()) return;

    this.sendToPeers({
      type: 'DECLINE_SONG_REQUEST',
      senderId: this.deviceId,
      requestId,
      reason: 'Host is currently playing another track.',
    });

    this.log('Declined song request.');
    this.pendingRequests.delete(requestId);
  }

  private updatePeerAdminState() {
    for (const [id, peer] of this.peers.entries()) {
      peer.isAdmin = id === this.currentAdminId;
      peer.isHost = id === this.currentAdminId;
    }
    this.notifyPeers();
  }

  private handleMessage(msg: any) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.senderId === this.deviceId) return;

    switch (msg.type) {
      case 'PING': {
        if (this.getIsAdmin()) {
          const pongMsg: PartyMessage = {
            type: 'PONG',
            senderId: this.deviceId,
            clientTime: msg.clientTime,
            hostTime: this.hostNow(),
          };
          this.sendToPeers(pongMsg);
        }
        break;
      }

      case 'PONG': {
        this.processPong(msg.clientTime, msg.hostTime);
        break;
      }

      case 'JOIN': {
        if (!this.currentAdminId && msg.isHost) {
          this.currentAdminId = msg.senderId;
        }

        this.peers.set(msg.senderId, {
          id: msg.senderId,
          name: msg.name,
          isHost: msg.senderId === this.currentAdminId,
          isAdmin: msg.senderId === this.currentAdminId,
          rttMs: 0,
          offsetMs: 0,
          isReady: true,
          lastSeen: Date.now(),
          volume: 1.0,
        });
        this.notifyPeers();

        if (this.getIsAdmin()) {
          this.broadcastJoin();
          const activeTrack = this.audioEngine.getCurrentTrack();
          if (this.audioEngine.getPlaying()) {
            this.sendToPeers({
              type: 'PLAY',
              senderId: this.deviceId,
              scheduledHostTime: this.hostNow() + 300,
              positionMs: this.audioEngine.getCurrentPositionMs(),
              trackId: activeTrack.id,
              trackTitle: activeTrack.title,
              trackUrl: activeTrack.url,
            });
          }
        }
        break;
      }

      case 'TRANSFER_ADMIN': {
        this.currentAdminId = msg.newAdminId;
        this.isHost = this.deviceId === msg.newAdminId;
        this.updatePeerAdminState();
        this.listeners.onAdminChanged?.(msg.newAdminId, this.getIsAdmin());
        if (this.getIsAdmin()) {
          this.log('👑 You have been made the Room Admin!');
        } else {
          this.log(`Room Admin changed to: ${msg.newAdminId}`);
        }
        break;
      }

      case 'REQUEST_PLAY_SONG': {
        if (this.getIsAdmin()) {
          const req: SongRequest = {
            requestId: msg.requestId,
            senderId: msg.senderId,
            senderName: msg.senderName,
            songTitle: msg.songTitle,
            timestamp: Date.now(),
          };
          this.pendingRequests.set(msg.requestId, req);
          this.listeners.onSongRequestReceived?.(req);
          this.log(`Incoming request from ${msg.senderName} to play: "${msg.songTitle}"`);
        }
        break;
      }

      case 'APPROVE_SONG_REQUEST': {
        this.log(`🎉 Host approved song: "${msg.songTitle}"!`);
        this.listeners.onSongRequestApproved?.(msg.requestId, msg.songTitle);
        break;
      }

      case 'DECLINE_SONG_REQUEST': {
        this.log(`Host declined the song request.`);
        this.listeners.onSongRequestDeclined?.(msg.requestId);
        break;
      }

      case 'PEER_LEFT': {
        if (msg.deviceId) {
          this.peers.delete(msg.deviceId);
          this.notifyPeers();
        }
        break;
      }

      case 'PLAY': {
        this.log(`Now playing: ${msg.trackTitle || 'Selected Song'}`);
        this.listeners.onTrackChanged?.(msg.trackId, msg.trackTitle, msg.trackUrl);
        this.handleRemotePlay(msg.scheduledHostTime, msg.positionMs, msg.trackId, msg.trackUrl, msg.trackTitle);
        break;
      }

      case 'PAUSE': {
        this.log('Host paused music');
        this.audioEngine.pause();
        this.currentStatus = 'paused';
        this.listeners.onStatusChange?.('paused');
        break;
      }

      case 'SEEK': {
        this.audioEngine.seek(msg.positionSec);
        break;
      }

      case 'SYNC': {
        const timeSinceHostReportedMs = this.hostNow() - msg.hostTime;
        const expectedPosMs = msg.positionMs + timeSinceHostReportedMs;
        this.audioEngine.handleSyncDrift(expectedPosMs);
        break;
      }

      case 'BEEP_TEST': {
        const targetLocalEpochMs = msg.scheduledHostTime - this.clockOffsetMs;
        const waitMs = targetLocalEpochMs - Date.now();
        setTimeout(() => {
          this.audioEngine.playTestBeep();
          this.listeners.onStrobeBeat?.();
        }, Math.max(0, waitMs));
        break;
      }
    }
  }

  private async handleRemotePlay(
    scheduledHostTime: number,
    positionMs: number,
    trackId: string,
    trackUrl?: string,
    trackTitle?: string
  ) {
    if (trackUrl && this.audioEngine.getCurrentTrack().url !== trackUrl) {
      await this.audioEngine.loadAudioUrl(trackUrl, trackTitle);
    }

    const targetLocalEpochMs = scheduledHostTime - (this.getIsAdmin() ? 0 : this.clockOffsetMs);
    this.currentStatus = 'scheduled';
    this.listeners.onStatusChange?.('scheduled');

    this.audioEngine.schedulePlay(targetLocalEpochMs, positionMs);

    const waitMs = targetLocalEpochMs - Date.now();
    if (waitMs > 0) {
      setTimeout(() => {
        this.currentStatus = 'playing';
        this.listeners.onStatusChange?.('playing');
      }, waitMs);
    } else {
      this.currentStatus = 'playing';
      this.listeners.onStatusChange?.('playing');
    }
  }

  public async hostPlay() {
    if (!this.getIsAdmin()) return;

    const track = this.audioEngine.getCurrentTrack();
    const scheduleOffsetMs = 1200;
    const scheduledHostTime = this.hostNow() + scheduleOffsetMs;
    const currentPosMs = this.audioEngine.getCurrentPositionMs();

    const playMsg: PartyMessage = {
      type: 'PLAY',
      senderId: this.deviceId,
      scheduledHostTime,
      positionMs: currentPosMs,
      trackId: track.id,
      trackTitle: track.title,
      trackUrl: track.url,
    };

    this.sendToPeers(playMsg);
    this.handleRemotePlay(scheduledHostTime, currentPosMs, track.id, track.url, track.title);
  }

  public hostPause() {
    if (!this.getIsAdmin()) return;
    const pauseMsg: PartyMessage = {
      type: 'PAUSE',
      senderId: this.deviceId,
    };
    this.sendToPeers(pauseMsg);
    this.audioEngine.pause();
    this.currentStatus = 'paused';
    this.listeners.onStatusChange?.('paused');
  }

  public hostSeek(positionSec: number) {
    this.audioEngine.seek(positionSec);
    if (this.getIsAdmin()) {
      this.sendToPeers({
        type: 'SEEK',
        senderId: this.deviceId,
        positionSec,
      });
    }
  }

  public triggerTestBeep() {
    const scheduledHostTime = this.hostNow() + 800;
    this.sendToPeers({
      type: 'BEEP_TEST',
      senderId: this.deviceId,
      scheduledHostTime,
    });
    setTimeout(() => {
      this.audioEngine.playTestBeep();
      this.listeners.onStrobeBeat?.();
    }, 800);
  }

  private updateAudioStats(rtt: number) {
    let syncQuality: AudioStats['syncQuality'] = 'Fair (<60ms)';
    if (rtt < 12) {
      syncQuality = 'Studio (Sub-5ms)';
    } else if (rtt < 35) {
      syncQuality = 'Synchronized (<25ms)';
    }

    this.listeners.onStatsUpdated?.({
      driftMs: Math.round(Math.abs(this.clockOffsetMs)),
      rttMs: Math.round(rtt),
      offsetMs: this.clockOffsetMs,
      syncQuality,
    });
  }

  private notifyPeers() {
    this.listeners.onPeersUpdated?.(this.getPeers());
  }

  private log(message: string) {
    this.listeners.onLogMessage?.(message);
  }

  public leaveSession() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.syncInterval) clearInterval(this.syncInterval);
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close();
      } catch {}
      this.broadcastChannel = null;
    }
    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch {}
      this.eventSource = null;
    }
    this.peers.clear();
    this.currentStatus = 'idle';
  }
}
