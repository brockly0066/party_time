import React, { useState } from 'react';
import { ANDROID_FILES, downloadAndroidProjectZip } from '../services/androidCodebase';
import {
  Download,
  FileCode,
  Copy,
  Check,
  Terminal,
  Smartphone,
  WifiOff,
  Flame,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

export const AndroidExporter: React.FC = () => {
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [copied, setCopied] = useState(false);

  const activeFile = ANDROID_FILES[selectedFileIndex];

  const handleDownloadZip = async () => {
    try {
      setDownloading(true);
      setDownloadProgress(10);
      await downloadAndroidProjectZip((p) => setDownloadProgress(p));
      setTimeout(() => {
        setDownloading(false);
        setDownloadProgress(0);
      }, 1500);
    } catch (err) {
      console.error(err);
      setDownloading(false);
    }
  };

  const handleCopyCode = () => {
    if (activeFile) {
      navigator.clipboard.writeText(activeFile.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & 1-Click ZIP Exporter */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/60 to-slate-900/90 border border-purple-500/30 backdrop-blur-md space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-purple-600 text-white uppercase tracking-wider">
                Native Android Companion
              </span>
              <span className="text-xs text-slate-400 font-mono">Google Nearby Connections</span>
            </div>
            <h2 className="text-lg font-bold text-white">
              Export Complete Android Studio Project
            </h2>
            <p className="text-xs text-slate-300 max-w-xl">
              Turn 2+ real Android smartphones into an offline party speaker array using Bluetooth &amp; Wi-Fi Direct with zero internet or routers required.
            </p>
          </div>

          <div>
            <button
              onClick={handleDownloadZip}
              disabled={downloading}
              className="w-full sm:w-auto px-5 py-3 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center gap-2 shadow-lg shadow-purple-900/40 transition-transform active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>
                {downloading
                  ? `Zipping Project (${downloadProgress}%)...`
                  : 'Download Android Studio (.ZIP)'}
              </span>
            </button>
          </div>
        </div>

        {downloading && (
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-purple-500 h-1.5 transition-all duration-300"
              style={{ width: `${downloadProgress}%` }}
            />
          </div>
        )}
      </div>

      {/* 4-Step Outdoor Adventure Guide */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
          <div className="w-6 h-6 rounded-lg bg-purple-600/20 text-purple-400 flex items-center justify-center font-bold text-xs font-mono">
            1
          </div>
          <h4 className="text-xs font-semibold text-white">Download &amp; Unzip</h4>
          <p className="text-[11px] text-slate-400">
            Click download to get the pre-configured project with Kotlin 1.9 &amp; Gradle 8.5.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
          <div className="w-6 h-6 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-xs font-mono">
            2
          </div>
          <h4 className="text-xs font-semibold text-white">Open in Android Studio</h4>
          <p className="text-[11px] text-slate-400">
            Open the folder in Android Studio Koala+, let Gradle sync, target API 29+ (Android 10+).
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
          <div className="w-6 h-6 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-bold text-xs font-mono">
            3
          </div>
          <h4 className="text-xs font-semibold text-white">Deploy to 2+ Phones</h4>
          <p className="text-[11px] text-slate-400">
            Connect phones via USB or Wi-Fi debugging and hit Run. No developer accounts needed.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
          <div className="w-6 h-6 rounded-lg bg-amber-600/20 text-amber-400 flex items-center justify-center font-bold text-xs font-mono">
            4
          </div>
          <h4 className="text-xs font-semibold text-white">Host &amp; Adventure</h4>
          <p className="text-[11px] text-slate-400">
            One phone taps Host &amp; picks a song; other phones tap Join. Syncs automatically offline!
          </p>
        </div>
      </div>

      {/* Code Viewer */}
      <div className="rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden">
        {/* File Tabs */}
        <div className="p-2 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            {ANDROID_FILES.map((file, idx) => {
              const isSelected = idx === selectedFileIndex;
              return (
                <button
                  key={file.path}
                  onClick={() => setSelectedFileIndex(idx)}
                  className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-purple-600 text-white font-semibold'
                      : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>{file.filename}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={handleCopyCode}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Code'}</span>
          </button>
        </div>

        {/* File Description */}
        <div className="px-4 py-2 bg-slate-900/40 border-b border-slate-800/60 text-xs text-slate-400 font-sans">
          {activeFile.description}
        </div>

        {/* Code View with Line Numbers */}
        <div className="p-4 overflow-x-auto max-h-[460px] font-mono text-xs text-slate-300 leading-relaxed">
          <pre className="table">
            <code>
              {activeFile.content.split('\n').map((line, i) => (
                <span key={i} className="table-row">
                  <span className="table-cell pr-4 text-slate-600 select-none text-right tabular-nums w-8">
                    {i + 1}
                  </span>
                  <span className="table-cell whitespace-pre">{line}</span>
                </span>
              ))}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
};
