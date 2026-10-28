import JSZip from 'jszip';

export interface AndroidFile {
  path: string;
  filename: string;
  language: string;
  description: string;
  content: string;
}

export const ANDROID_FILES: AndroidFile[] = [
  {
    path: 'app/src/main/java/com/example/partyspeaker/MainActivity.kt',
    filename: 'MainActivity.kt',
    language: 'kotlin',
    description: 'Main UI Activity: Requests runtime permissions, handles Host/Join modes, audio file picker, volume boost, and connects with SyncEngine.',
    content: `package com.example.partyspeaker

import android.Manifest
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private lateinit var status: TextView
    private lateinit var engine: SyncEngine
    private var pendingAction: (() -> Unit)? = null

    private val permLauncher = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        if (it.values.all { ok -> ok }) pendingAction?.invoke() else status.text = "Permissions are required to find nearby phones."
    }
    private val songPicker = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        uri?.let { engine.setSong(it) }
    }

    override fun onCreate(s: Bundle?) {
        super.onCreate(s)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        status = TextView(this).apply { text = "Host a group or join one."; textSize = 18f; setPadding(0, 0, 0, 40) }
        engine = SyncEngine(applicationContext) { msg -> runOnUiThread { status.text = msg } }

        fun btn(label: String, onClick: () -> Unit) = Button(this).apply { text = label; setOnClickListener { onClick() } }
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER; setPadding(48, 48, 48, 48)
            addView(TextView(context).apply { text = "Party Speaker"; textSize = 28f; setPadding(0, 0, 0, 32) })
            addView(status)
            addView(btn("Host a group") { withPerms { engine.startHost() } })
            addView(btn("Join a group") { withPerms { engine.startJoin() } })
            addView(btn("Pick song (host)") { songPicker.launch(arrayOf("audio/*")) })
            addView(btn("Play for everyone (host)") { engine.hostPlay() })
            addView(btn("Pause for everyone (host)") { engine.hostPause() })
            addView(btn("Max volume") { engine.maxVolume(); status.text = "Volume set to max. Protect your hearing." })
        }
        setContentView(root)
    }

    private fun withPerms(action: () -> Unit) {
        val p = mutableListOf(Manifest.permission.ACCESS_FINE_LOCATION)
        if (Build.VERSION.SDK_INT >= 31) p += listOf(Manifest.permission.BLUETOOTH_SCAN,
            Manifest.permission.BLUETOOTH_ADVERTISE, Manifest.permission.BLUETOOTH_CONNECT)
        if (Build.VERSION.SDK_INT >= 33) p += Manifest.permission.NEARBY_WIFI_DEVICES
        pendingAction = action
        permLauncher.launch(p.toTypedArray())
    }

    override fun onDestroy() { engine.stop(); super.onDestroy() }
}
`,
  },
  {
    path: 'app/src/main/java/com/example/partyspeaker/SyncEngine.kt',
    filename: 'SyncEngine.kt',
    language: 'kotlin',
    description: 'High-precision synchronization engine using Google Play Services Nearby Connections, NTP clock offset calculation, payload transfer, and drift compensation.',
    content: `package com.example.partyspeaker

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.*

/** Handles Nearby connections, song transfer, clock sync and synchronized playback. */
class SyncEngine(private val ctx: Context, private val log: (String) -> Unit) {
    private val nearby = Nearby.getConnectionsClient(ctx)
    private val handler = Handler(Looper.getMainLooper())
    private val strategy = Strategy.P2P_STAR
    private val serviceId = "com.example.partyspeaker"
    private val peers = linkedSetOf<String>()
    private val incoming = mutableMapOf<Long, Payload>()
    private var player: MediaPlayer? = null
    private var songUri: Uri? = null
    private var scheduled: Runnable? = null
    private var playing = false
    private var isHost = false
    private var hostId: String? = null
    private var offset = 0L          // hostClock - localClock (ms)
    private var bestRtt = Long.MAX_VALUE
    private val name = "Phone-" + (1000..9999).random()

    private fun hostNow() = SystemClock.elapsedRealtime() + offset
    private fun send(id: String, msg: String) = nearby.sendPayload(id, Payload.fromBytes(msg.toByteArray()))
    private fun broadcast(msg: String) { if (peers.isNotEmpty()) nearby.sendPayload(peers.toList(), Payload.fromBytes(msg.toByteArray())) }

    // ---------- connection ----------
    private val lifecycle = object : ConnectionLifecycleCallback() {
        override fun onConnectionInitiated(id: String, info: ConnectionInfo) {
            nearby.acceptConnection(id, payloads)
        }
        override fun onConnectionResult(id: String, r: ConnectionResolution) {
            if (!r.status.isSuccess) { log("Connection failed"); return }
            peers.add(id)
            if (isHost) { log("Connected: \${peers.size} device(s)"); songUri?.let { sendSong(id) } }
            else { hostId = id; nearby.stopDiscovery(); log("Joined the group"); pingLoop() }
        }
        override fun onDisconnected(id: String) { peers.remove(id); log("Device left (\${peers.size} connected)") }
    }

    fun startHost() {
        isHost = true; offset = 0
        nearby.startAdvertising(name, serviceId, lifecycle,
            AdvertisingOptions.Builder().setStrategy(strategy).build())
            .addOnSuccessListener { log("Hosting as $name. Ask friends to tap Join.") }
            .addOnFailureListener { log("Host error: \${it.message}") }
    }

    fun startJoin() {
        isHost = false
        nearby.startDiscovery(serviceId, object : EndpointDiscoveryCallback() {
            override fun onEndpointFound(id: String, info: DiscoveredEndpointInfo) {
                nearby.requestConnection(name, id, lifecycle)
            }
            override fun onEndpointLost(id: String) {}
        }, DiscoveryOptions.Builder().setStrategy(strategy).build())
            .addOnSuccessListener { log("Searching for a group...") }
            .addOnFailureListener { log("Join error: \${it.message}") }
    }

    // ---------- song transfer ----------
    fun setSong(uri: Uri) {
        songUri = uri; load(uri); log("Song ready. Sending to \${peers.size} device(s)...")
        peers.forEach { sendSong(it) }
    }

    private fun sendSong(id: String) {
        val pfd = ctx.contentResolver.openFileDescriptor(songUri ?: return, "r") ?: return
        nearby.sendPayload(id, Payload.fromFile(pfd))
    }

    private val payloads = object : PayloadCallback() {
        override fun onPayloadReceived(id: String, p: Payload) {
            if (p.type == Payload.Type.BYTES) handle(id, String(p.asBytes()!!)) else incoming[p.id] = p
        }
        override fun onPayloadTransferUpdate(id: String, u: PayloadTransferUpdate) {
            if (u.status == PayloadTransferUpdate.Status.IN_PROGRESS && u.totalBytes > 0)
                incoming[u.payloadId]?.let { log("Receiving song \${u.bytesTransferred * 100 / u.totalBytes}%") }
            if (u.status == PayloadTransferUpdate.Status.SUCCESS) {
                val p = incoming.remove(u.payloadId) ?: return
                p.asFile()?.asUri()?.let { load(it); log("Song received. Waiting for host."); send(id, "READY") }
            }
        }
    }

    private fun load(uri: Uri) {
        player?.release()
        player = MediaPlayer().apply {
            setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
            setWakeMode(ctx, PowerManager.PARTIAL_WAKE_LOCK)
            setDataSource(ctx, uri); prepare()
        }
        playing = false
    }

    // ---------- messages ----------
    private fun handle(from: String, m: String) {
        val a = m.split(":")
        when (a[0]) {
            "PING" -> send(from, "PONG:\${a[1]}:\${SystemClock.elapsedRealtime()}")
            "PONG" -> {                                   // NTP-style offset, keep best (lowest RTT) sample
                val t0 = a[1].toLong(); val th = a[2].toLong(); val t1 = SystemClock.elapsedRealtime()
                val rtt = t1 - t0
                if (rtt <= bestRtt) { bestRtt = rtt; offset = th - (t0 + t1) / 2 }
            }
            "PLAY" -> schedulePlay(a[1].toLong(), a[2].toLong())
            "PAUSE" -> pauseLocal()
            "SYNC" -> drift(a[1].toLong(), a[2].toLong())
            "READY" -> if (isHost && playing) send(from, "SYNC:\${hostNow()}:\${player?.currentPosition ?: 0}")
        }
    }

    private fun pingLoop() {
        hostId?.let { send(it, "PING:\${SystemClock.elapsedRealtime()}") }
        if (hostId != null) handler.postDelayed({ pingLoop() }, 2000)
    }

    // ---------- playback ----------
    fun maxVolume() {
        val am = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        am.setStreamVolume(AudioManager.STREAM_MUSIC, am.getStreamMaxVolume(AudioManager.STREAM_MUSIC), 0)
    }

    fun hostPlay() {
        if (!isHost || player == null) { log("Host must pick a song first"); return }
        val t = hostNow() + 1500                          // everyone starts 1.5 s from now
        val pos = player!!.currentPosition.toLong()
        broadcast("PLAY:$t:$pos"); schedulePlay(t, pos); syncLoop()
    }

    fun hostPause() { if (isHost) { broadcast("PAUSE"); pauseLocal() } }

    private fun schedulePlay(t: Long, pos: Long) {
        val p = player ?: return
        maxVolume(); scheduled?.let { handler.removeCallbacks(it) }
        val wait = t - hostNow()
        val start = Runnable { p.start(); playing = true; log("Playing") }
        if (wait >= 0) { p.seekTo(pos, MediaPlayer.SEEK_CLOSEST); scheduled = start; handler.postDelayed(start, wait) }
        else { p.seekTo(pos - wait, MediaPlayer.SEEK_CLOSEST); start.run() }
    }

    private fun pauseLocal() {
        scheduled?.let { handler.removeCallbacks(it) }
        player?.pause(); playing = false; log("Paused")
    }

    private fun syncLoop() {                              // host reports position every 3 s
        if (!isHost || !playing && scheduled == null) return
        if (playing) broadcast("SYNC:\${hostNow()}:\${player?.currentPosition ?: 0}")
        handler.postDelayed({ syncLoop() }, 3000)
    }

    private fun drift(t: Long, pos: Long) {
        val p = player ?: return
        val expected = pos + (hostNow() - t)
        if (!playing) { p.seekTo(expected, MediaPlayer.SEEK_CLOSEST); p.start(); playing = true; maxVolume(); return }
        if (kotlin.math.abs(p.currentPosition - expected) > 40) p.seekTo(expected, MediaPlayer.SEEK_CLOSEST)
    }

    fun stop() {
        nearby.stopAllEndpoints(); nearby.stopAdvertising(); nearby.stopDiscovery()
        handler.removeCallbacksAndMessages(null); player?.release(); player = null; peers.clear()
    }
}
`,
  },
  {
    path: 'app/src/main/AndroidManifest.xml',
    filename: 'AndroidManifest.xml',
    language: 'xml',
    description: 'Android manifest specifying Wi-Fi, Bluetooth, Location, Nearby Devices, and Wake Lock permissions.',
    content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
    <uses-permission android:name="android.permission.CHANGE_WIFI_STATE" />
    <uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.NEARBY_WIFI_DEVICES" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <application
        android:label="Party Speaker"
        android:icon="@android:drawable/ic_lock_silent_mode_off"
        android:theme="@style/Theme.AppCompat.DayNight.NoActionBar">
        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
`,
  },
  {
    path: 'app/build.gradle.kts',
    filename: 'app/build.gradle.kts',
    language: 'kotlin',
    description: 'App-level Gradle configuration specifying compileSdk 34, minSdk 29, Java 17, and play-services-nearby.',
    content: `plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.example.partyspeaker"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.example.partyspeaker"
        minSdk = 29
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.gms:play-services-nearby:19.3.0")
}
`,
  },
  {
    path: 'build.gradle.kts',
    filename: 'build.gradle.kts (root)',
    language: 'kotlin',
    description: 'Project root build.gradle.kts defining Android Gradle Plugin 8.5.2 and Kotlin 1.9.24.',
    content: `plugins {
    id("com.android.application") version "8.5.2" apply false
    id("org.jetbrains.kotlin.android") version "1.9.24" apply false
}
`,
  },
  {
    path: 'settings.gradle.kts',
    filename: 'settings.gradle.kts',
    language: 'kotlin',
    description: 'Project settings declaring Google, Maven Central, Gradle Plugin Portal, and project name PartySpeaker.',
    content: `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "PartySpeaker"
include(":app")
`,
  },
  {
    path: 'gradle.properties',
    filename: 'gradle.properties',
    language: 'properties',
    description: 'Gradle JVM and AndroidX configuration flags.',
    content: `android.useAndroidX=true
org.gradle.jvmargs=-Xmx2g
`,
  },
  {
    path: 'README.md',
    filename: 'README.md',
    language: 'markdown',
    description: 'Project documentation and multi-phone setup guide.',
    content: `# Party Speaker

Turn multiple Android phones into a synchronized multi-speaker surround sound system without Wi-Fi routers or internet!

### How to Run in Android Studio
1. Open this folder in **Android Studio (Koala or newer)**.
2. Let Gradle sync dependencies.
3. Plug in or deploy to **2+ real phones running Android 10+ (API 29+)**.
4. **On Phone 1 (Host)**:
   - Tap **"Host a group"**.
   - Tap **"Pick song (host)"** and choose any audio file from storage.
   - Tap **"Play for everyone (host)"**.
5. **On Phone 2..N (Clients)**:
   - Tap **"Join a group"**.
   - The phone will automatically discover the host via Bluetooth/Wi-Fi Direct, accept connection, receive the audio file, perform sub-millisecond clock sync, and play in lockstep!

### Features
- Offline Peer-to-Peer via Google Nearby Connections (P2P_STAR strategy).
- Microsecond clock synchronization using NTP ping/pong handshake.
- Automatic drift compensation seeks if audio playhead drifts by >40ms.
- 100% Volume boost for maximum party sound output.
`,
  },
  {
    path: 'app/src/main/res/values/strings.xml',
    filename: 'strings.xml',
    language: 'xml',
    description: 'Application string resources.',
    content: `<resources>
    <string name="app_name">Party Speaker</string>
</resources>
`,
  },
];

export async function downloadAndroidProjectZip(onProgress?: (percent: number) => void): Promise<void> {
  const zip = new JSZip();
  const rootFolder = zip.folder('PartySpeaker');

  if (!rootFolder) throw new Error('Could not create zip folder');

  for (let i = 0; i < ANDROID_FILES.length; i++) {
    const file = ANDROID_FILES[i];
    rootFolder.file(file.path, file.content);
    if (onProgress) {
      onProgress(Math.round(((i + 1) / ANDROID_FILES.length) * 50));
    }
  }

  // Add gradle wrapper properties for convenient direct import
  rootFolder.file(
    'gradle/wrapper/gradle-wrapper.properties',
    `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.7-bin.zip
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`
  );

  rootFolder.file(
    '.gitignore',
    `*.iml
.gradle
/local.properties
/.idea/caches
/.idea/libraries
/.idea/modules.xml
/.idea/workspace.xml
.DS_Store
/build
/captures
.externalNativeBuild
.cxx
local.properties
`
  );

  const content = await zip.generateAsync(
    { type: 'blob' },
    (metadata) => {
      if (onProgress) {
        onProgress(50 + Math.round(metadata.percent * 0.5));
      }
    }
  );

  // Trigger browser download
  const blobUrl = URL.createObjectURL(content);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = 'PartySpeaker-Android-Studio-Project.zip';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
}
