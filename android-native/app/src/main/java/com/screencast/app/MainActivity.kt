package com.screencast.app

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.zxing.integration.android.IntentIntegrator

/**
 * ScreenCast Pro - Android Sender Main Activity
 * Handles runtime permissions, QR Code scanning & MediaProjection OS permission request
 */
class MainActivity : AppCompatActivity() {

    private lateinit var mediaProjectionManager: MediaProjectionManager
    private var serverUrl: String = ""
    private var sessionId: String = ""

    private lateinit var tvStatus: TextView
    private lateinit var btnScanQR: Button
    private lateinit var btnStopCast: Button

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val cameraGranted = permissions[Manifest.permission.CAMERA] ?: false
        if (cameraGranted) {
            startQRScan()
        } else {
            Toast.makeText(this, "Cần cấp quyền Camera để quét mã QR", Toast.LENGTH_SHORT).show()
        }
    }

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
            checkPermissionsAndScan()
        }

        btnStopCast.setOnClickListener {
            stopScreenCaptureService()
        }
    }

    private fun checkPermissionsAndScan() {
        val permissionsToRequest = mutableListOf(Manifest.permission.CAMERA)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        val allGranted = permissionsToRequest.all {
            ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED
        }

        if (allGranted) {
            startQRScan()
        } else {
            permissionLauncher.launch(permissionsToRequest.toTypedArray())
        }
    }

    private fun startQRScan() {
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
        try {
            val uri = android.net.Uri.parse(scannedUrl)
            sessionId = uri.getQueryParameter("session") ?: ""
            val port = if (uri.port != -1) uri.port else 3000
            serverUrl = "http://${uri.host}:$port"

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
