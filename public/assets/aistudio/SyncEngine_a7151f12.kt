package com.example.partyspeaker

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
            if (isHost) { log("Connected: ${peers.size} device(s)"); songUri?.let { sendSong(id) } }
            else { hostId = id; nearby.stopDiscovery(); log("Joined the group"); pingLoop() }
        }
        override fun onDisconnected(id: String) { peers.remove(id); log("Device left (${peers.size} connected)") }
    }

    fun startHost() {
        isHost = true; offset = 0
        nearby.startAdvertising(name, serviceId, lifecycle,
            AdvertisingOptions.Builder().setStrategy(strategy).build())
            .addOnSuccessListener { log("Hosting as $name. Ask friends to tap Join.") }
            .addOnFailureListener { log("Host error: ${it.message}") }
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
            .addOnFailureListener { log("Join error: ${it.message}") }
    }

    // ---------- song transfer ----------
    fun setSong(uri: Uri) {
        songUri = uri; load(uri); log("Song ready. Sending to ${peers.size} device(s)...")
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
                incoming[u.payloadId]?.let { log("Receiving song ${u.bytesTransferred * 100 / u.totalBytes}%") }
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
            "PING" -> send(from, "PONG:${a[1]}:${SystemClock.elapsedRealtime()}")
            "PONG" -> {                                   // NTP-style offset, keep best (lowest RTT) sample
                val t0 = a[1].toLong(); val th = a[2].toLong(); val t1 = SystemClock.elapsedRealtime()
                val rtt = t1 - t0
                if (rtt <= bestRtt) { bestRtt = rtt; offset = th - (t0 + t1) / 2 }
            }
            "PLAY" -> schedulePlay(a[1].toLong(), a[2].toLong())
            "PAUSE" -> pauseLocal()
            "SYNC" -> drift(a[1].toLong(), a[2].toLong())
            "READY" -> if (isHost && playing) send(from, "SYNC:${hostNow()}:${player?.currentPosition ?: 0}")
        }
    }

    private fun pingLoop() {
        hostId?.let { send(it, "PING:${SystemClock.elapsedRealtime()}") }
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
        if (playing) broadcast("SYNC:${hostNow()}:${player?.currentPosition ?: 0}")
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
