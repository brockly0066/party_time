import React, { useEffect, useRef, useState } from 'react';
import { WebAudioEngine } from '../services/webAudioEngine';
import { Activity, Disc, Sparkles } from 'lucide-react';

interface AudioVisualizerProps {
  audioEngine: WebAudioEngine;
  isPlaying: boolean;
  strobeTrigger?: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  audioEngine,
  isPlaying,
  strobeTrigger = 0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [strobeEnabled, setStrobeEnabled] = useState(false);
  const [isStrobing, setIsStrobing] = useState(false);
  const freqDataRef = useRef<Uint8Array>(new Uint8Array(128));
  const timeDataRef = useRef<Uint8Array>(new Uint8Array(128));
  const animFrameRef = useRef<number | null>(null);

  // Trigger brief flash when strobe beat arrives
  useEffect(() => {
    if (strobeEnabled && strobeTrigger > 0) {
      setIsStrobing(true);
      const timer = setTimeout(() => setIsStrobing(false), 90);
      return () => clearTimeout(timer);
    }
  }, [strobeTrigger, strobeEnabled]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let bassEnergy = 0;

    const render = () => {
      animFrameRef.current = requestAnimationFrame(render);
      const width = canvas.width;
      const height = canvas.height;

      // Extract frequency and time domain data
      audioEngine.getAnalyserData(freqDataRef.current, timeDataRef.current);

      // Dark canvas clear with slight trail
      ctx.fillStyle = '#0b0f17';
      ctx.fillRect(0, 0, width, height);

      // Compute bass energy (first 8 frequency bins)
      let currentBass = 0;
      for (let i = 0; i < 8; i++) {
        currentBass += freqDataRef.current[i];
      }
      currentBass = currentBass / 8;
      bassEnergy = bassEnergy * 0.8 + currentBass * 0.2;

      // Strobe flash if high transient bass detected and enabled
      if (strobeEnabled && isPlaying && currentBass > 190 && Math.random() < 0.2) {
        setIsStrobing(true);
        setTimeout(() => setIsStrobing(false), 70);
      }

      // Draw subtle background grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      const step = 24;
      for (let x = 0; x < width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Draw Center Bass Pulsar
      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = Math.min(width, height) * 0.2;
      const pulseRadius = baseRadius + (bassEnergy / 255) * 35;

      const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        baseRadius * 0.2,
        centerX,
        centerY,
        pulseRadius * 1.4
      );
      gradient.addColorStop(0, 'rgba(147, 51, 234, 0.6)'); // Purple
      gradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.3)'); // Blue
      gradient.addColorStop(1, 'rgba(11, 15, 23, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, pulseRadius * 1.4, 0, Math.PI * 2);
      ctx.fill();

      // Inner pulsating ring
      ctx.strokeStyle = isPlaying ? 'rgba(168, 85, 247, 0.7)' : 'rgba(100, 116, 139, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Draw Spectrum Bars
      const numBars = 42;
      const barWidth = Math.floor((width - (numBars - 1) * 3) / numBars);
      const barSpacing = 3;

      for (let i = 0; i < numBars; i++) {
        const binIndex = Math.floor((i / numBars) * (freqDataRef.current.length * 0.75));
        const value = isPlaying ? freqDataRef.current[binIndex] || 0 : Math.sin(Date.now() * 0.002 + i) * 15 + 20;
        const barHeight = Math.max(4, (value / 255) * (height * 0.72));
        const x = i * (barWidth + barSpacing) + (width - (numBars * (barWidth + barSpacing))) / 2;
        const y = height - barHeight;

        // Gradient from cyan to purple to hot pink
        const barGrad = ctx.createLinearGradient(0, height, 0, y);
        barGrad.addColorStop(0, '#3b82f6'); // blue
        barGrad.addColorStop(0.5, '#a855f7'); // purple
        barGrad.addColorStop(1, '#ec4899'); // pink

        ctx.fillStyle = barGrad;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, [2, 2, 0, 0]);
        ctx.fill();

        // Little floating peak dot
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillRect(x, Math.max(2, y - 4), barWidth, 2);
      }
    };

    render();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [audioEngine, isPlaying, strobeEnabled]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-800 bg-[#0b0f17]">
      {/* Visualizer Canvas */}
      <canvas
        ref={canvasRef}
        width={720}
        height={220}
        className="w-full h-44 sm:h-52 block"
      />

      {/* Synchronized Screen Flash Overlay (Party Strobe Mode) */}
      {isStrobing && (
        <div className="absolute inset-0 bg-white/40 pointer-events-none transition-opacity duration-75" />
      )}

      {/* Top Overlay Badge & Strobe Toggle */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Disc className={`w-4 h-4 ${isPlaying ? 'text-purple-400 animate-spin' : 'text-slate-500'}`} />
          <span className="font-medium text-slate-200">
            {isPlaying ? 'Live Multi-Speaker Stream' : 'Acoustic Standby'}
          </span>
          <span aria-hidden="true">·</span>
          <span>48kHz WebAudio</span>
        </div>

        <button
          onClick={() => setStrobeEnabled(!strobeEnabled)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors ${
            strobeEnabled
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-slate-800/90 text-slate-300 hover:text-white border border-slate-700/60'
          }`}
          title="Flashes your phone screen in sync with the beat"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{strobeEnabled ? 'Strobe Light ON' : 'Party Strobe'}</span>
        </button>
      </div>

      {/* Bottom Info Strip */}
      <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[11px] text-slate-400 font-mono tabular-nums">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-blue-400" />
          <span>Sub-40ms Drift Threshold</span>
        </div>
        <span>NTP Clock Synced</span>
      </div>
    </div>
  );
};
