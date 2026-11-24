package com.screencast.app

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.google.zxing.integration.android.IntentIntegrator

/**
 * ScreenCast Pro - Android Sender Main Activity
 * Handles QR Code scanning & MediaProjection OS permission request
 */
class MainActivity : AppCompatActivity() {

    private lateinit var mediaProjectionManager: MediaProjectionManager
    private var serverUrl: String = ""
    private var sessionId: String = ""

    private lateinit var tvStatus: TextView
    private lateinit var btnScanQR: Button
    private lateinit var btnStopCast: Button

    private val screenCaptureLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK && result.data != null) {
            startScreenCaptureService(result.resultCode, result.data!!)
        } else {
            Toast.makeText(this, "Bạn đã từ chối cấp quyền ghi hình màn hình", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        tvStatus = findViewById(R.id.tvStatus)
        btnScanQR = findViewById(R.id.btnScanQR)
        btnStopCast = findViewById(R.id.btnStopCast)

        mediaProjectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager

        btnScanQR.setOnClickListener {
            initiateQRScanner()
        }

        btnStopCast.setOnClickListener {
            stopScreenCaptureService()
        }
    }

    private fun initiateQRScanner() {
        val integrator = IntentIntegrator(this)
        integrator.setPrompt("Hướng camera về phía mã QR trên màn hình máy tính")
        integrator.setBeepEnabled(true)
        integrator.setOrientationLocked(false)
        integrator.initiateScan()
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        val scanResult = IntentIntegrator.parseActivityResult(requestCode, resultCode, data)
        if (scanResult != null) {
            if (scanResult.contents != null) {
                handleScannedQRCode(scanResult.contents)
            } else {
                Toast.makeText(this, "Đã huỷ quét mã QR", Toast.LENGTH_SHORT).show()
            }
        } else {
            super.onActivityResult(requestCode, resultCode, data)
        }
    }

    private fun handleScannedQRCode(scannedUrl: String) {
        // Example URL: https://192.168.1.188:3443/mobile/?session=CAST-849201
        try {
            val uri = android.net.Uri.parse(scannedUrl)
            sessionId = uri.getQueryParameter("session") ?: ""
            serverUrl = "${uri.scheme}://${uri.host}:${uri.port}"

            tvStatus.text = "Đã quét thành công!\nPhiên: $sessionId\nMáy tính: $serverUrl"
            requestScreenCapture()
        } catch (e: Exception) {
            Toast.makeText(this, "Mã QR không đúng định dạng ScreenCast Pro", Toast.LENGTH_LONG).show()
        }
    }

    private fun requestScreenCapture() {
        val captureIntent = mediaProjectionManager.createScreenCaptureIntent()
        screenCaptureLauncher.launch(captureIntent)
    }

    private fun startScreenCaptureService(resultCode: Int, data: Intent) {
        val serviceIntent = Intent(this, ScreenCaptureService::class.java).apply {
            putExtra(ScreenCaptureService.EXTRA_RESULT_CODE, resultCode)
            putExtra(ScreenCaptureService.EXTRA_DATA, data)
            putExtra(ScreenCaptureService.EXTRA_SERVER_URL, serverUrl)
            putExtra(ScreenCaptureService.EXTRA_SESSION_ID, sessionId)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent)
        } else {
            startService(serviceIntent)
        }

        tvStatus.text = "ĐANG CHIẾU MÀN HÌNH LÊN MÁY TÍNH\n(Có thể thu nhỏ ứng dụng)"
        btnScanQR.isEnabled = false
        btnStopCast.isEnabled = true
    }

    private fun stopScreenCaptureService() {
        val serviceIntent = Intent(this, ScreenCaptureService::class.java)
        stopService(serviceIntent)

        tvStatus.text = "Đã dừng chia sẻ màn hình"
        btnScanQR.isEnabled = true
        btnStopCast.isEnabled = false
    }
}
