# Kiến Trúc Hệ Thống ScreenCast Pro (Multi Display)

## 1. Giới thiệu tổng quan
**ScreenCast Pro** là giải pháp phần mềm chuyên nghiệp cho phép truyền và chiếu trực tiếp màn hình điện thoại (iOS / Android) lên máy tính thông qua cơ chế quét mã QR tiện lợi, độ trễ cực thấp (Sub-50ms) trong mạng nội bộ (LAN / Wi-Fi).

---

## 2. Mô hình Kiến trúc Kỹ thuật (System Architecture)

```
+-------------------------------------------------------------+
|                     PC RECEIVER (Máy tính)                   |
|                                                             |
|  [Node.js Core Server]                                      |
|  ├── HTTP (Port 3000)  <-- Web UI Dashboard (HUD)           |
|  ├── HTTPS (Port 3443) <-- Self-Signed TLS for Media APIs   |
|  └── WebSocket Engine  <-- Session & WebRTC Signaling       |
|                                                             |
|  [Web UI Controller] (Vanilla ES6, Hardware Canvas/Video)   |
|  ├── RTCPeerConnection (MediaStream Video Receiver)         |
|  ├── Stream Controls: Rotate, Screenshot, WebM Recorder    |
|  └── Diagnostics: FPS Counter, Ping/Latency HUD             |
+------------------------------▲------------------------------+
                               │
            WebRTC P2P (Local LAN UDP Video Chunks)
            WebSocket Signaling (Handshake & ICE Candidates)
                               │
+------------------------------▼------------------------------+
|                    MOBILE SENDER (Điện thoại)                |
|                                                             |
|  [Tier 1: Web Instant Cast] (iOS Safari & Android Chrome)   |
|  ├── Native Camera App scans QR Code                        |
|  ├── Connects to HTTPS URL via Safari / Chrome              |
|  ├── High-Definition Camera / Document Mirroring (1080p)    |
|  └── Live Interactive Touch Canvas Whiteboard Mirror        |
|                                                             |
|  [Tier 2: Apple iOS ReplayKit Broadcast] (iPhone / iPad)    |
|  ├── AVCaptureSession QR Scanner                            |
|  ├── RPSystemBroadcastPickerView Launcher                   |
|  ├── RPBroadcastSampleHandler (Background Screen Capture)   |
|  └── Real-time WebSocket / WebRTC Streaming                 |
|                                                             |
|  [Tier 3: Android Native MediaProjection] (Samsung/Xiaomi)  |
|  ├── CameraX / ZXing QR Scanner                             |
|  ├── Android MediaProjection System API                     |
|  ├── Foreground Service with Notification                   |
|  └── Hardware H.264 / WebRTC Streamer                       |
|                                                             |
|  [Tier 4: Scrcpy Wi-Fi Engine]                              |
|  └── Wireless Debugging ADB Pairing (Sub-15ms latency)      |
+-------------------------------------------------------------+
```

---

## 3. Quy trình Bắt tay & Kết nối (Handshake Flow)

1. **Khởi tạo phiên (Session Generation):**
   - Khi PC mở ứng dụng, máy tính gửi yêu cầu tới `/api/session/new`.
   - Server phát sinh `Session ID` duy nhất (ví dụ: `CAST-107309`), tự động phát hiện IP LAN (ví dụ: `192.168.1.188`), sinh mã QR chứa đường dẫn HTTPS an toàn.

2. **Quét mã QR (QR Scan & Discovery):**
   - Người dùng dùng Camera điện thoại quét mã QR.
   - Trình duyệt di động mở đường dẫn phiên: `https://192.168.1.188:3443/mobile/?session=CAST-107309`.

3. **Báo hiệu WebRTC (Signaling Exchange):**
   - Cả máy tính (Receiver) và điện thoại (Sender) đăng ký vào kênh WebSocket chung phòng `CAST-107309`.
   - Thiết bị di động tạo `Offer` SDP, gửi qua WebSocket.
   - Máy tính nhận `Offer`, tạo `Answer` SDP gửi ngược lại.
   - Hai bên trao đổi `ICE Candidates` để tìm đường truyền P2P nhanh nhất trong mạng Wi-Fi cục bộ.

4. **Truyền luồng Video (Hardware-accelerated Media Streaming):**
   - Luồng video được mã hóa phần cứng và truyền trực tiếp qua giao thức UDP WebRTC giữa 2 máy.
   - Máy tính hiển thị hình ảnh thời gian thực, cung cấp bộ công cụ xoay màn hình, chụp ảnh và quay video lưu vào ổ cứng.
