/**
 * Generates rich, high-energy party tracks using Web Audio API synthesis.
 * Guarantees 100% offline availability with zero external file download dependencies.
 */

export async function createSynthesizedAudioBuffer(
  audioCtx: AudioContext,
  trackType: 'cyber' | 'bass' | 'electro' | 'test',
  durationSec: number = 24
): Promise<AudioBuffer> {
  const sampleRate = audioCtx.sampleRate;
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = audioCtx.createBuffer(2, numSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  if (trackType === 'test') {
    // Spatial & Sync Calibration Track (Alternating Left / Right / Sub / Click)
    const bpm = 120;
    const beatSec = 60 / bpm;
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const beat = Math.floor(t / beatSec);
      const beatFraction = (t % beatSec) / beatSec;

      // 1. Metronome click on every beat (sharp transient)
      let click = 0;
      if (beatFraction < 0.05) {
        click = Math.sin(2 * Math.PI * 1800 * beatFraction) * Math.exp(-beatFraction * 80);
      }

      // 2. Cycle every 4 beats: Beat 0 = Both, Beat 1 = Left Only, Beat 2 = Right Only, Beat 3 = Sub 50Hz
      const phase = beat % 4;
      let leftSample = click * 0.4;
      let rightSample = click * 0.4;

      if (phase === 0) {
        // Both channels: 440Hz A tone
        const tone = Math.sin(2 * Math.PI * 440 * t) * 0.25 * Math.exp(-beatFraction * 4);
        leftSample += tone;
        rightSample += tone;
      } else if (phase === 1) {
        // Left channel only: 660Hz E tone
        const tone = Math.sin(2 * Math.PI * 660 * t) * 0.35 * Math.exp(-beatFraction * 4);
        leftSample += tone;
      } else if (phase === 2) {
        // Right channel only: 880Hz high A tone
        const tone = Math.sin(2 * Math.PI * 880 * t) * 0.35 * Math.exp(-beatFraction * 4);
        rightSample += tone;
      } else {
        // Subwoofer only: 50Hz deep sine wave
        const sub = Math.sin(2 * Math.PI * 50 * t) * 0.5 * Math.exp(-beatFraction * 2.5);
        leftSample += sub;
        rightSample += sub;
      }

      left[i] = Math.max(-1, Math.min(1, leftSample));
      right[i] = Math.max(-1, Math.min(1, rightSample));
    }
    return buffer;
  }

  // BPM configs
  const bpm = trackType === 'cyber' ? 128 : trackType === 'bass' ? 124 : 116;
  const beatSec = 60 / bpm;
  const sixteenth = beatSec / 4;

  // Chord notes (frequencies in Hz)
  const cyberChords = [
    [130.81, 196.0, 261.63, 329.63], // C minor / Eb / G
    [116.54, 174.61, 233.08, 293.66], // Bb
    [103.83, 155.56, 207.65, 261.63], // Ab
    [116.54, 174.61, 233.08, 293.66], // Bb
  ];

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const beat = Math.floor(t / beatSec);
    const sixteenthStep = Math.floor((t % beatSec) / sixteenth);
    const beatFraction = (t % beatSec) / beatSec;
    const bar = Math.floor(beat / 4);

    let kick = 0;
    let snare = 0;
    let hihat = 0;
    let bass = 0;
    let synthLeft = 0;
    let synthRight = 0;

    // --- 1. Kick Drum (4-on-the-floor) ---
    if (beatFraction < 0.18) {
      const kickEnv = Math.exp(-beatFraction * 22);
      // Pitch drop 140Hz -> 45Hz
      const freq = 45 + 100 * Math.exp(-beatFraction * 35);
      kick = Math.sin(2 * Math.PI * freq * beatFraction) * kickEnv * 0.7;
    }

    // --- 2. Clap / Snare on beats 1 and 3 (0-indexed: 1, 3) ---
    if ((beat % 2 === 1) && beatFraction < 0.22) {
      const snareEnv = Math.exp(-beatFraction * 18);
      const whiteNoise = (Math.random() * 2 - 1) * 0.4;
      const bodyTone = Math.sin(2 * Math.PI * 210 * beatFraction) * 0.3;
      snare = (whiteNoise + bodyTone) * snareEnv * 0.55;
    }

    // --- 3. Off-beat Hi-Hat (on step 2 of 4 sixteenths) ---
    const stepFraction = (t % sixteenth) / sixteenth;
    if ((sixteenthStep === 2 || (trackType === 'cyber' && sixteenthStep === 3)) && stepFraction < 0.08) {
      const hatEnv = Math.exp(-stepFraction * 45);
      const noise = (Math.random() * 2 - 1) * 0.35;
      hihat = noise * hatEnv;
    }

    // --- 4. Sub & Bassline ---
    const bassNote = trackType === 'bass' ? (bar % 4 === 0 ? 55 : bar % 4 === 1 ? 49 : 43.6) : 65.4;
    const bassFreq = bassNote * (1 + (sixteenthStep % 2 === 1 ? 0.5 : 0));
    const bassEnv = Math.max(0, 1 - (beatFraction % 0.5) * 2);
    // Square/saw hybrid with low harmonics
    bass = (
      Math.sin(2 * Math.PI * bassFreq * t) * 0.6 +
      Math.sin(2 * Math.PI * (bassFreq * 2) * t) * 0.2
    ) * bassEnv * 0.5;

    // --- 5. Stereo Chords & Arpeggio ---
    const chord = cyberChords[bar % cyberChords.length];
    const arpeggioNote = chord[sixteenthStep % chord.length];
    const synthTone = Math.sin(2 * Math.PI * arpeggioNote * t) * Math.exp(-stepFraction * 8);

    // Stereo panning movement
    const pan = Math.sin(2 * Math.PI * (bpm / 120) * 0.25 * t);
    synthLeft = synthTone * (0.5 - pan * 0.3) * 0.28;
    synthRight = synthTone * (0.5 + pan * 0.3) * 0.28;

    // Mixdown to Left and Right
    const l = kick + snare + hihat * 0.8 + bass * 0.9 + synthLeft;
    const r = kick + snare + hihat * 0.8 + bass * 0.9 + synthRight;

    // Soft clip / master limiter
    left[i] = Math.tanh(l);
    right[i] = Math.tanh(r);
  }

  return buffer;
}
