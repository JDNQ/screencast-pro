# Kiến Trúc Hệ Thống ScreenCast Pro (Multi Display)

## 1. Giới thiệu tổng quan
**ScreenCast Pro** là giải pháp phần mềm cho phép truyền và chiếu hình ảnh/màn hình điện thoại (iOS / Android) lên máy tính trong mạng Wi-Fi nội bộ thông qua mã PIN kết nối 6 chữ số và mã QR tiện lợi.

---

## 2. Mô hình Kiến trúc Kỹ thuật (System Architecture)

```
+-------------------------------------------------------------+
|                     PC RECEIVER (Máy tính)                   |
|                                                             |
|  [Node.js Core Server]                                      |
|  ├── HTTP (Port 3000)  <-- Web UI Dashboard (HUD) & LAN     |
|  ├── HTTPS (Port 3443) <-- Local TLS for Secure Web APIs    |
|  └── WebSocket Engine  <-- Session, Signaling & Frame Relay |
|                                                             |
|  [Web UI Controller] (Vanilla ES6, HTML5 Video & Canvas)    |
|  ├── RTCPeerConnection (MediaStream Video Receiver)         |
|  ├── Canvas Fallback (Direct WebSocket JPEG Frames)         |
|  ├── Stream Controls: Rotate, Snapshot, WebM Recorder       |
|  └── Diagnostics: Real-time Stats via getStats() (FPS, RTT) |
+------------------------------▲------------------------------+
                               │
            WebRTC P2P (Local LAN Video Stream)
            WebSocket Signaling (Handshake & ICE Candidates)
            Direct WebSocket Binary (Fallback / ReplayKit)
                               │
+------------------------------▼------------------------------+
|                    MOBILE SENDER (Điện thoại)                |
|                                                             |
|  [Tier 1: Web Instant Cast] (iOS Safari & Android Chrome)   |
|  ├── Nhập mã PIN 6 chữ số hoặc quét mã QR                   |
|  ├── Kết nối HTTP/WebSocket trong mạng LAN                  |
|  ├── Camera HD / Soi tài liệu bàn làm việc                  |
|  └── Live Interactive Touch Canvas Whiteboard Mirror        |
|                                                             |
|  [Tier 2: Apple iOS ReplayKit Broadcast] (iPhone / iPad)    |
|  ├── RPSystemBroadcastPickerView Launcher                   |
|  ├── RPBroadcastSampleHandler (Background Screen Capture)   |
|  └── Truyền khung hình nhị phân qua WebSocket trực tiếp     |
|  * Ghi chú: AirPlay Mirroring thật cần receiver chuyên dụng  |
|    như UxPlay / AirServer (xem hướng dẫn đi kèm)             |
|                                                             |
|  [Tier 3: Android Native MediaProjection] (Samsung/Xiaomi)  |
|  ├── Foreground Service với Notification (Android 14+)      |
|  ├── MediaProjection Capture & VirtualDisplay               |
|  └── WebRTC / Frame Streamer                                |
|                                                             |
|  [Tier 4: Scrcpy Wi-Fi Engine]                              |
|  └── Wireless Debugging ADB Pairing                         |
+-------------------------------------------------------------+
```

---

## 3. Quy trình Bắt tay & Kết nối (Handshake Flow)

1. **Khởi tạo phiên (Session Generation):**
   - Khi PC mở ứng dụng, máy tính gửi yêu cầu tới `/api/session/new`.
   - Server phát sinh `Session ID` dạng `CAST-XXXXXX` cùng mã PIN 6 chữ số và `receiverToken` ngẫu nhiên bảo mật.
   - Server tự động phát hiện IP LAN vật lý (loại bỏ adapter ảo Hyper-V, WSL, VMware, v.v.).
   - Tạo mã QR và đường dẫn truy cập cho thiết bị di động.

2. **Kết nối & Xác thực (Discovery & Authentication):**
   - Người dùng có thể nhập mã PIN 6 chữ số trên trình duyệt di động hoặc quét mã QR.
   - Thiết bị di động gửi yêu cầu xác thực qua API `/api/session/verify`.
   - Cả máy tính (Receiver) và điện thoại (Sender) kết nối tới WebSocket Signaling và đăng ký phòng theo `Session ID`.

3. **Báo hiệu WebRTC (Signaling Exchange):**
   - Thiết bị di động tạo `Offer` SDP, gửi qua WebSocket.
   - Máy tính nhận `Offer`, khởi tạo mới `RTCPeerConnection` và gửi `Answer` SDP.
   - Trao đổi `ICE Candidates` có hàng đợi (queue) để tránh lỗi ứng viên đến trước `setRemoteDescription`.

4. **Hiển thị & Chẩn đoán thực tế (Display & Diagnostics):**
   - Luồng video được hiển thị trên thẻ `<video>` hoặc `<canvas>` fallback.
   - HUD đo lường chỉ số thực tế từ `RTCPeerConnection.getStats()` (FPS, RTT thực) thay vì dữ liệu mô phỏng.
   - Các công cụ bổ trợ: xoay hình 90/180/270°, chụp ảnh màn hình chính xác theo góc quay, ghi video WebM.
