import React, { useState, useEffect } from 'react';
import { PlaybackStatus } from '../types/party';
import {
  Smartphone,
  Sliders,
  Radio,
  Volume2,
  VolumeX,
  Gauge,
  Activity,
  Layers,
  Music,
} from 'lucide-react';

interface VirtualPhoneSimulatorProps {
  status: PlaybackStatus;
  currentSongTitle: string;
}

interface SimulatedDevice {
  id: string;
  name: string;
  model: string;
  channel: string;
  color: string;
  isMuted: boolean;
  baseLatencyMs: number;
  currentDriftMs: number;
  battery: number;
}

export const VirtualPhoneSimulator: React.FC<VirtualPhoneSimulatorProps> = ({
  status,
  currentSongTitle,
}) => {
  const [networkJitterMs, setNetworkJitterMs] = useState(15);
  const [devices, setDevices] = useState<SimulatedDevice[]>([
    {
      id: 'phone-1',
      name: 'Host Phone',
      model: 'Pixel 8 Pro',
      channel: 'Master Audio Host (Full Volume)',
      color: 'border-purple-500',
      isMuted: false,
      baseLatencyMs: 0,
      currentDriftMs: 0,
      battery: 89,
    },
    {
      id: 'phone-2',
      name: 'Friend Phone 1',
      model: 'Galaxy S24',
      channel: 'Synchronized Speaker (Full Stereo)',
      color: 'border-blue-500',
      isMuted: false,
      baseLatencyMs: 8,
      currentDriftMs: 1.2,
      battery: 74,
    },
    {
      id: 'phone-3',
      name: 'Friend Phone 2',
      model: 'iPhone 15 Pro',
      channel: 'Synchronized Speaker (Full Stereo)',
      color: 'border-cyan-500',
      isMuted: false,
      baseLatencyMs: 12,
      currentDriftMs: 0.8,
      battery: 92,
    },
    {
      id: 'phone-4',
      name: 'Friend Phone 3',
      model: 'OnePlus 12',
      channel: 'Synchronized Speaker (Full Stereo)',
      color: 'border-amber-500',
      isMuted: false,
      baseLatencyMs: 14,
      currentDriftMs: 2.1,
      battery: 68,
    },
  ]);

  useEffect(() => {
    if (status !== 'playing') return;

    const interval = setInterval(() => {
      setDevices((prev) =>
        prev.map((d, index) => {
          if (index === 0) return d;
          const randomJitter = (Math.random() * 2 - 1) * (networkJitterMs * 0.2);
          const rawDrift = d.baseLatencyMs * 0.1 + randomJitter;
          const correctedDrift = Math.max(0.1, Math.min(3.8, Math.abs(rawDrift)));
          return {
            ...d,
            currentDriftMs: parseFloat(correctedDrift.toFixed(1)),
          };
        })
      );
    }, 1200);

    return () => clearInterval(interval);
  }, [status, networkJitterMs]);

  const toggleMute = (id: string) => {
    setDevices((prev) =>
      prev.map((d) => (d.id === id ? { ...d, isMuted: !d.isMuted } : d))
    );
  };

  const soloDevice = (id: string) => {
    setDevices((prev) =>
      prev.map((d) => ({
        ...d,
        isMuted: d.id !== id,
      }))
    );
  };

  const unmuteAll = () => {
    setDevices((prev) => prev.map((d) => ({ ...d, isMuted: false })));
  };

  return (
    <div className="space-y-4">
      {/* Header & Jitter Controller */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-white">
                Multi-Phone Synchronized Array Simulator
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Simulates 4 phones playing <span className="text-purple-300 font-medium">"{currentSongTitle}"</span> together in lockstep without internet.
            </p>
          </div>

          <button
            onClick={unmuteAll}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer self-start sm:self-auto"
          >
            Unmute All
          </button>
        </div>

        {/* Network Jitter Slider */}
        <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Sliders className="w-3.5 h-3.5 text-blue-400" />
            <span>Simulated Radio Jitter:</span>
            <span className="font-mono text-purple-300 font-semibold tabular-nums">
              {networkJitterMs} ms
            </span>
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-xs">
            <span className="text-[10px] text-slate-500">0ms</span>
            <input
              type="range"
              min="0"
              max="150"
              value={networkJitterMs}
              onChange={(e) => setNetworkJitterMs(parseInt(e.target.value))}
              className="w-full accent-purple-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <span className="text-[10px] text-slate-500">150ms</span>
          </div>
        </div>
      </div>

      {/* 4 Virtual Phone Frames */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {devices.map((device, idx) => {
          const isPlaying = status === 'playing' && !device.isMuted;
          return (
            <div
              key={device.id}
              className={`p-3.5 rounded-2xl bg-slate-950/80 border transition-all ${
                device.isMuted
                  ? 'border-slate-800/60 opacity-60'
                  : `${device.color} shadow-sm shadow-purple-950/30`
              }`}
            >
              {/* Phone Model & Battery */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pb-2 border-b border-slate-800/60">
                <div className="flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-slate-300" />
                  <span className="font-medium text-slate-200">{device.model}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Gauge className="w-3 h-3 text-emerald-400" />
                  <span>{device.battery}%</span>
                </div>
              </div>

              {/* Title & Channel */}
              <div className="mt-2.5">
                <div className="text-xs font-semibold text-white truncate">
                  {device.name}
                </div>
                <div className="text-[11px] font-mono text-purple-400 mt-0.5 truncate">
                  {device.channel}
                </div>
              </div>

              {/* Speaker Diaphragm */}
              <div className="my-3 py-4 flex flex-col items-center justify-center bg-slate-900/60 rounded-xl border border-slate-800/80">
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-transform ${
                    isPlaying
                      ? 'scale-110 bg-purple-600/30 border-2 border-purple-400 animate-pulse'
                      : 'scale-95 bg-slate-800/40 border border-slate-700/60'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center ${
                      isPlaying ? 'bg-purple-500 shadow-md shadow-purple-500/50' : 'bg-slate-700'
                    }`}
                  >
                    <Radio className={`w-3.5 h-3.5 ${isPlaying ? 'text-white' : 'text-slate-400'}`} />
                  </div>
                </div>

                <div className="mt-2 text-[10px] font-mono text-slate-400 flex items-center gap-1">
                  <Activity className="w-3 h-3 text-emerald-400" />
                  <span>
                    {idx === 0
                      ? 'Master Clock Source'
                      : `Drift: ±${device.currentDriftMs} ms`}
                  </span>
                </div>
              </div>

              {/* Control Buttons */}
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  onClick={() => toggleMute(device.id)}
                  className={`py-1.5 px-2 text-xs font-medium rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                    device.isMuted
                      ? 'bg-red-950/50 text-red-300 border border-red-800/50'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  {device.isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                  <span>{device.isMuted ? 'Muted' : 'Mute'}</span>
                </button>

                <button
                  onClick={() => soloDevice(device.id)}
                  className="py-1.5 px-2 text-xs font-medium rounded-lg bg-slate-800 hover:bg-purple-900/40 hover:text-purple-200 text-slate-300 border border-slate-700/60 transition-colors cursor-pointer text-center"
                >
                  Solo
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
