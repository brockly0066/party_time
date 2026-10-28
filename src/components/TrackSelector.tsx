import React, { useRef } from 'react';
import { DEFAULT_TRACK, ActiveTrack } from '../services/webAudioEngine';
import { Music, Upload, Check, Music2 } from 'lucide-react';

interface TrackSelectorProps {
  currentTrackId: string;
  onSelectTrack: (track: ActiveTrack) => void;
  onUploadFile: (file: File) => void;
  isHost: boolean;
}

export const TrackSelector: React.FC<TrackSelectorProps> = ({
  currentTrackId,
  onSelectTrack,
  onUploadFile,
  isHost,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadFile(file);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-slate-100">Selected Audio Track</h3>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="audio/*"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Choose Song (MP3/WAV)</span>
          </button>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white">
            <Music2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">{DEFAULT_TRACK.title}</div>
            <div className="text-xs text-slate-400">{DEFAULT_TRACK.artist}</div>
          </div>
        </div>

        <button
          onClick={() => onSelectTrack(DEFAULT_TRACK)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors cursor-pointer ${
            currentTrackId === DEFAULT_TRACK.id
              ? 'bg-purple-950/80 text-purple-300 border border-purple-800/60'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
          }`}
        >
          {currentTrackId === DEFAULT_TRACK.id && <Check className="w-3.5 h-3.5 text-emerald-400" />}
          <span>{currentTrackId === DEFAULT_TRACK.id ? 'Active' : 'Select'}</span>
        </button>
      </div>
    </div>
  );
};
