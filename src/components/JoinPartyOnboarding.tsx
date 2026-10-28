import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import {
  Smartphone,
  Download,
  Radio,
  CheckCircle2,
  Share,
  PlusSquare,
  Music2,
  ArrowRight,
  ShieldCheck,
  Volume2,
} from 'lucide-react';

interface JoinPartyOnboardingProps {
  roomId: string;
  songTitle: string;
  songArtist: string;
  defaultDeviceName: string;
  onConfirmJoin: (customName: string) => void;
}

export const JoinPartyOnboarding: React.FC<JoinPartyOnboardingProps> = ({
  roomId,
  songTitle,
  songArtist,
  defaultDeviceName,
  onConfirmJoin,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [guestName, setGuestName] = useState(defaultDeviceName);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [appInstalledLocally, setAppInstalledLocally] = useState(isInstalled);

  const handleInstallClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (ok) {
        setAppInstalledLocally(true);
      }
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  const handleJoinClick = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmJoin(guestName.trim() || defaultDeviceName);
  };

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 d-flex align-items-center justify-content-center p-3 p-sm-4">
      <div className="card bg-slate-900 border border-purple-500/30 rounded-4 shadow-2xl max-w-lg w-100 p-4 p-sm-5 text-slate-100">
        {/* Header Badge */}
        <div className="text-center mb-4">
          <div className="w-16 h-16 rounded-3xl bg-purple-600/30 border border-purple-500/50 d-inline-flex align-items-center justify-center text-purple-300 shadow-xl shadow-purple-900/40 mb-3">
            <Radio className="w-8 h-8 animate-pulse text-purple-300" />
          </div>
          <span className="badge bg-purple-950 text-purple-300 border border-purple-800/60 font-monospace text-xs px-3 py-1 mb-2">
            PARTY SPEAKER INVITATION
          </span>
          <h1 className="h3 fw-bold text-white mb-1">
            Join Group Sound System
          </h1>
          <p className="text-xs text-slate-400 mb-0">
            Connect your phone to play music together at maximum volume in microsecond sync.
          </p>
        </div>

        {/* Room & Song Info Box */}
        <div className="card bg-slate-950/80 border border-slate-800 rounded-3 p-3 mb-4">
          <div className="d-flex justify-content-between align-items-center border-bottom border-slate-800/80 pb-2 mb-2">
            <span className="text-xs text-slate-400 font-monospace">ROOM CODE:</span>
            <span className="h5 mb-0 fw-bold font-monospace text-purple-400">{roomId}</span>
          </div>
          <div className="d-flex align-items-center gap-2.5">
            <div className="w-9 h-9 rounded-2 bg-purple-600/20 text-purple-400 d-flex align-items-center justify-center shrink-0">
              <Music2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs fw-semibold text-white text-truncate">{songTitle}</div>
              <div className="text-[11px] text-slate-400 text-truncate">{songArtist}</div>
            </div>
          </div>
        </div>

        {/* 2-Step Process */}
        <div className="space-y-3 mb-4">
          {/* STEP 1: Download App */}
          <div className={`card p-3 rounded-3 border transition-all ${
            appInstalledLocally
              ? 'bg-emerald-950/20 border-emerald-500/40'
              : 'bg-purple-950/30 border-purple-500/40 shadow-sm'
          }`}>
            <div className="d-flex align-items-start justify-content-between gap-2">
              <div className="d-flex align-items-start gap-2.5">
                <div className={`w-7 h-7 rounded-2 d-flex align-items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                  appInstalledLocally ? 'bg-emerald-600 text-white' : 'bg-purple-600 text-white'
                }`}>
                  {appInstalledLocally ? <CheckCircle2 className="w-4 h-4" /> : '1'}
                </div>
                <div>
                  <h6 className="text-xs fw-bold text-white mb-0.5">
                    {appInstalledLocally ? 'App Installed on Phone' : 'Download / Install App to Phone'}
                  </h6>
                  <p className="text-[11px] text-slate-300 mb-0">
                    {appInstalledLocally
                      ? 'Ready for fullscreen offline playback and wake lock.'
                      : 'Recommended: Adds app to your home screen for fullscreen playback & loud volume.'}
                  </p>
                </div>
              </div>

              {!appInstalledLocally && (
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="btn btn-sm btn-primary bg-purple-600 hover:bg-purple-500 border-0 fw-bold text-xs py-1.5 px-3 rounded-2 text-nowrap d-inline-flex align-items-center gap-1 shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isIOS ? 'Install (iOS)' : 'Install App'}</span>
                </button>
              )}
            </div>
          </div>

          {/* STEP 2: Name Device & Join */}
          <div className="card bg-slate-950/60 border border-slate-800 p-3 rounded-3">
            <div className="d-flex align-items-start gap-2.5 mb-2.5">
              <div className="w-7 h-7 rounded-2 bg-slate-800 text-slate-200 d-flex align-items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                2
              </div>
              <div>
                <h6 className="text-xs fw-bold text-white mb-0.5">
                  Name Your Phone &amp; Join
                </h6>
                <p className="text-[11px] text-slate-400 mb-0">
                  Choose how your phone appears in the host's speaker array.
                </p>
              </div>
            </div>

            <form onSubmit={handleJoinClick} className="space-y-2">
              <div>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="e.g. Alex's Phone"
                  className="form-control form-control-sm bg-slate-900 border-slate-700 text-white rounded-2 text-xs py-2"
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary bg-purple-600 hover:bg-purple-500 border-0 w-100 py-2.5 rounded-3 fw-bold text-xs d-flex align-items-center justify-center gap-2 shadow-lg shadow-purple-900/50 mt-3"
              >
                <span>Join Party as Synchronized Speaker</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Benefits Footnote */}
        <div className="d-flex align-items-center justify-content-center gap-3 text-[11px] text-slate-400 font-monospace text-center pt-2 border-top border-slate-800">
          <span className="d-flex align-items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Zero Internet Needed
          </span>
          <span>·</span>
          <span className="d-flex align-items-center gap-1">
            <Volume2 className="w-3.5 h-3.5 text-purple-400" />
            200% Max Volume
          </span>
        </div>

        {/* iOS Install Bottom Sheet / Modal */}
        {showIOSGuide && (
          <div className="position-fixed inset-0 z-50 d-flex align-items-center justify-content-center bg-black/70 backdrop-blur-sm p-3">
            <div className="card bg-slate-900 border border-slate-800 p-4 rounded-4 max-w-sm w-100 text-slate-100 shadow-2xl">
              <h5 className="h6 fw-bold text-white mb-2 d-flex align-items-center gap-2">
                <Smartphone className="w-4 h-4 text-purple-400" />
                <span>Add to iPhone Home Screen</span>
              </h5>
              <div className="space-y-2.5 text-xs text-slate-300 my-3">
                <div className="p-2.5 rounded-2 bg-slate-950 border border-slate-800 d-flex align-items-center gap-2.5">
                  <Share className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>1. Tap the <strong>Share</strong> button at bottom of Safari.</span>
                </div>
                <div className="p-2.5 rounded-2 bg-slate-950 border border-slate-800 d-flex align-items-center gap-2.5">
                  <PlusSquare className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>2. Scroll down &amp; tap <strong>"Add to Home Screen"</strong>.</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowIOSGuide(false);
                  setAppInstalledLocally(true);
                }}
                className="btn btn-sm btn-dark bg-slate-800 hover:bg-slate-700 w-100 py-2 rounded-2 text-xs"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
