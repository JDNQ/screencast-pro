import ReplayKit
import CoreMedia
import VideoToolbox

/**
 * ScreenCastExtension - ReplayKit Broadcast Upload Extension
 * Captures live screen video frames (CMSampleBuffer) and streams them over LAN to the PC receiver
 */
class SampleHandler: RPBroadcastSampleHandler, URLSessionWebSocketDelegate {

    private var webSocketTask: URLSessionWebSocketTask?
    private var isConnected = false
    private var sessionId = ""
    private var serverUrl = ""

    override func broadcastStarted(withSetupInfo setupInfo: [String : NSObject]?) {
        // Read connection parameters from Shared App Group UserDefaults
        let sharedDefaults = UserDefaults(suiteName: "group.com.screencast.app")
        self.sessionId = sharedDefaults?.string(forKey: "session_id") ?? ""
        self.serverUrl = sharedDefaults?.string(forKey: "server_url") ?? ""

        guard !serverUrl.isEmpty, !sessionId.isEmpty else {
            finishBroadcastWithError(NSError(domain: "ScreenCast", code: -1, userInfo: [NSLocalizedDescriptionKey: "Chưa quét mã QR kết nối"]))
            return
        }

        connectWebSocket()
    }

    private func connectWebSocket() {
        let wsUrlString = serverUrl.replacingOccurrences(of: "http://", with: "ws://")
                                   .replacingOccurrences(of: "https://", with: "wss://")
        guard let url = URL(string: wsUrlString) else { return }

        let session = URLSession(configuration: .default, delegate: self, delegateQueue: OperationQueue())
        webSocketTask = session.webSocketTask(with: url)
        webSocketTask?.resume()

        // Send register message as sender
        let registerPayload: [String: Any] = [
            "type": "register",
            "role": "sender",
            "sessionId": sessionId
        ]

        if let data = try? JSONSerialization.data(withJSONObject: registerPayload),
           let str = String(data: data, encoding: .utf8) {
            webSocketTask?.send(.string(str)) { error in
                if error == nil {
                    self.isConnected = true
                }
            }
        }
    }

    override func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, with sampleBufferType: RPSampleBufferType) {
        guard isConnected else { return }

        switch sampleBufferType {
        case .video:
            // Extract PixelBuffer from CMSampleBuffer
            guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
            
            // Encode frame to JPEG / H.264 chunk and stream over WebSocket
            // In high-performance pipeline, use VTCompressionSession for H.264 NAL units
            sendCompressedFrame(pixelBuffer)
            
        case .audioApp, .audioMic:
            // Optional: Handle system audio / microphone sample buffers
            break
            
        @unknown default:
            break
        }
    }

    private func sendCompressedFrame(_ pixelBuffer: CVPixelBuffer) {
        let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
        let context = CIContext(options: nil)

        guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
              let jpegData = context.jpegRepresentation(of: ciImage, colorSpace: colorSpace, options: [kCGImageDestinationLossyFactor as CIImageRepresentationOption: 0.7]) else {
            return
        }

        // Send binary JPEG chunk or base64 stream
        let base64String = jpegData.base64EncodedString()
        let frameMsg: [String: Any] = [
            "type": "stream_control",
            "payload": [
                "action": "video_frame",
                "data": base64String
            ]
        ]

        if let msgData = try? JSONSerialization.data(withJSONObject: frameMsg),
           let msgStr = String(data: msgData, encoding: .utf8) {
            webSocketTask?.send(.string(msgStr)) { _ in }
        }
    }

    override func broadcastFinished() {
        webSocketTask?.cancel(with: .normalClosure, reason: nil)
        isConnected = false
    }
}
