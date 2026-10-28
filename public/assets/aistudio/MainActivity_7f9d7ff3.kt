package com.example.partyspeaker

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
