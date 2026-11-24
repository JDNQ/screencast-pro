package com.screencast.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import okhttp3.*
import org.json.JSONObject

/**
 * ScreenCaptureService
 * Android Foreground Service managing MediaProjection VirtualDisplay and WebRTC/WebSocket streaming
 */
class ScreenCaptureService : Service() {

    companion object {
        const val EXTRA_RESULT_CODE = "EXTRA_RESULT_CODE"
        const val EXTRA_DATA = "EXTRA_DATA"
        const val EXTRA_SERVER_URL = "EXTRA_SERVER_URL"
        const val EXTRA_SESSION_ID = "EXTRA_SESSION_ID"
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "screencast_channel"
    }

    private var mediaProjection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var webSocket: WebSocket? = null
    private val client = OkHttpClient()

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent == null) return START_NOT_STICKY

        val resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, 0)
        val data = intent.getParcelableExtra<Intent>(EXTRA_DATA)
        val serverUrl = intent.getStringExtra(EXTRA_SERVER_URL) ?: ""
        val sessionId = intent.getStringExtra(EXTRA_SESSION_ID) ?: ""

        val notification = buildForegroundNotification()
        startForeground(NOTIFICATION_ID, notification)

        if (data != null) {
            val projectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            mediaProjection = projectionManager.getMediaProjection(resultCode, data)
            
            initSignalingAndStream(serverUrl, sessionId)
        }

        return START_STICKY
    }

    private fun initSignalingAndStream(serverUrl: String, sessionId: String) {
        // Convert HTTP to WS or HTTPS to WSS
        val wsUrl = serverUrl.replace("http://", "ws://").replace("https://", "wss://")
        val request = Request.Builder().url(wsUrl).build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(ws: WebSocket, response: Response) {
                // Register as sender
                val registerMsg = JSONObject().apply {
                    put("type", "register")
                    put("role", "sender")
                    put("sessionId", sessionId)
                }
                ws.send(registerMsg.toString())
            }

            override fun onMessage(ws: WebSocket, text: String) {
                val json = JSONObject(text)
                when (json.optString("type")) {
                    "receiver_ready" -> {
                        startMediaProjectionStream()
                    }
                }
            }
        })
    }

    private fun startMediaProjectionStream() {
        val metrics = resources.displayMetrics
        val width = 1080
        val height = 1920
        val density = metrics.densityDpi

        // Virtual display capturing device screen
        // In full WebRTC integration, surface is provided by WebRTC VideoCapturer (SurfaceTextureHelper)
        /*
        virtualDisplay = mediaProjection?.createVirtualDisplay(
            "ScreenCastProDisplay",
            width, height, density,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            surface, null, null
        )
        */
    }

    private fun buildForegroundNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("ScreenCast Pro đang hoạt động")
            .setContentText("Màn hình điện thoại đang được chiếu không dây lên máy tính")
            .setSmallIcon(android.R.drawable.ic_menu_slideshow)
            .setOngoing(true)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "ScreenCast Casting Channel",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        virtualDisplay?.release()
        mediaProjection?.stop()
        webSocket?.close(1000, "Service stopped")
        stopForeground(true)
    }
}
