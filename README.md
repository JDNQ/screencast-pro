# 📱 ScreenCast Pro - Multi Display

> Hệ thống phần mềm chia sẻ màn hình điện thoại (iOS & Android) lên máy tính thông qua mạng Wi-Fi nội bộ, hỗ trợ kết nối bằng **Mã PIN 6 chữ số** và **Mã QR**.

---

## 🌟 Tính Năng Hệ Thống

1. **Kết nối linh hoạt bằng Mã ID (PIN 6 chữ số) hoặc Quét mã QR:**
   - **Dành cho iOS (iPhone/iPad):** Không cần dùng camera quét mã, chỉ cần mở trình duyệt di động hoặc App nhập mã ID 6 chữ số hiển thị trên màn hình PC.
   - **Dành cho Android & Thiết bị khác:** Hỗ trợ quét mã QR để kết nối tự động.
2. **Hỗ trợ đa nền tảng (iOS & Android):**
   - **Apple iOS (iPhone / iPad):**
     * Kết nối qua Mã ID/PIN kết hợp ứng dụng ReplayKit Broadcast Extension (`ios-native/`).
     * Hướng dẫn giải pháp AirPlay Receiver (UxPlay / AirServer) cho Windows.
   - **Android (Samsung, Xiaomi, Oppo, Pixel...):**
     * Hướng dẫn sử dụng tính năng phản chiếu màn hình có sẵn (Smart View / Cast).
     * Dự án mã nguồn Android Native MediaProjection (`android-native/`).
     * Hỗ trợ công cụ Scrcpy qua Wi-Fi Debugging.
3. **Giao thức truyền phát thời gian thực:**
   - Hỗ trợ luồng WebRTC Peer-to-Peer trực tiếp trong mạng LAN nội bộ.
   - Hỗ trợ luồng Direct Binary Frame WebSocket cho ứng dụng ReplayKit iOS và Android.
4. **Bộ công cụ điều khiển trên PC Receiver:**
   - 🔄 **Xoay màn hình (Rotate):** 0°, 90°, 180°, 270° phù hợp cả khi xoay dọc hoặc xoay ngang.
   - 📸 **Chụp ảnh màn hình (Snapshot):** Chụp và tải ảnh độ phân giải gốc về máy tính (hỗ trợ cả chế độ WebRTC và Canvas).
   - ⏺️ **Ghi hình (Screen Record):** Ghi lại phiên chiếu thành file video `.webm`.
   - ⛶ **Toàn màn hình (Fullscreen) & Tỷ lệ (Fit/Fill):** Tùy chỉnh hiển thị theo khung hình.
   - 📊 **HUD Diagnostics thực tế:** Đo FPS và độ trễ Round-Trip Time thực qua `RTCPeerConnection.getStats()`.

---

## 🚀 Hướng Dẫn Cài Đặt & Sử Dụng

### Bước 1: Khởi động trên Máy tính (PC)
* **Cách 1 (Nhanh nhất):** Nhấp đúp chuột vào file **`start.bat`**
* **Cách 2:** Mở Terminal và chạy:
  ```bash
  npm start
  ```

Trình duyệt trên PC sẽ tự động mở trang Receiver tại:
```
http://localhost:3000
```

> **Lưu ý tường lửa (Firewall):** Nếu điện thoại không kết nối được vào PC, hãy chạy file **`scripts/setup_firewall.bat`** (bằng quyền Administrator) để mở các cổng 3000, 3443 và 5353 trong mạng Private.

---

### Bước 2: Kết nối từ Điện Thoại

#### 🍎 Đối với iPhone / iPad (iOS):
* **Cách 1 (Mã PIN trên Trình duyệt):**
  1. Đảm bảo iPhone và máy tính cùng mạng Wi-Fi.
  2. Mở Safari trên iPhone gõ: `http://<IP_MÁY_TÍNH>:3000/mobile`
  3. Nhập mã PIN 6 chữ số hiển thị trên máy tính -> Bấm **Kết Nối**.
  4. Chọn nguồn phát: Camera HD hoặc Bảng vẽ tương tác.
  *(Lưu ý: Do chính sách bảo mật của Apple, trình duyệt web Safari bị chặn quay màn hình ngoài).*
* **Cách 2 (Chiếu toàn bộ màn hình qua AirPlay):**
  - Để Windows nhận được AirPlay từ iPhone, máy tính cần cài một phần mềm AirPlay Receiver thật (khuyên dùng [uxplay-windows](https://github.com/leapbtw/uxplay-windows/releases) có khay hệ thống hoặc AirServer). Xem hướng dẫn chi tiết tại file `scripts/start_ios_airplay.bat`.
* **Cách 3 (App iOS Native ReplayKit):**
  - Mở thư mục `ios-native/` bằng Xcode để cài app lên iPhone. App sẽ sử dụng Apple ReplayKit Broadcast Extension để quay toàn màn hình và gửi về PC qua mã PIN.

#### 🤖 Đối với Android (Samsung, Xiaomi, Oppo...):
* **Cách 1 (Không cần cài app - Tính năng có sẵn):**
  - Trên Windows: Nhấn tổ hợp phím **`Win + K`**. *(Yêu cầu Windows đã cài tính năng tùy chọn "Wireless Display" trong Settings > System > Optional Features).*
  - Trên điện thoại: Kéo thanh cài đặt nhanh xuống -> Chọn **Smart View** (Samsung) hoặc **Phát màn hình / Cast**.
* **Cách 2 (Quét mã QR hoặc nhập PIN):**
  - Mở Camera hoặc trình duyệt quét mã QR / nhập PIN trên trang web.
* **Cách 3 (Dùng Scrcpy Wi-Fi):**
  - Bật Gỡ lỗi không dây (Wireless Debugging) trên Android và chạy file `scripts/scrcpy_wireless_pair.bat`.

---

## 📁 Cấu Trúc Dự Án

```
Multi Display/
├── server.js                      # Core Server (HTTP, HTTPS, WebSocket & Session Management)
├── package.json                   # Cấu hình dự án và dependencies
├── package-lock.json              # Khóa phiên bản dependencies
├── start.bat                      # Phím tắt 1-click khởi chạy trên Windows
├── README.md                      # Tài liệu hướng dẫn sử dụng
├── ARCHITECTURE.md               # Đặc tả kỹ thuật kiến trúc hệ thống
├── public/                        # Giao diện Máy Tính (PC Receiver)
│   ├── index.html                 # Trang hiển thị mã PIN, mã QR và khung chiếu
│   ├── css/style.css              # Giao diện Dark Glassmorphism
│   └── js/app.js                  # Xử lý WebRTC Receiver, Canvas fallback, HUD thực tế
├── mobile-client/                 # Giao diện Điện Thoại (Mobile Web Client)
│   ├── index.html                 # Giao diện nhập mã PIN và chọn nguồn phát
│   ├── css/mobile.css             # Thiết kế tối ưu cho màn hình cảm ứng di động
│   └── js/sender.js               # Bộ phát WebRTC Sender (Camera, Screen, Whiteboard)
├── ios-native/                    # Dự án iOS Swift (ReplayKit Broadcast Extension)
│   ├── ScreenCastApp/             # App chính với giao diện nhập PIN
│   └── ScreenCastExtension/       # Broadcast Upload Extension quay toàn màn hình iOS
├── android-native/                # Dự án Android Native (MediaProjection)
│   ├── build.gradle               # Root build script
│   ├── settings.gradle            # Settings project
│   └── app/src/main/
│       ├── AndroidManifest.xml    # Quyền Foreground Service & MediaProjection
│       └── java/com/screencast/app/
│           ├── MainActivity.kt    # Quét mã QR & xin quyền hệ thống
│           └── ScreenCaptureService.kt # Dịch vụ ghi hình màn hình nền Android 14+
└── scripts/
    ├── scrcpy_wireless_pair.bat   # Script tự động ghép nối Scrcpy qua Wi-Fi
    ├── start_ios_airplay.bat      # Hướng dẫn và khởi động giải pháp AirPlay Windows
    └── setup_firewall.bat         # Script mở Windows Firewall cho mạng LAN
```
