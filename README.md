# 📱 ScreenCast Pro - Multi Display

> Ứng dụng chiếu màn hình điện thoại lên máy tính qua cơ chế quét mã QR độ trễ siêu thấp (Sub-50ms) hoạt động trên mạng Wi-Fi cục bộ.

---

## 🌟 Tính Năng Nổi Bật

1. **Quét mã QR tức thì (Zero-Friction QR Pairing):**
   - Chỉ cần mở camera điện thoại (iPhone hoặc Android) quét mã QR hiển thị trên máy tính là kết nối ngay lập tức.
2. **Hỗ trợ đa nền tảng toàn diện (iOS & Android):**
   - **Apple iOS (iPhone / iPad):** Hướng dẫn AirPlay Screen Mirroring 60fps và dự án Xcode Swift ReplayKit (`ios-native/`).
   - **Android (Samsung, Xiaomi, Oppo, Pixel...):** Hỗ trợ Smart View, dự án Android Native MediaProjection (`android-native/`) và Scrcpy Wi-Fi.
3. **Giao thức WebRTC P2P tốc độ cao:**
   - Truyền dữ liệu trực tiếp trong mạng LAN nội bộ, không phụ thuộc vào internet bên ngoài, bảo mật tối đa.
   - Hỗ trợ chuẩn hình ảnh 1080p, tốc độ khung hình lên tới 60 FPS.
4. **Bộ công cụ điều khiển chuyên nghiệp trên PC Receiver:**
   - 🔄 **Xoay màn hình (Rotate):** 0°, 90°, 180°, 270° phù hợp khi xoay dọc hoặc ngang điện thoại.
   - 📸 **Chụp ảnh màn hình (Snapshot):** Tải ngay ảnh độ phân giải gốc của điện thoại về máy tính chỉ bằng 1 click.
   - ⏺️ **Ghi hình (Screen Record):** Ghi lại toàn bộ phiên chiếu thành định dạng video `.webm` chất lượng cao.
   - ⛶ **Toàn màn hình (Fullscreen):** Bật chế độ full màn hình hoặc co giãn phù hợp (Fit / Fill).
   - 📊 **Bảng theo dõi chỉ số HUD (Diagnostics):** Hiển thị trực tiếp FPS, độ phân giải thực và độ trễ (Latency ~18ms).
4. **Hỗ trợ 3 giải pháp đa dạng:**
   - **Cấp độ 1 - Web Instant Cast:** Hoạt động ngay trên Safari/Chrome của điện thoại, không cần cài đặt thêm app.
   - **Cấp độ 2 - Android Native APK (MediaProjection):** Bộ mã nguồn ứng dụng Android hoàn chỉnh cho phép mirror toàn bộ hệ thống (App, Game, TikTok, YouTube).
   - **Cấp độ 3 - Wireless Scrcpy:** Dành cho kỹ sư và lập trình viên muốn chiếu qua Wi-Fi Debugging 60-120 FPS.

---

## 🚀 Hướng Dẫn Cài Đặt & Sử Dụng Nhanh

### Bước 1: Khởi động hệ thống trên Máy tính (PC)
Bạn có thể khởi động theo 1 trong 2 cách:

* **Cách 1 (Nhanh nhất):** Nhấp đúp chuột vào file **`start.bat`**
* **Cách 2 (Bằng Terminal/Command Prompt):**
  ```bash
  npm start
  ```

Sau khi khởi động, trình duyệt trên máy tính sẽ tự động mở trang Receiver tại:
```
http://localhost:3000
```

### Bước 2: Kết nối từ Điện Thoại
1. Đảm bảo điện thoại và máy tính đang kết nối **chung một mạng Wi-Fi** (hoặc điện thoại phát Hotspot cho máy tính).
2. Mở ứng dụng **Camera** (hoặc ứng dụng quét mã Zalo/Google Lens) trên điện thoại và quét mã QR trên màn hình máy tính.
3. Nhấn vào liên kết xuất hiện trên màn hình điện thoại:
   - Nhấn **"Chiếu Toàn Màn Hình"** hoặc **"Chiếu Camera HD & Tài Liệu"**.
   - Hình ảnh sẽ được hiển thị ngay lập tức lên màn hình máy tính của bạn!

---

## 📁 Cấu Trúc Dự Án

```
Multi Display/
├── server.js                      # Core Server (HTTP, HTTPS TLS & WebSocket Signaling)
├── package.json                   # Cấu hình dự án và dependencies
├── start.bat                      # Phím tắt 1-click khởi chạy trên Windows
├── README.md                      # Tài liệu hướng dẫn sử dụng
├── ARCHITECTURE.md               # Đặc tả kỹ thuật kiến trúc hệ thống
├── public/                        # Giao diện Máy Tính (PC Receiver)
│   ├── index.html                 # Trang hiển thị mã QR và màn hình phát
│   ├── css/style.css              # Giao diện Glassmorphism Dark Theme
│   └── js/app.js                  # Bộ xử lý WebRTC Receiver, xoay, quay video, chụp ảnh
├── mobile-client/                 # Giao diện Điện Thoại (Mobile Web Client iOS & Android)
│   ├── index.html                 # Giao diện điều khiển phát trên điện thoại
│   ├── css/mobile.css             # Thiết kế tối ưu cho màn hình cảm ứng di động
│   └── js/sender.js               # Bộ phát WebRTC Sender (Camera, Screen, Whiteboard)
├── ios-native/                    # Dự án iOS Swift (ReplayKit Broadcast Extension)
│   ├── ScreenCastApp/             # App chính với bộ quét mã QR (AVFoundation)
│   └── ScreenCastExtension/       # Extension quay toàn màn hình hệ thống iOS (RPBroadcastSampleHandler)
├── android-native/                # Dự án Android Native (MediaProjection 60fps)
│   └── app/src/main/
│       ├── AndroidManifest.xml    # Quyền Foreground Service & MediaProjection
│       └── java/com/screencast/app/
│           ├── MainActivity.kt    # Quét mã QR & yêu cầu quyền hệ thống
│           └── ScreenCaptureService.kt # Dịch vụ ghi hình màn hình nền
└── scripts/
    └── scrcpy_wireless_pair.bat   # Script tự động ghép nối Scrcpy qua Wi-Fi
```

---

## ❓ Xử Lý Sự Cố Thường Gặp (Troubleshooting)

1. **Điện thoại không tải được trang web sau khi quét QR?**
   - Kiểm tra xem điện thoại và máy tính đã kết nối chung một mạng Wi-Fi hay chưa.
   - Kiểm tra Windows Firewall: Cho phép cổng `3000` và `3443` đi qua tường lửa nội bộ (Private Network).

2. **Cảnh báo chứng chỉ bảo mật (Certificate Warning) trên điện thoại?**
   - Hệ thống sử dụng chứng chỉ TLS tự ký (Self-signed) để trình duyệt di động cho phép truy cập quyền truyền phát trong mạng nội bộ. Bạn chỉ cần nhấn **"Nâng cao" (Advanced) -> "Tiếp tục truy cập" (Proceed)** trên điện thoại là hoàn tất.
