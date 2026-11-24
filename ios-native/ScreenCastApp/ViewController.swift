import UIKit
import AVFoundation
import ReplayKit

/**
 * ScreenCast Pro - iOS Host Application Controller
 * Handles Camera QR Code Scanning & Triggers System Screen Broadcast
 */
class ViewController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {

    private var captureSession: AVCaptureSession?
    private var previewLayer: AVCaptureVideoPreviewLayer?
    
    private var serverUrl: String = ""
    private var sessionId: String = ""

    private let statusLabel: UILabel = {
        let label = UILabel()
        label.text = "Hướng camera về phía mã QR trên máy tính"
        label.textColor = .white
        label.textAlignment = .center
        label.numberOfLines = 0
        label.font = UIFont.systemFont(ofSize: 16, weight: .medium)
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()

    private let titleLabel: UILabel = {
        let label = UILabel()
        label.text = "ScreenCast Pro iOS"
        label.textColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
        label.font = UIFont.systemFont(ofSize: 24, weight: .bold)
        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()

    private let qrFrameView: UIView = {
        let view = UIView()
        view.layer.borderColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0).cgColor
        view.layer.borderWidth = 2
        view.layer.cornerRadius = 12
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }()

    private var broadcastPicker: RPSystemBroadcastPickerView?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.04, green: 0.05, blue: 0.09, alpha: 1.0)

        setupUI()
        setupQRScanner()
    }

    private func setupUI() {
        view.addSubview(titleLabel)
        view.addSubview(qrFrameView)
        view.addSubview(statusLabel)

        NSLayoutConstraint.activate([
            titleLabel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 20),
            titleLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),

            qrFrameView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            qrFrameView.centerYAnchor.constraint(equalTo: view.centerYAnchor, constant: -40),
            qrFrameView.widthAnchor.constraint(equalToConstant: 250),
            qrFrameView.heightAnchor.constraint(equalToConstant: 250),

            statusLabel.topAnchor.constraint(equalTo: qrFrameView.bottomAnchor, constant: 24),
            statusLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            statusLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20)
        ])

        // Configure ReplayKit Broadcast Picker
        let picker = RPSystemBroadcastPickerView(frame: CGRect(x: 0, y: 0, width: 60, height: 60))
        picker.preferredExtension = "com.screencast.app.ScreenCastExtension"
        picker.showsMicrophoneButton = false
        picker.translatesAutoresizingMaskIntoConstraints = false
        picker.isHidden = true
        view.addSubview(picker)
        self.broadcastPicker = picker

        NSLayoutConstraint.activate([
            picker.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 20),
            picker.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            picker.widthAnchor.constraint(equalToConstant: 60),
            picker.heightAnchor.constraint(equalToConstant: 60)
        ])
    }

    private func setupQRScanner() {
        guard let videoCaptureDevice = AVCaptureDevice.default(for: .video) else { return }

        do {
            let videoInput = try AVCaptureDeviceInput(device: videoCaptureDevice)
            let captureSession = AVCaptureSession()

            if captureSession.canAddInput(videoInput) {
                captureSession.addInput(videoInput)
            }

            let metadataOutput = AVCaptureMetadataOutput()
            if captureSession.canAddOutput(metadataOutput) {
                captureSession.addOutput(metadataOutput)
                metadataOutput.setMetadataObjectsDelegate(self, queue: DispatchQueue.main)
                metadataOutput.metadataObjectTypes = [.qr]
            }

            let previewLayer = AVCaptureVideoPreviewLayer(session: captureSession)
            previewLayer.frame = view.layer.bounds
            previewLayer.videoGravity = .resizeAspectFill
            view.layer.insertSublayer(previewLayer, at: 0)

            self.previewLayer = previewLayer
            self.captureSession = captureSession

            DispatchQueue.global(qos: .userInitiated).async {
                captureSession.startRunning()
            }
        } catch {
            statusLabel.text = "Không thể khởi tạo camera quét mã"
        }
    }

    func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput metadataObjects: [AVMetadataObject], from connection: AVCaptureConnection) {
        if let metadataObject = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
           let qrString = metadataObject.stringValue {

            captureSession?.stopRunning()
            AudioServicesPlaySystemSound(SystemSoundID(kSystemSoundID_Vibrate))
            handleScannedQR(qrString)
        }
    }

    private func handleScannedQR(_ qrUrlString: String) {
        guard let url = URL(string: qrUrlString),
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            statusLabel.text = "Mã QR không hợp lệ"
            return
        }

        self.sessionId = components.queryItems?.first(where: { $0.name == "session" })?.value ?? ""
        self.serverUrl = "\(url.scheme ?? "http")://\(url.host ?? ""):\(url.port ?? 3000)"

        // Save to shared App Group for Broadcast Extension
        let sharedDefaults = UserDefaults(suiteName: "group.com.screencast.app")
        sharedDefaults?.set(self.sessionId, forKey: "session_id")
        sharedDefaults?.set(self.serverUrl, forKey: "server_url")

        statusLabel.text = "✅ ĐÃ GHÉP NỐI VỚI MÁY TÍNH!\nPhiên: \(sessionId)\nNhấn biểu tượng bên dưới để Bắt Đầu Chiếu Toàn Màn Hình"
        broadcastPicker?.isHidden = false
    }
}
