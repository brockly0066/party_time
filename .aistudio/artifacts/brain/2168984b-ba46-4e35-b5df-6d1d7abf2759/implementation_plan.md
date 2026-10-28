# Party Speaker - Synchronized Multi-Device Sound System

An emergency ad-hoc sound system app designed for outdoor adventures, camping, and group gatherings. When someone forgets a portable Bluetooth speaker, Party Speaker connects every phone in the group into a synchronized multi-speaker array, playing local audio files in lockstep at maximum volume with sub-40ms clock alignment.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Based on your confirmed choices, the application delivers a **dual-platform experience**:
> 1. An immediate **Browser-Based P2P Audio Player** supporting instant QR camera pairing, Web Audio playback, local file picking (MP3/WAV/FLAC), drift compensation, and an interactive 4-phone simulator.
> 2. A **Complete Android Studio Project Exporter** that packages the native Kotlin codebase (`Nearby Connections` / Nearby Share offline P2P, `SyncEngine.kt`, `MainActivity.kt`, Gradle scripts) into a ready-to-run `.zip` for deploying directly to real Android devices without internet.

- **Confirmed Decision (Platform)**: Web application with QR pairing + 1-click complete Android Studio project download.
- **Confirmed Decision (Connectivity)**: Nearby Share / Nearby Connections P2P for native Android phones + WebRTC/Broadcast/SSE relay for browser devices.
- **Confirmed Decision (Audio Source)**: Local audio file picker only (MP3, WAV, FLAC, AAC) from device storage—works completely offline without streaming services or cellular signal.
- **Acoustic Routing**: Supports full uniform amplification mode alongside optional spatial separation (Left phone, Right phone, Subwoofer/Bass-boost phone) to transform individual phones into a true surround sound stage.

---

## 1. Overview & Core Concept

### What It Does
Party Speaker links multiple smartphones together into a unified speaker array. One device acts as the **Host** (selects a song from device storage and controls playback), while all surrounding devices act as **Synchronized Speakers**. The system broadcasts the audio data, continuously synchronizes clocks using a microsecond NTP ping-pong handshake, and enforces drift compensation so all devices output sound in phase without echoes or delays.

### The Problem It Solves
- **Forgotten Hardware**: On camping trips, hikes, beach days, or impromptu gatherings, bringing a physical Bluetooth speaker is easily forgotten.
- **Tinny Phone Audio**: A single smartphone speaker is quiet, directional, and easily drowned out by wind and outdoor conversation.
- **Zero Internet Dependency**: Wilderness locations have no cell towers or Wi-Fi routers. The app must function 100% offline using local device storage and direct device-to-device radio links (Wi-Fi Direct, Bluetooth LE, and local peer connections).

### Target Audience & Use Cases
1. **Campers & Outdoor Adventurers**: Need music around the fire ring or campsite without carrying extra gear or draining a dedicated speaker battery.
2. **Students & Friends Groups**: Impromptu park picnics, beach hangouts, rooftop parties, and tailgates.
3. **Emergency Sound & Public Address**: Distributing announcements or alert tones across multiple phones simultaneously in group activities.

---

## 2. User Experience & Visual Design

### Key User Flows

```
[ OUTDOOR ADVENTURE USER JOURNEY ]

    Host Phone                                Joiner Phones
┌───────────────────────┐               ┌───────────────────────┐
│ Tap "Host a Group"   │               │ Tap "Join a Group"    │
└──────────┬────────────┘               └──────────┬────────────┘
           │                                       │
           ▼                                       ▼
┌───────────────────────┐               ┌───────────────────────┐
│ Shows 4-Letter Code   │ ◄── QR Scan ─►│ Auto-discovers Host   │
│ & Scannable QR Code   │               │ or enters 4-char code │
└──────────┬────────────┘               └──────────┬────────────┘
           │                                       │
           ▼                                       ▼
┌───────────────────────┐               ┌───────────────────────┐
│ "Pick Song from Phone"│ ── Audio P2P ─► Audio Buffered Locally│
│ (MP3 / WAV / FLAC)    │    Payload    │ Clock Sync Handshake  │
└──────────┬────────────┘               └──────────┬────────────┘
           │                                       │
           ▼                                       ▼
┌───────────────────────┐               ┌───────────────────────┐
│ "Play for Everyone"   │ ── NTP Sched ─► Plays at Exact T_sched│
│ (Schedules T + 1.2s)  │               │ Full Volume + Strobe  │
└───────────────────────┘               └───────────────────────┘
```

1. **Zero-State / Mode Choice**:
   - Clean, high-contrast dark theme optimized for outdoor battery saving and sunlight readability.
   - Two prominent thumb-friendly buttons: **"Host a Group"** and **"Join a Group"**.
2. **Host Management View**:
   - Displays clear room code (e.g. `CAMP-88`) and dynamic QR code for instant camera scan.
   - Shows active connected phones with live latency (RTT in ms), battery, and role.
   - **Local Audio Picker**: Browse files directly on device storage (`audio/*`).
   - Master Play/Pause and Seek bar.
   - **"Max Volume Boost"** button: Applies dynamic compression and 200% gain to overcome outdoor ambient noise safely.
3. **Joiner / Client View**:
   - Instant camera scanner or 4-letter code entry.
   - Live synchronization status: "Clock locked (±2.1ms drift) · Ready".
   - Acoustic role selector: **Stereo**, **Left Speaker**, **Right Speaker**, **Subwoofer (Bass Boost)**, or **Crisp Vocals**.
   - Optional **Party Strobe**: Screen flashes on low-frequency bass hits, turning the phones into synchronized campsite lantern strobes.
4. **Interactive Multi-Phone Simulator Sandbox**:
   - On-screen lab with 4 virtual phones (Pixel 8 Host, Galaxy S24 Left, iPhone 15 Right, OnePlus Sub) to simulate multi-speaker behavior directly in the browser with configurable network jitter and solo/mute switches.
5. **Android Studio Project Hub**:
   - Integrated source code viewer for the 8 attached Android files (`MainActivity.kt`, `SyncEngine.kt`, `AndroidManifest.xml`, `build.gradle.kts`, etc.).
   - 1-click **"Download Android Studio Project (.zip)"** button generating a ready-to-build Gradle project.

### Visual Identity & Theme
- **Canvas**: Deep Obsidian Slate (`#0b0f17`) for OLED battery conservation during outdoor trips.
- **Accents**: Electric Violet (`#9333ea`), Cyber Cyan (`#38bdf8`), and Neon Amber (`#f59e0b`).
- **Typography**: Display headlines in `Plus Jakarta Sans`, tabular numerals and latency metrics in `JetBrains Mono`.
- **Ergonomics**: All buttons maintain $\ge 48\text{px}$ touch hitboxes adhering to mobile touch standards.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Dual-Platform Delivery (Web + Native Android)
- **Chosen Approach**: Build a fully functional Web Audio application in Vite/React + provide a 1-click exporter of the native Android Studio project using Google Nearby Connections.
- **Why**: Allows instant zero-install use right inside mobile browsers via QR scan, while simultaneously providing the complete native Android codebase for zero-internet Bluetooth/Wi-Fi Direct outdoor adventures.
- **Alternatives Considered**: Native-only (requires installing an APK on every friend's phone first) vs Web-only (lacks background Bluetooth discovery when cellular data is totally offline).

### Decision 2: Clock Synchronization via NTP Midpoint Handshake
- **Chosen Approach**: Send rapid PING/PONG bursts to calculate Round Trip Time ($RTT = t_1 - t_0$) and clock offset ($\Delta = t_{host} - (t_0 + t_1)/2$). Keep the lowest RTT sample.
- **Why**: Standard NTP provides sub-5ms clock accuracy over local networks without requiring GPS or cellular time servers.
- **Alternatives Considered**: Web Audio time-tagging only (drifts over minutes due to hardware clock skew).

### Decision 3: Audio File Transfer & Scheduling
- **Chosen Approach**: Audio is loaded into an `AudioBuffer` and playback is scheduled $1.2\text{s}$ into the future ($T_{target} = T_{hostNow} + 1200\text{ms}$).
- **Why**: Pre-buffering eliminates network streaming stutter, and future scheduling guarantees every phone starts on the exact same audio sample.
- **Drift Threshold**: If a phone's position deviates by $>35\text{ms}$ during playback, the audio playhead automatically realigns.

---

## 4. Technical Architecture & System Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           PARTY SPEAKER SYSTEM                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [ FRONTEND / WEB CLIENT ]                                              │
│  ┌───────────────────────┐  ┌───────────────────────┐                   │
│  │   Host Controller     │  │   Joiner Speaker      │                   │
│  │  - Local File Picker  │  │  - Role Selector      │                   │
│  │  - Transport (Play)   │  │  - Drift Monitor      │                   │
│  │  - QR Code Generator  │  │  - Strobe Light       │                   │
│  └──────────┬────────────┘  └──────────┬────────────┘                   │
│             │                          │                                │
│             ▼                          ▼                                │
│  ┌──────────────────────────────────────────────────┐                   │
│  │               WebAudioEngine.ts                  │                   │
│  │  - AudioContext (48kHz stereo)                   │                   │
│  │  - ChannelSplitter / Merger Matrix (L/R/Sub)     │                   │
│  │  - DynamicsCompressor & +200% Gain Boost         │                   │
│  │  - AnalyserNode (FFT Spectrum & Bass Pulsar)     │                   │
│  └──────────────────────────┬───────────────────────┘                   │
│                             │                                           │
│  ┌──────────────────────────▼───────────────────────┐                   │
│  │              PartySyncService.ts                 │                   │
│  │  - NTP Ping/Pong Engine (RTT & Offset Math)      │                   │
│  │  - BroadcastChannel (instant multi-tab sync)     │                   │
│  │  - Server-Sent Events (SSE) Room Relay           │                   │
│  └──────────────────────────┬───────────────────────┘                   │
│                             │                                           │
│  [ BACKEND RELAY & EXPORTER ]                                           │
│  ┌──────────────────────────▼───────────────────────┐                   │
│  │  Express Server (`server.ts`)                    │                   │
│  │  - `/api/rooms/:id/events` (SSE Client Stream)   │                   │
│  │  - `/api/rooms/:id/ping`   (NTP Time Server)     │                   │
│  │  - `/api/rooms/:id/message`(Broadcast Relay)     │                   │
│  └──────────────────────────────────────────────────┘                   │
│                                                                         │
│  ┌──────────────────────────────────────────────────┐                   │
│  │  Android Codebase Hub (`androidCodebase.ts`)     │                   │
│  │  - Full Kotlin Source (`MainActivity`, `Sync`)   │                   │
│  │  - JSZip Export of complete Android Studio files │                   │
│  └──────────────────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Implementation Steps

1. **Audio & Synchronization Core**:
   - Complete `WebAudioEngine.ts` with local file decoding, sample-accurate scheduling, compressor limiter, and spatial channels (Stereo, Left, Right, Subwoofer 120Hz lowpass).
   - Complete `PartySyncService.ts` with NTP clock estimation, multi-tab BroadcastChannel, and room messaging.
2. **User Interface & Outdoor Views**:
   - **Host & Joiner Hub**: Room pairing with QR code canvas, peer table with latency/battery indicators, and 1-tap microsecond sync test beep.
   - **Local Audio Selector**: Drag-and-drop or file picker supporting MP3, WAV, FLAC, and AAC files directly from the phone.
   - **Visualizer & Party Strobe**: Canvas frequency bars, central pulsating bass ring, and synchronized screen flash.
3. **Interactive Multi-Phone Simulator Sandbox**:
   - 4-phone virtual environment allowing immediate demonstration on a laptop/single phone.
4. **Android Studio Companion & Exporter**:
   - Code viewer with tabbed navigation for all 8 Android project files.
   - 1-click **"Download Android Studio Project (.zip)"** generating the complete project directory.
5. **Verification**:
   - Validate with `lint_applet` and `compile_applet`.
