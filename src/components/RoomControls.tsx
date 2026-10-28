import React, { useState, useRef } from 'react';
import { PartyPeer, PlaybackStatus, SongRequest } from '../types/party';
import { QrCodeCanvas } from './QrCodeCanvas';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Share2,
  QrCode,
  Users,
  Radio,
  Check,
  Zap,
  FolderOpen,
  Headphones,
  Smartphone,
  Music2,
  RotateCcw,
  Crown,
  Send,
  X,
  ShieldCheck,
  CheckCircle,
} from 'lucide-react';

interface RoomControlsProps {
  roomId: string;
  isHost: boolean;
  isAdmin: boolean;
  status: PlaybackStatus;
  peers: PartyPeer[];
  deviceName: string;
  volume: number;
  currentSongTitle: string;
  currentSongArtist: string;
  currentPositionSec: number;
  durationSec: number;
  pendingRequests: SongRequest[];
  onSetVolume: (vol: number) => void;
  onMaxVolume: () => void;
  onHostPlay: () => void;
  onHostPause: () => void;
  onHostSeek: (sec: number) => void;
  onTriggerSyncTest: () => void;
  onLoadLocalFile: (file: File) => void;
  onTransferAdmin: (newAdminId: string) => void;
  onRequestSong: (songTitle: string, file?: File) => void;
  onApproveSongRequest: (requestId: string, songTitle: string) => void;
  onDeclineSongRequest: (requestId: string) => void;
}

export const RoomControls: React.FC<RoomControlsProps> = ({
  roomId,
  isHost,
  isAdmin,
  status,
  peers,
  deviceName,
  volume,
  currentSongTitle,
  currentSongArtist,
  currentPositionSec,
  durationSec,
  pendingRequests,
  onSetVolume,
  onMaxVolume,
  onHostPlay,
  onHostPause,
  onHostSeek,
  onTriggerSyncTest,
  onLoadLocalFile,
  onTransferAdmin,
  onRequestSong,
  onApproveSongRequest,
  onDeclineSongRequest,
}) => {
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const guestFileInputRef = useRef<HTMLInputElement | null>(null);

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?room=${roomId}&join=true`
    : '';

  const triggerHaptic = (durationMs = 15) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(durationMs);
      } catch {}
    }
  };

  /**
   * Directly share the app with friends via WhatsApp, Nearby Share, Messages, or AirDrop!
   */
  const handleShareApp = async () => {
    triggerHaptic(25);
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: 'Party Speaker - Multi-Device Sound System',
          text: `Join my Party Speaker group "${roomId}" to play our music in full volume together!`,
          url: shareUrl,
        });
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2500);
        return;
      } catch {}
    }

    // Fallback: Copy link
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAdminFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    triggerHaptic(30);
    const file = e.target.files?.[0];
    if (file) {
      onLoadLocalFile(file);
    }
  };

  const handleGuestFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    triggerHaptic(30);
    const file = e.target.files?.[0];
    if (file) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      onRequestSong(cleanName, file);
    }
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = durationSec > 0 ? Math.min(100, (currentPositionSec / durationSec) * 100) : 0;

  return (
    <div className="container-fluid px-0 space-y-4">
      {/* 1. Host Admin & Direct Share Bar */}
      <div className="card bg-slate-900/90 border border-slate-800 rounded-3 p-3 p-md-4 shadow-sm text-slate-100">
        <div className="row g-3 align-items-center justify-content-between">
          <div className="col-12 col-md-7 d-flex align-items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl d-flex align-items-center justify-center shrink-0 ${
              isAdmin ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
            }`}>
              {isAdmin ? <Crown className="w-6 h-6 animate-pulse" /> : <Radio className="w-6 h-6 animate-pulse" />}
            </div>
            <div className="min-w-0">
              <div className="d-flex align-items-center gap-2">
                {isAdmin ? (
                  <span className="badge bg-amber-500 text-slate-950 font-bold d-inline-flex align-items-center gap-1 text-[11px] px-2 py-0.5">
                    <Crown className="w-3 h-3 fill-slate-950" />
                    ROOM ADMIN (YOU)
                  </span>
                ) : (
                  <span className="badge bg-purple-950 text-purple-300 border border-purple-800/60 font-monospace text-[11px]">
                    SPEAKER GUEST
                  </span>
                )}
                <span className="text-slate-400 text-xs font-monospace truncate">{deviceName}</span>
              </div>
              <div className="d-flex flex-wrap align-items-center gap-2 mt-1">
                <span className="h4 mb-0 fw-bold font-monospace tracking-tight text-white">
                  {roomId}
                </span>
                <button
                  onClick={() => setShowQr(!showQr)}
                  className={`btn btn-sm d-inline-flex align-items-center gap-1.5 py-1 px-2.5 rounded-lg text-xs ${
                    showQr ? 'btn-primary bg-purple-600 border-purple-600 text-white' : 'btn-dark bg-slate-800 border-slate-700 text-slate-200'
                  }`}
                  title="Show camera QR code"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>QR Code</span>
                </button>
              </div>
            </div>
          </div>

          {/* Direct Share App to Friends Button */}
          <div className="col-12 col-md-5 d-flex justify-content-md-end">
            <button
              onClick={handleShareApp}
              className="btn btn-primary bg-purple-600 hover:bg-purple-500 border-0 fw-bold text-white py-2 px-3.5 rounded-3 d-inline-flex align-items-center justify-center gap-2 shadow-md shadow-purple-900/40 w-100 w-md-auto text-xs"
              title="Share app via WhatsApp, Nearby Share, or Bluetooth"
            >
              {copied || shareSuccess ? <CheckCircle className="w-4 h-4 text-emerald-300" /> : <Share2 className="w-4 h-4" />}
              <span>{copied ? 'Link Copied!' : shareSuccess ? 'App Shared!' : 'Share App to Friends'}</span>
            </button>
          </div>
        </div>

        {/* QR Code Collapsible Drawer */}
        {showQr && (
          <div className="mt-3 pt-3 border-top border-slate-800">
            <div className="row g-3 align-items-center">
              <div className="col-12 col-sm-auto text-center">
                <QrCodeCanvas value={shareUrl} size={150} />
              </div>
              <div className="col-12 col-sm text-center text-sm-start space-y-1">
                <h5 className="h6 fw-bold text-white mb-1">Point Camera to Join Group</h5>
                <p className="text-xs text-slate-400 mb-2">
                  Have your friends scan this QR code with their phone camera. They will instantly connect as synchronized speakers!
                </p>
                <div className="badge bg-slate-950 text-purple-400 font-monospace text-wrap text-break p-2 border border-slate-800">
                  {shareUrl}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Incoming Song Requests Alert (Visible only to Admin) */}
      {isAdmin && pendingRequests.length > 0 && (
        <div className="card bg-purple-950/70 border border-purple-500/60 rounded-3 p-3 text-slate-100 shadow-lg">
          <div className="d-flex align-items-center gap-2 mb-2">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <h6 className="mb-0 fw-bold text-white">
              Incoming Song Play Permission Requests ({pendingRequests.length})
            </h6>
          </div>
          <div className="space-y-2">
            {pendingRequests.map((req) => (
              <div
                key={req.requestId}
                className="p-3 rounded-2 bg-slate-900/90 border border-purple-500/30 d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3"
              >
                <div>
                  <div className="text-xs text-purple-300 fw-semibold">
                    {req.senderName} requested to play:
                  </div>
                  <div className="text-sm font-bold text-white font-monospace mt-0.5">
                    "{req.songTitle}"
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      triggerHaptic(25);
                      onApproveSongRequest(req.requestId, req.songTitle);
                    }}
                    className="btn btn-sm btn-success d-inline-flex align-items-center gap-1.5 py-1.5 px-3 rounded-2 text-xs fw-semibold"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Accept &amp; Play</span>
                  </button>
                  <button
                    onClick={() => {
                      triggerHaptic(20);
                      onDeclineSongRequest(req.requestId);
                    }}
                    className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1.5 py-1.5 px-3 rounded-2 text-xs"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Decline</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Main Music Player Card */}
      <div className="card bg-gradient-to-b from-purple-950/40 via-slate-900 to-slate-900 border border-purple-500/30 rounded-4 p-4 p-md-5 shadow-lg text-slate-100">
        <div className="row g-4 align-items-center justify-content-center text-center">
          {/* Centered Album / Song Graphic */}
          <div className="col-12 d-flex flex-column align-items-center justify-content-center">
            <div className="relative mb-3">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-purple-600/30 border-2 border-purple-500/50 d-flex align-items-center justify-center text-purple-300 shadow-xl shadow-purple-900/40 mx-auto">
                <Music2 className={`w-12 h-12 ${status === 'playing' ? 'animate-pulse text-purple-200' : 'text-purple-400'}`} />
              </div>
              {status === 'playing' && (
                <span className="position-absolute bottom-0 end-0 badge rounded-pill bg-success p-2 border border-2 border-slate-900 shadow-sm">
                  <span className="visually-hidden">Playing</span>
                </span>
              )}
            </div>

            <div className="badge bg-purple-950/80 text-purple-300 font-monospace text-[11px] px-2.5 py-1 rounded-pill border border-purple-800/40 mb-2">
              {status === 'playing' ? 'NOW PLAYING ACROSS ALL PHONES' : 'READY TO PLAY'}
            </div>

            <h2 className="h4 h3-md fw-bold text-white text-truncate max-w-xl mb-1">
              {currentSongTitle}
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm text-truncate max-w-md mb-0">
              {currentSongArtist}
            </p>
          </div>

          {/* Scrubber Progress Bar */}
          <div className="col-12 col-lg-10">
            <div className="position-relative w-100 my-2" style={{ height: '8px' }}>
              <div className="w-100 h-100 bg-slate-800 rounded-pill overflow-hidden">
                <div
                  className="h-100 bg-gradient-to-r from-purple-500 to-pink-500 rounded-pill transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              {isAdmin && (
                <input
                  type="range"
                  min="0"
                  max={durationSec || 100}
                  step="1"
                  value={currentPositionSec}
                  onChange={(e) => onHostSeek(parseFloat(e.target.value))}
                  className="position-absolute top-0 start-0 w-100 h-100 opacity-0 cursor-pointer m-0 p-0"
                  title="Seek audio position"
                />
              )}
            </div>
            <div className="d-flex justify-content-between text-xs font-monospace text-slate-400">
              <span>{formatTime(currentPositionSec)}</span>
              <span>{formatTime(durationSec)}</span>
            </div>
          </div>

          {/* Transport Controls (Admin vs Guest) */}
          <div className="col-12 d-flex align-items-center justify-content-center gap-3">
            {isAdmin && (
              <button
                onClick={() => onHostSeek(0)}
                className="btn btn-dark bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 rounded-circle p-3 d-flex align-items-center justify-center transition-all"
                title="Restart song"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            )}

            {isAdmin ? (
              status === 'playing' ? (
                <button
                  onClick={() => {
                    triggerHaptic(25);
                    onHostPause();
                  }}
                  className="btn btn-warning bg-amber-500 hover:bg-amber-400 text-slate-950 fw-bold rounded-pill px-5 py-3 d-inline-flex align-items-center gap-2 shadow-lg shadow-amber-950/40 transition-transform active:scale-95"
                >
                  <Pause className="w-5 h-5 fill-slate-950" />
                  <span className="fs-6">Pause Everyone</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    triggerHaptic(30);
                    onHostPlay();
                  }}
                  className="btn btn-primary bg-purple-600 hover:bg-purple-500 border-0 fw-bold rounded-pill px-5 py-3 d-inline-flex align-items-center gap-2 shadow-xl shadow-purple-900/60 transition-transform active:scale-95"
                >
                  <Play className="w-5 h-5 fill-white" />
                  <span className="fs-6">Play for Everyone</span>
                </button>
              )
            ) : (
              <div className="alert alert-dark bg-slate-800 border-slate-700 text-slate-300 py-2.5 px-4 rounded-pill mb-0 text-xs d-flex align-items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" />
                <span>Admin controls playback · Your phone is playing in sync</span>
              </div>
            )}

            <button
              onClick={onTriggerSyncTest}
              className="btn btn-dark bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-400 rounded-circle p-3 d-flex align-items-center justify-center transition-all"
              title="Sync beep test"
            >
              <Zap className="w-5 h-5 fill-amber-400" />
            </button>
          </div>

          {/* Song Selection (Admin Changes Directly; Guests Send Request) */}
          <div className="col-12 col-md-8 col-lg-6">
            {isAdmin ? (
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAdminFilePicked}
                  accept="audio/*"
                  className="d-none"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn btn-outline-light border-slate-700 bg-slate-850 hover:bg-slate-800 text-slate-200 w-100 py-2.5 rounded-3 d-flex align-items-center justify-center gap-2 text-xs font-semibold shadow-sm"
                >
                  <FolderOpen className="w-4 h-4 text-purple-400" />
                  <span>Choose Another Song (Admin Broadcast)</span>
                </button>
              </>
            ) : (
              <>
                <input
                  type="file"
                  ref={guestFileInputRef}
                  onChange={handleGuestFilePicked}
                  accept="audio/*"
                  className="d-none"
                />
                <button
                  onClick={() => guestFileInputRef.current?.click()}
                  className="btn btn-outline-purple bg-purple-950/40 hover:bg-purple-900/50 border-purple-500/50 text-purple-200 w-100 py-2.5 rounded-3 d-flex align-items-center justify-center gap-2 text-xs font-semibold shadow-sm"
                >
                  <Send className="w-4 h-4 text-amber-400" />
                  <span>Request to Play a Song (Send to Host)</span>
                </button>
              </>
            )}
          </div>

          {/* Volume & 200% Max Boost Controls */}
          <div className="col-12 col-md-10 col-lg-8 pt-3 border-top border-slate-800">
            <div className="row g-3 align-items-center justify-content-between">
              <div className="col-12 col-sm d-flex align-items-center gap-2">
                <button
                  onClick={() => onSetVolume(volume === 0 ? 1 : 0)}
                  className="btn btn-link p-0 text-slate-400 hover:text-white"
                >
                  {volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
                <div className="flex-grow-1">
                  <div className="d-flex justify-content-between text-[11px] font-monospace text-slate-400 mb-1">
                    <span>Phone Gain</span>
                    <span>{Math.round(volume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.05"
                    value={volume}
                    onChange={(e) => onSetVolume(parseFloat(e.target.value))}
                    className="form-range"
                    style={{ accentColor: '#a855f7' }}
                  />
                </div>
              </div>

              <div className="col-12 col-sm-auto text-center">
                <button
                  onClick={() => {
                    triggerHaptic(40);
                    onMaxVolume();
                  }}
                  className="btn btn-danger bg-gradient-to-r from-red-500 to-amber-500 border-0 fw-bold text-white px-4 py-2 rounded-3 text-xs d-inline-flex align-items-center gap-1.5 shadow-md shadow-red-950/40 w-100 w-sm-auto justify-content-center"
                >
                  <Zap className="w-4 h-4 fill-white" />
                  <span>MAX VOLUME (200% BOOST)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Connected Phones List & Admin Management */}
      <div className="card bg-slate-900/90 border border-slate-800 rounded-3 p-3 p-md-4 shadow-sm text-slate-100">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div className="d-flex align-items-center gap-2">
            <Users className="w-4 h-4 text-purple-400" />
            <h3 className="h6 fw-bold mb-0 text-white">
              Connected Phones ({peers.length + 1} Speakers)
            </h3>
          </div>
          {isAdmin ? (
            <span className="badge bg-amber-950 text-amber-300 border border-amber-800/60 font-monospace text-[11px]">
              👑 ONLY HOST CAN CHANGE ADMIN
            </span>
          ) : (
            <span className="badge bg-slate-800 text-slate-400 font-monospace text-[11px]">
              PEER SYNCED
            </span>
          )}
        </div>

        <div className="list-group list-group-flush rounded-3 border border-slate-800 overflow-hidden">
          {/* This Phone */}
          <div className="list-group-item bg-slate-950/70 border-slate-800 d-flex align-items-center justify-content-between py-2.5 px-3 text-slate-200">
            <div className="d-flex align-items-center gap-2.5">
              <div className={`w-8 h-8 rounded-2 d-flex align-items-center justify-center font-bold ${
                isAdmin ? 'bg-amber-500/20 text-amber-400' : 'bg-purple-600/20 text-purple-300'
              }`}>
                {isAdmin ? <Crown className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
              </div>
              <div>
                <div className="text-xs fw-semibold text-white d-flex align-items-center gap-1.5">
                  <span>{deviceName}</span>
                  <span className={`badge text-[10px] ${
                    isAdmin ? 'bg-amber-500 text-slate-950' : 'bg-purple-900 text-purple-200'
                  }`}>
                    THIS PHONE {isAdmin ? '(ADMIN)' : '(GUEST)'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-monospace">
                  {isAdmin ? 'Master Room Controller' : 'Synchronized Speaker'}
                </div>
              </div>
            </div>
            <div className="text-emerald-400 font-monospace text-xs">
              0 ms
            </div>
          </div>

          {/* Connected Friends */}
          {peers.map((peer) => (
            <div key={peer.id} className="list-group-item bg-slate-950/50 border-slate-800 d-flex flex-column flex-sm-row align-items-sm-center justify-content-between py-2.5 px-3 text-slate-200 gap-2">
              <div className="d-flex align-items-center gap-2.5">
                <div className={`w-8 h-8 rounded-2 d-flex align-items-center justify-center ${
                  peer.isAdmin ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-300'
                }`}>
                  {peer.isAdmin ? <Crown className="w-4 h-4" /> : <Headphones className="w-4 h-4" />}
                </div>
                <div>
                  <div className="text-xs fw-semibold text-white d-flex align-items-center gap-1.5">
                    <span>{peer.name}</span>
                    {peer.isAdmin && (
                      <span className="badge bg-amber-500 text-slate-950 text-[10px]">ADMIN</span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 font-monospace">
                    Synchronized Speaker · Full Stereo
                  </div>
                </div>
              </div>

              <div className="d-flex align-items-center gap-2.5 self-end sm:self-auto">
                <div className="text-slate-400 font-monospace text-xs tabular-nums">
                  {peer.rttMs > 0 ? `${peer.rttMs} ms RTT` : 'Synced'}
                </div>

                {/* Only Host Admin has the privilege to change the admin! */}
                {isAdmin && !peer.isAdmin && (
                  <button
                    onClick={() => {
                      triggerHaptic(25);
                      onTransferAdmin(peer.id);
                    }}
                    className="btn btn-sm btn-outline-warning text-[10px] py-1 px-2 d-inline-flex align-items-center gap-1 rounded"
                    title="Transfer Room Admin permissions to this friend"
                  >
                    <Crown className="w-3 h-3" />
                    <span>Make Admin</span>
                  </button>
                )}
              </div>
            </div>
          ))}

          {peers.length === 0 && (
            <div className="list-group-item bg-slate-950/40 border-slate-800 text-center py-3 text-xs text-slate-400">
              No other phones connected yet. Tap <strong>Share App to Friends</strong> or <strong>QR Code</strong> above!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
