import UIKit
import ReplayKit

/**
 * ScreenCast Pro - iOS Host Application Controller
 * Connects via 6-digit Cast ID / PIN code and launches system screen broadcast
 */
class ViewController: UIViewController {

    private var serverUrl: String = ""
    private var sessionId: String = ""

    private let titleLabel: UILabel = {
        let label = UILabel()
        label.text = "ScreenCast Pro iOS"
        label.textColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
        label.font = UIFont.systemFont(ofSize: 26, weight: .bold)
        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()

    private let subtitleLabel: UILabel = {
        let label = UILabel()
        label.text = "Nhập Mã ID hiển thị trên máy tính để kết nối"
        label.textColor = UIColor(red: 0.58, green: 0.64, blue: 0.72, alpha: 1.0)
        label.font = UIFont.systemFont(ofSize: 14, weight: .regular)
        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()

    private let ipTextField: UITextField = {
        let tf = UITextField()
        tf.placeholder = "Địa chỉ IP máy tính (VD: 192.168.1.188)"
        tf.textColor = .white
        tf.backgroundColor = UIColor(red: 0.12, green: 0.16, blue: 0.24, alpha: 1.0)
        tf.layer.cornerRadius = 10
        tf.layer.borderWidth = 1
        tf.layer.borderColor = UIColor(white: 1.0, alpha: 0.1).cgColor
        tf.font = UIFont.monospacedSystemFont(ofSize: 15, weight: .medium)
        tf.textAlignment = .center
        tf.autocorrectionType = .no
        tf.autocapitalizationType = .none
        tf.translatesAutoresizingMaskIntoConstraints = false
        return tf
    }()

    private let pinTextField: UITextField = {
        let tf = UITextField()
        tf.placeholder = "MÃ PIN 6 CHỮ SỐ"
        tf.textColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
        tf.backgroundColor = UIColor(red: 0.12, green: 0.16, blue: 0.24, alpha: 1.0)
        tf.layer.cornerRadius = 12
        tf.layer.borderWidth = 2
        tf.layer.borderColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.5).cgColor
        tf.font = UIFont.monospacedSystemFont(ofSize: 22, weight: .bold)
        tf.textAlignment = .center
        tf.keyboardType = .asciiCapable
        tf.autocorrectionType = .no
        tf.autocapitalizationType = .allCharacters
        tf.translatesAutoresizingMaskIntoConstraints = false
        return tf
    }()

    private let connectButton: UIButton = {
        let btn = UIButton(type: .system)
        btn.setTitle("⚡ Kết Nối Với Máy Tính", for: .normal)
        btn.setTitleColor(UIColor(red: 0.06, green: 0.09, blue: 0.16, alpha: 1.0), for: .normal)
        btn.backgroundColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
        btn.layer.cornerRadius = 12
        btn.titleLabel?.font = UIFont.systemFont(ofSize: 16, weight: .bold)
        btn.translatesAutoresizingMaskIntoConstraints = false
        return btn
    }()

    private let statusLabel: UILabel = {
        let label = UILabel()
        label.text = "Sẵn sàng kết nối qua Mã ID"
        label.textColor = .white
        label.textAlignment = .center
        label.numberOfLines = 0
        label.font = UIFont.systemFont(ofSize: 14, weight: .medium)
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()

    private var broadcastPicker: RPSystemBroadcastPickerView?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.04, green: 0.05, blue: 0.09, alpha: 1.0)

        setupUI()
        loadSavedSettings()
    }

    private func setupUI() {
        view.addSubview(titleLabel)
        view.addSubview(subtitleLabel)
        view.addSubview(ipTextField)
        view.addSubview(pinTextField)
        view.addSubview(connectButton)
        view.addSubview(statusLabel)

        NSLayoutConstraint.activate([
            titleLabel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 40),
            titleLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),

            subtitleLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 8),
            subtitleLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),

            ipTextField.topAnchor.constraint(equalTo: subtitleLabel.bottomAnchor, constant: 36),
            ipTextField.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            ipTextField.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            ipTextField.heightAnchor.constraint(equalToConstant: 48),

            pinTextField.topAnchor.constraint(equalTo: ipTextField.bottomAnchor, constant: 16),
            pinTextField.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            pinTextField.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            pinTextField.heightAnchor.constraint(equalToConstant: 56),

            connectButton.topAnchor.constraint(equalTo: pinTextField.bottomAnchor, constant: 20),
            connectButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            connectButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            connectButton.heightAnchor.constraint(equalToConstant: 52),

            statusLabel.topAnchor.constraint(equalTo: connectButton.bottomAnchor, constant: 24),
            statusLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            statusLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20)
        ])

        connectButton.addTarget(self, action: #selector(handleConnect), for: .touchUpInside)

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

    private func loadSavedSettings() {
        let defaults = UserDefaults.standard
        ipTextField.text = defaults.string(forKey: "saved_ip") ?? "192.168.1.188"
        pinTextField.text = defaults.string(forKey: "saved_pin") ?? ""
    }

    @objc private func handleConnect() {
        view.endEditing(true)
        guard let ip = ipTextField.text?.trimmingCharacters(in: .whitespacesAndNewlines), !ip.isEmpty,
              let pin = pinTextField.text?.trimmingCharacters(in: .whitespacesAndNewlines), !pin.isEmpty else {
            statusLabel.text = "Vui lòng nhập IP máy tính và Mã PIN"
            return
        }

        let host = ip.contains(":") ? ip : "\(ip):3000"
        let normalizedPin = pin.uppercased().hasPrefix("CAST-") ? pin.uppercased() : "CAST-\(pin.uppercased())"
        let checkUrlString = "http://\(host)/api/session/verify?id=\(normalizedPin)"

        guard let checkUrl = URL(string: checkUrlString) else {
            statusLabel.text = "Địa chỉ máy tính không hợp lệ"
            return
        }

        statusLabel.text = "Đang kiểm tra kết nối tới máy tính..."

        URLSession.shared.dataTask(with: checkUrl) { [weak self] data, response, error in
            DispatchQueue.main.async {
                guard let self = self else { return }
                if let error = error {
                    self.statusLabel.text = "❌ Không thể kết nối tới PC (\(error.localizedDescription))\nHãy đảm bảo cùng mạng Wi-Fi."
                    return
                }

                self.sessionId = normalizedPin
                self.serverUrl = "http://\(host)"

                // Save to shared App Group for Broadcast Extension
                let sharedDefaults = UserDefaults(suiteName: "group.com.screencast.app")
                sharedDefaults?.set(self.sessionId, forKey: "session_id")
                sharedDefaults?.set(self.serverUrl, forKey: "server_url")

                UserDefaults.standard.set(ip, forKey: "saved_ip")
                UserDefaults.standard.set(pin, forKey: "saved_pin")

                self.statusLabel.text = "✅ ĐÃ GHÉP NỐI VỚI MÁY TÍNH THÀNH CÔNG!\nChạm biểu tượng bên dưới để Bắt Đầu Chiếu Toàn Màn Hình"
                self.broadcastPicker?.isHidden = false
            }
        }.resume()
    }
}
