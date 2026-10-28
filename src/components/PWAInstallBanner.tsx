import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Smartphone, Download, Share, PlusSquare, X, CheckCircle2 } from 'lucide-react';

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  // Already running as standalone app on phone
  if (isInstalled) {
    return (
      <div className="p-2.5 rounded-xl bg-purple-950/30 border border-purple-800/40 flex items-center justify-between text-xs text-purple-300">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="font-medium">Installed Mobile App Active</span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-400">Offline &amp; Fullscreen Ready</span>
        </div>
      </div>
    );
  }

  // Android / Chrome / Edge 1-Tap Install Flow
  if (isInstallable) {
    return (
      <div className="p-3 rounded-2xl bg-gradient-to-r from-purple-950/70 via-slate-900/90 to-slate-900/80 border border-purple-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-purple-950/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-purple-900/50">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Install Party Speaker to Phone</span>
              <span className="px-1.5 py-0.2 rounded bg-purple-500/30 text-[10px] text-purple-200 border border-purple-400/30">
                1-TAP
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Install directly to your home screen. Opens like a native app without Android Studio!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={install}
            className="w-full sm:w-auto px-4 py-2 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center gap-1.5 transition-transform active:scale-95 shadow-md shadow-purple-900/40 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install App</span>
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 text-slate-500 hover:text-slate-300 rounded-lg cursor-pointer"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // iPhone / iOS Safari Guided Install Flow
  if (isIOS) {
    return (
      <>
        <div className="p-3 rounded-2xl bg-gradient-to-r from-purple-950/70 via-slate-900/90 to-slate-900/80 border border-purple-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-purple-950/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-purple-900/50">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">
                Add to iPhone Home Screen
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Run Party Speaker as a fullscreen app with no browser bars and zero lag.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowIOSModal(true)}
              className="w-full sm:w-auto px-4 py-2 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center gap-1.5 transition-transform active:scale-95 shadow-md shadow-purple-900/40 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install on iPhone</span>
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="p-1.5 text-slate-500 hover:text-slate-300 rounded-lg cursor-pointer"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* iOS Install Guide Bottom Sheet */}
        {showIOSModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-purple-400" />
                  <h3 className="text-sm font-bold text-white">Install on iPhone / iPad</h3>
                </div>
                <button
                  onClick={() => setShowIOSModal(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-300">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
                  <div className="w-6 h-6 rounded-lg bg-blue-600/30 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Share className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-semibold text-white">Step 1:</span> Tap the <strong>Share</strong> button at the bottom of Safari.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
                  <div className="w-6 h-6 rounded-lg bg-purple-600/30 text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                    <PlusSquare className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-semibold text-white">Step 2:</span> Scroll down and tap <strong>"Add to Home Screen"</strong>.
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowIOSModal(false)}
                className="w-full py-2.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Fallback banner for desktop/general browsers
  return (
    <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs text-slate-300">
      <div className="flex items-center gap-2">
        <Smartphone className="w-4 h-4 text-purple-400" />
        <span>Open this URL on any smartphone to use it as an instant mobile party speaker.</span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 text-slate-500 hover:text-slate-300 rounded cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
