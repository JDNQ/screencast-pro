package com.screencast.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import androidx.core.app.NotificationCompat
import okhttp3.*
import okio.ByteString.Companion.toByteString
import org.json.JSONObject
import java.io.ByteArrayOutputStream

/**
 * ScreenCaptureService
 * Android Foreground Service managing MediaProjection VirtualDisplay and direct WebSocket frame streaming
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
    private var imageReader: ImageReader? = null
    private var imageHandlerThread: HandlerThread? = null
    private var imageHandler: Handler? = null

    private var webSocket: WebSocket? = null
    private val client = OkHttpClient()
    private var isStreaming = false
    private var lastFrameTime = 0L
    private val frameIntervalMs = 33L // ~30 FPS throttle to maintain smooth CPU & network

    private val projectionCallback = object : MediaProjection.Callback() {
        override fun onStop() {
            super.onStop()
            stopStreaming()
            stopSelf()
        }
    }

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

        // Android 14 (API 34) requires FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        if (data != null) {
            val projectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            mediaProjection = projectionManager.getMediaProjection(resultCode, data)

            // Register mandatory callback on Android 14+
            mediaProjection?.registerCallback(projectionCallback, null)

            initSignalingAndStream(serverUrl, sessionId)
        }

        return START_NOT_STICKY
    }

    private fun initSignalingAndStream(serverUrl: String, sessionId: String) {
        // Force plain ws:// on local network to avoid self-signed TLS certificate rejection
        val wsUrl = if (serverUrl.startsWith("https://")) {
            serverUrl.replace("https://", "ws://").replace(":3443", ":3000")
        } else if (serverUrl.startsWith("http://")) {
            serverUrl.replace("http://", "ws://")
        } else {
            "ws://$serverUrl"
        }

        val request = Request.Builder().url(wsUrl).build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(ws: WebSocket, response: Response) {
                val registerMsg = JSONObject().apply {
                    put("type", "register")
                    put("role", "sender")
                    put("sessionId", sessionId)
                }
                ws.send(registerMsg.toString())
            }

            override fun onMessage(ws: WebSocket, text: String) {
                try {
                    val json = JSONObject(text)
                    when (json.optString("type")) {
                        "receiver_ready" -> {
                            startScreenStream()
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        })
    }

    private fun startScreenStream() {
        if (isStreaming) return
        isStreaming = true

        val metrics = resources.displayMetrics
        val screenWidth = metrics.widthPixels
        val screenHeight = metrics.heightPixels

        // Maintain exact aspect ratio (e.g. 20:9, 19.5:9), scaling longest edge to at most 1280px
        val maxDim = 1280f
        val longestEdge = maxOf(screenWidth, screenHeight).toFloat()
        val scale = if (longestEdge > maxDim) maxDim / longestEdge else 1.0f

        val width = (((screenWidth * scale).toInt()) / 2) * 2 // ensure even dimension for encoding
        val height = (((screenHeight * scale).toInt()) / 2) * 2
        val density = metrics.densityDpi

        imageHandlerThread = HandlerThread("ImageReaderThread").apply { start() }
        imageHandler = Handler(imageHandlerThread!!.looper)

        imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)
        imageReader?.setOnImageAvailableListener({ reader ->
            val now = System.currentTimeMillis()
            if (now - lastFrameTime < frameIntervalMs) {
                val drop = reader.acquireLatestImage()
                drop?.close()
                return@setOnImageAvailableListener
            }
            lastFrameTime = now

            val image = reader.acquireLatestImage() ?: return@setOnImageAvailableListener
            try {
                val planes = image.planes
                val buffer = planes[0].buffer
                val pixelStride = planes[0].pixelStride
                val rowStride = planes[0].rowStride
                val rowPadding = rowStride - pixelStride * width

                val bitmap = Bitmap.createBitmap(
                    width + rowPadding / pixelStride,
                    height,
                    Bitmap.Config.ARGB_8888
                )
                bitmap.copyPixelsFromBuffer(buffer)

                // Compress bitmap to JPEG stream
                val stream = ByteArrayOutputStream()
                val cropped = if (rowPadding == 0) bitmap else Bitmap.createBitmap(bitmap, 0, 0, width, height)
                cropped.compress(Bitmap.CompressFormat.JPEG, 70, stream)
                val byteArray = stream.toByteArray()

                // Send binary frame over WebSocket directly
                webSocket?.send(byteArray.toByteString())

                if (cropped != bitmap) cropped.recycle()
                bitmap.recycle()
            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                image.close()
            }
        }, imageHandler)

        virtualDisplay = mediaProjection?.createVirtualDisplay(
            "ScreenCastProDisplay",
            width, height, density,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            imageReader?.surface, null, null
        )
    }

    private fun stopStreaming() {
        isStreaming = false
        virtualDisplay?.release()
        virtualDisplay = null
        imageReader?.close()
        imageReader = null
        imageHandlerThread?.quitSafely()
        imageHandlerThread = null
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
        stopStreaming()
        mediaProjection?.unregisterCallback(projectionCallback)
        mediaProjection?.stop()
        webSocket?.close(1000, "Service stopped")
        stopForeground(true)
    }
}
