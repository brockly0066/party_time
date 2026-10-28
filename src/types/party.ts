export type PlaybackStatus = 'idle' | 'buffering' | 'scheduled' | 'playing' | 'paused';

export interface PartyPeer {
  id: string;
  name: string;
  isHost: boolean;
  isAdmin: boolean;
  rttMs: number;
  offsetMs: number;
  isReady: boolean;
  lastSeen: number;
  volume: number;
}

export interface TrackMetadata {
  id: string;
  title: string;
  artist: string;
  duration: number; // in seconds
  url?: string;
  isCustom?: boolean;
}

export interface SongRequest {
  requestId: string;
  senderId: string;
  senderName: string;
  songTitle: string;
  timestamp: number;
}

export type PartyMessage =
  | { type: 'PING'; senderId: string; clientTime: number }
  | { type: 'PONG'; senderId: string; clientTime: number; hostTime: number }
  | {
      type: 'PLAY';
      senderId: string;
      scheduledHostTime: number;
      positionMs: number;
      trackId: string;
      trackTitle?: string;
      trackUrl?: string;
    }
  | { type: 'PAUSE'; senderId: string }
  | { type: 'SEEK'; senderId: string; positionSec: number }
  | { type: 'SYNC'; senderId: string; hostTime: number; positionMs: number }
  | {
      type: 'JOIN';
      senderId: string;
      name: string;
      isHost: boolean;
    }
  | { type: 'TRANSFER_ADMIN'; senderId: string; newAdminId: string }
  | {
      type: 'REQUEST_PLAY_SONG';
      senderId: string;
      senderName: string;
      requestId: string;
      songTitle: string;
    }
  | {
      type: 'APPROVE_SONG_REQUEST';
      senderId: string;
      requestId: string;
      songTitle: string;
    }
  | {
      type: 'DECLINE_SONG_REQUEST';
      senderId: string;
      requestId: string;
      reason?: string;
    }
  | { type: 'READY'; senderId: string; trackId: string }
  | { type: 'VOLUME_CHANGE'; senderId: string; volume: number }
  | { type: 'BEEP_TEST'; senderId: string; scheduledHostTime: number };

export interface AudioStats {
  driftMs: number;
  rttMs: number;
  offsetMs: number;
  syncQuality: 'Studio (Sub-5ms)' | 'Synchronized (<25ms)' | 'Fair (<60ms)' | 'Syncing...';
}
