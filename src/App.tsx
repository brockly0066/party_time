/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { AudioVisualizer } from './components/AudioVisualizer';
import { RoomControls } from './components/RoomControls';
import { VirtualPhoneSimulator } from './components/VirtualPhoneSimulator';
import { AndroidExporter } from './components/AndroidExporter';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { useWakeLock } from './hooks/useWakeLock';
import { WebAudioEngine, DEFAULT_TRACK } from './services/webAudioEngine';
import { PartySyncService } from './services/partySyncService';
import { AudioStats, PartyPeer, PlaybackStatus, SongRequest } from './types/party';
import { JoinPartyOnboarding } from './components/JoinPartyOnboarding';
import {
  Flame,
  Activity,
  Zap,
  Lock,
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'room' | 'tracks' | 'simulator' | 'android'>('room');
  const [roomId, setRoomId] = useState('CAMP-88');
  const [isHost, setIsHost] = useState(true);
  const [isAdmin, setIsAdmin] = useState(true);
  const [isJoiningFlow, setIsJoiningFlow] = useState(false);
  const [status, setStatus] = useState<PlaybackStatus>('idle');
  const [volume, setVolume] = useState<number>(1.0);
  const [peers, setPeers] = useState<PartyPeer[]>([]);
  const [pendingRequests, setPendingRequests] = useState<SongRequest[]>([]);

  // Track state initialized with the user's uploaded song: "One Sun One Moon - Jailer"
  const [currentSongTitle, setCurrentSongTitle] = useState<string>(DEFAULT_TRACK.title);
  const [currentSongArtist, setCurrentSongArtist] = useState<string>(DEFAULT_TRACK.artist);
  const [currentPositionSec, setCurrentPositionSec] = useState<number>(0);
  const [durationSec, setDurationSec] = useState<number>(DEFAULT_TRACK.duration);

  const [audioStats, setAudioStats] = useState<AudioStats>({
    driftMs: 0,
    rttMs: 0,
    offsetMs: 0,
    syncQuality: 'Studio (Sub-5ms)',
  });
  const [strobeBeat, setStrobeBeat] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const audioEngineRef = useRef<WebAudioEngine | null>(null);
  const syncServiceRef = useRef<PartySyncService | null>(null);
  const pendingFilesRef = useRef<Map<string, File>>(new Map());

  if (!audioEngineRef.current) {
    audioEngineRef.current = new WebAudioEngine();
    syncServiceRef.current = new PartySyncService(audioEngineRef.current);
  }

  const audioEngine = audioEngineRef.current;
  const syncService = syncServiceRef.current!;

  // Screen WakeLock prevents mobile screen from sleeping during music
  const { isLocked: isScreenAwake } = useWakeLock(status === 'playing');

  // Preload user's uploaded track and init sync
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlRoom = params.get('room');
      const isJoin = params.get('join') === 'true';

      const initialRoom = urlRoom || `CAMP-${Math.floor(10 + Math.random() * 90)}`;
      setRoomId(initialRoom);
      setIsHost(!isJoin);
      setIsAdmin(!isJoin);
      if (isJoin) {
        setIsJoiningFlow(true);
      }

      // Preload user's uploaded song immediately
      audioEngine
        .loadAudioUrl(DEFAULT_TRACK.url!, DEFAULT_TRACK.title, DEFAULT_TRACK.artist)
        .then((buf) => {
          setDurationSec(buf.duration);
        })
        .catch(() => {});

      syncService.setListeners({
        onPeersUpdated: (updatedPeers) => setPeers(updatedPeers),
        onStatusChange: (newStatus) => setStatus(newStatus),
        onTrackChanged: (_trackId, trackTitle, trackUrl) => {
          if (trackTitle) setCurrentSongTitle(trackTitle);
          if (trackUrl) {
            audioEngine.loadAudioUrl(trackUrl, trackTitle).then((buf) => {
              setDurationSec(buf.duration);
            });
          }
        },
        onStatsUpdated: (stats) => setAudioStats(stats),
        onLogMessage: (msg) => showToast(msg),
        onStrobeBeat: () => setStrobeBeat((prev) => prev + 1),
        onAdminChanged: (_newAdminId, hasAdminRights) => {
          setIsAdmin(hasAdminRights);
          setIsHost(hasAdminRights);
          showToast(hasAdminRights ? '👑 You are now the Room Admin!' : 'Host Admin permissions updated.');
        },
        onSongRequestReceived: (req) => {
          setPendingRequests((prev) => [...prev.filter((r) => r.requestId !== req.requestId), req]);
          showToast(`🎵 New song request from ${req.senderName}: "${req.songTitle}"`);
        },
        onSongRequestApproved: (_requestId, songTitle) => {
          showToast(`🎉 Host approved your request to play: "${songTitle}"!`);
          // If we had the file pending, load it
          const pendingFile = pendingFilesRef.current.get(songTitle);
          if (pendingFile) {
            audioEngine.loadCustomAudioFile(pendingFile).then((buf) => {
              setDurationSec(buf.duration);
              setCurrentPositionSec(0);
              syncService.hostPlay();
            });
          }
        },
        onSongRequestDeclined: (_requestId) => {
          showToast('Host declined the song request at this time.');
        },
      });

      syncService.initSession(initialRoom, !isJoin);
    }

    return () => {
      syncService.leaveSession();
      audioEngine.destroy();
    };
  }, []);

  // Update playback playhead progress smoothly
  useEffect(() => {
    let animFrame: number;
    const updateProgress = () => {
      if (status === 'playing') {
        const posMs = audioEngine.getCurrentPositionMs();
        setCurrentPositionSec(posMs / 1000);
        const dur = audioEngine.getTrackDuration();
        if (dur > 0 && dur !== durationSec) {
          setDurationSec(dur);
        }
      }
      animFrame = requestAnimationFrame(updateProgress);
    };

    animFrame = requestAnimationFrame(updateProgress);
    return () => cancelAnimationFrame(animFrame);
  }, [status, durationSec]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage((cur) => (cur === message ? null : cur));
    }, 3200);
  };

  const handleSetVolume = (vol: number) => {
    setVolume(vol);
    audioEngine.setVolume(vol);
  };

  const handleMaxVolume = () => {
    setVolume(2.0);
    audioEngine.setMaxVolume();
    showToast('Volume boosted to 200% with hardware limiter');
  };

  const handleHostPlay = async () => {
    audioEngine.getContext();
    await syncService.hostPlay();
  };

  const handleHostPause = () => {
    syncService.hostPause();
  };

  const handleHostSeek = (sec: number) => {
    setCurrentPositionSec(sec);
    syncService.hostSeek(sec);
  };

  const handleTriggerSyncTest = () => {
    audioEngine.getContext();
    syncService.triggerTestBeep();
    showToast('Broadcasted synchronized reference click to all speakers');
  };

  /**
   * Admin changes song directly.
   */
  const handleLoadLocalFile = async (file: File) => {
    try {
      showToast(`Loading "${file.name}"...`);
      const buffer = await audioEngine.loadCustomAudioFile(file);
      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      setCurrentSongTitle(cleanName);
      setCurrentSongArtist('Local Phone Storage');
      setDurationSec(buffer.duration);
      setCurrentPositionSec(0);
      showToast(`Ready! "${cleanName}" loaded as active song`);
    } catch {
      showToast('Could not decode audio file. Please choose standard MP3 or WAV.');
    }
  };

  /**
   * Only Host Admin can transfer the admin role to another friend!
   */
  const handleTransferAdmin = (newAdminId: string) => {
    syncService.transferAdmin(newAdminId);
    setIsAdmin(false);
    setIsHost(false);
    showToast('Transferred Room Admin privileges to selected friend.');
  };

  /**
   * Guest sends permission request to Host to play a song!
   */
  const handleRequestSong = (songTitle: string, file?: File) => {
    if (file) {
      pendingFilesRef.current.set(songTitle, file);
    }

    if (isAdmin) {
      // If already Admin, no need to request permission: load directly!
      if (file) {
        handleLoadLocalFile(file);
      }
      return;
    }

    syncService.requestPlaySong(songTitle);
    showToast(`Request sent to Host to play: "${songTitle}"`);
  };

  /**
   * Host approves guest's song request.
   */
  const handleApproveSongRequest = (requestId: string, songTitle: string) => {
    syncService.approveSongRequest(requestId, songTitle);
    setPendingRequests((prev) => prev.filter((r) => r.requestId !== requestId));
    showToast(`Approved song: "${songTitle}"`);
  };

  /**
   * Host declines guest's song request.
   */
  const handleDeclineSongRequest = (requestId: string) => {
    syncService.declineSongRequest(requestId);
    setPendingRequests((prev) => prev.filter((r) => r.requestId !== requestId));
    showToast('Declined request.');
  };

  const handleQuickHost = () => {
    const newRoom = `PARTY-${Math.floor(100 + Math.random() * 900)}`;
    setRoomId(newRoom);
    setIsHost(true);
    setIsAdmin(true);
    syncService.initSession(newRoom, true);
    setActiveTab('room');
    showToast(`Created party room: ${newRoom}`);
  };

  if (isJoiningFlow) {
    return (
      <JoinPartyOnboarding
        roomId={roomId}
        songTitle={currentSongTitle}
        songArtist={currentSongArtist}
        defaultDeviceName={syncService.getDeviceName()}
        onConfirmJoin={(customName) => {
          syncService.setDeviceName(customName);
          setIsJoiningFlow(false);
          audioEngine.getContext();
          showToast(`Connected as speaker: "${customName}"!`);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0f17] text-slate-100">
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onQuickHost={handleQuickHost}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-3 px-sm-4 py-4 py-sm-6 space-y-4">
        {/* Mobile PWA Install Banner */}
        <PWAInstallBanner />

        {/* Adventure Context Banner */}
        <section className="card bg-gradient-to-r from-purple-950/40 via-slate-900/60 to-slate-900/40 border border-purple-900/30 rounded-3 p-3 text-slate-100">
          <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3">
            <div className="d-flex align-items-start gap-2.5">
              <div className="w-8 h-8 rounded-2 bg-purple-600/20 text-purple-400 d-flex align-items-center justify-center shrink-0 mt-0.5">
                <Flame className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h1 className="h6 fw-bold text-white mb-0.5">
                  Outdoor Adventure Sound System
                </h1>
                <p className="text-[11px] text-slate-300 mb-0">
                  Forgot your Bluetooth speaker? Link every phone in the group to play your selected song in full volume with zero internet required.
                </p>
              </div>
            </div>

            <div className="d-flex flex-wrap align-items-center gap-2 text-xs font-monospace text-slate-400 shrink-0">
              {isScreenAwake && (
                <span className="badge bg-emerald-950 text-emerald-300 border border-emerald-800/40 text-[10px] d-inline-flex align-items-center gap-1">
                  <Lock className="w-3 h-3" />
                  <span>Screen Awake</span>
                </span>
              )}
              <div className="d-flex align-items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-300 fw-semibold">{audioStats.syncQuality}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">RTT {audioStats.rttMs} ms</span>
              </div>
            </div>
          </div>
        </section>

        {/* Real-Time Audio Spectrum Visualizer */}
        <AudioVisualizer
          audioEngine={audioEngine}
          isPlaying={status === 'playing'}
          strobeTrigger={strobeBeat}
        />

        {/* Primary View: Main Song Player */}
        {activeTab === 'room' && (
          <RoomControls
            roomId={roomId}
            isHost={isHost}
            isAdmin={isAdmin}
            status={status}
            peers={peers}
            deviceName={syncService.getDeviceName()}
            volume={volume}
            currentSongTitle={currentSongTitle}
            currentSongArtist={currentSongArtist}
            currentPositionSec={currentPositionSec}
            durationSec={durationSec}
            pendingRequests={pendingRequests}
            onSetVolume={handleSetVolume}
            onMaxVolume={handleMaxVolume}
            onHostPlay={handleHostPlay}
            onHostPause={handleHostPause}
            onHostSeek={handleHostSeek}
            onTriggerSyncTest={handleTriggerSyncTest}
            onLoadLocalFile={handleLoadLocalFile}
            onTransferAdmin={handleTransferAdmin}
            onRequestSong={handleRequestSong}
            onApproveSongRequest={handleApproveSongRequest}
            onDeclineSongRequest={handleDeclineSongRequest}
          />
        )}

        {/* 4-Phone Simulator */}
        {activeTab === 'simulator' && (
          <VirtualPhoneSimulator
            status={status}
            currentSongTitle={currentSongTitle}
          />
        )}

        {/* Android Native Companion Code Exporter */}
        {activeTab === 'android' && (
          <AndroidExporter />
        )}
      </main>

      {/* Mobile Floating Bottom Bar */}
      <nav className="d-md-none sticky-bottom z-3 bg-[#0b0f17] border-top border-slate-800 px-3 py-2">
        <div className="row g-2 text-center">
          <div className="col-4">
            <button
              onClick={() => setActiveTab('room')}
              className={`btn btn-sm w-100 py-1 text-xs fw-semibold ${
                activeTab === 'room' ? 'btn-primary bg-purple-600 border-0 text-white' : 'btn-dark bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              Speaker Room
            </button>
          </div>
          <div className="col-4">
            <button
              onClick={() => setActiveTab('simulator')}
              className={`btn btn-sm w-100 py-1 text-xs fw-semibold ${
                activeTab === 'simulator' ? 'btn-primary bg-purple-600 border-0 text-white' : 'btn-dark bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              4-Phone Lab
            </button>
          </div>
          <div className="col-4">
            <button
              onClick={() => setActiveTab('android')}
              className={`btn btn-sm w-100 py-1 text-xs fw-semibold ${
                activeTab === 'android' ? 'btn-primary bg-purple-600 border-0 text-white' : 'btn-dark bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              Android Code
            </button>
          </div>
        </div>
      </nav>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="position-fixed bottom-0 end-0 m-3 z-50 alert alert-dark bg-slate-900 text-white border border-purple-500/50 shadow-lg d-flex align-items-center gap-2 py-2 px-3 rounded-3 text-xs">
          <Zap className="w-4 h-4 text-purple-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Footer */}
      <footer className="border-top border-slate-800/80 py-4 px-4 text-center text-xs text-slate-500">
        <div className="d-flex align-items-center justify-content-center gap-2">
          <span>Party Speaker Synchronizer</span>
          <span aria-hidden="true">·</span>
          <span>Host-Controlled Admin &amp; Permissions</span>
          <span aria-hidden="true">·</span>
          <span>Zero Internet P2P</span>
        </div>
      </footer>
    </div>
  );
}
