import ReplayKit
import CoreMedia
import VideoToolbox
import ImageIO

/**
 * ScreenCastExtension - ReplayKit Broadcast Upload Extension
 * Optimized for low memory (< 50MB limit), frame rate throttling, and direct binary streaming
 */
class SampleHandler: RPBroadcastSampleHandler, URLSessionWebSocketDelegate {

    private var webSocketTask: URLSessionWebSocketTask?
    private var isConnected = false
    private var sessionId = ""
    private var serverUrl = ""

    // Reusable shared CIContext to prevent memory leak and extension crash
    private static let sharedCIContext = CIContext(options: [
        .useSoftwareRenderer: false,
        .workingColorSpace: NSNull()
    ])

    private var lastFrameTimestamp: Double = 0
    private let targetFrameInterval: Double = 1.0 / 30.0 // Throttle to 30 FPS to respect 50MB iOS extension memory limit
    private var inFlightFrames = 0
    private let maxInFlightFrames = 2 // Drop frames when network buffer has >= 2 frames to avoid memory exhaustion (< 50MB)

    override func broadcastStarted(withSetupInfo setupInfo: [String : NSObject]?) {
        let sharedDefaults = UserDefaults(suiteName: "group.com.screencast.app")
        self.sessionId = sharedDefaults?.string(forKey: "session_id") ?? ""
        self.serverUrl = sharedDefaults?.string(forKey: "server_url") ?? ""

        guard !serverUrl.isEmpty, !sessionId.isEmpty else {
            finishBroadcastWithError(NSError(domain: "ScreenCast", code: -1, userInfo: [NSLocalizedDescriptionKey: "Chưa nhập mã kết nối trên App ScreenCast Pro"]))
            return
        }

        connectWebSocket()
    }

    private func connectWebSocket() {
        // Use plain ws:// to port 3000 to avoid untrusted self-signed certificate rejection on iOS
        var wsUrlString = serverUrl
        if wsUrlString.hasPrefix("https://") {
            wsUrlString = wsUrlString.replacingOccurrences(of: "https://", with: "ws://")
                                     .replacingOccurrences(of: ":3443", with: ":3000")
        } else if wsUrlString.hasPrefix("http://") {
            wsUrlString = wsUrlString.replacingOccurrences(of: "http://", with: "ws://")
        }

        guard let url = URL(string: wsUrlString) else { return }

        let session = URLSession(configuration: .default, delegate: self, delegateQueue: OperationQueue())
        webSocketTask = session.webSocketTask(with: url)
        webSocketTask?.resume()

        let registerPayload: [String: Any] = [
            "type": "register",
            "role": "sender",
            "sessionId": sessionId
        ]

        if let data = try? JSONSerialization.data(withJSONObject: registerPayload),
           let str = String(data: data, encoding: .utf8) {
            webSocketTask?.send(.string(str)) { [weak self] error in
                if error == nil {
                    self?.isConnected = true
                }
            }
        }
    }

    override func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, with sampleBufferType: RPSampleBufferType) {
        guard isConnected else { return }

        switch sampleBufferType {
        case .video:
            // Drop frame if network queue is busy to prevent memory accumulation
            guard inFlightFrames < maxInFlightFrames else {
                return
            }

            let currentTime = CACurrentMediaTime()
            if currentTime - lastFrameTimestamp < targetFrameInterval {
                return // Throttle frame rate
            }
            lastFrameTimestamp = currentTime

            guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
            
            // Check orientation from sample buffer attachments
            var orientation: CGImagePropertyOrientation = .up
            if let orientationAttachment = CMGetAttachment(sampleBuffer, key: RPVideoSampleOrientationKey as CFString, attachmentModeOut: nil) as? NSNumber {
                if let parsedOrientation = CGImagePropertyOrientation(rawValue: orientationAttachment.uint32Value) {
                    orientation = parsedOrientation
                }
            }

            autoreleasepool {
                sendCompressedBinaryFrame(pixelBuffer, orientation: orientation)
            }

        case .audioApp, .audioMic:
            break

        @unknown default:
            break
        }
    }

    private func sendCompressedBinaryFrame(_ pixelBuffer: CVPixelBuffer, orientation: CGImagePropertyOrientation) {
        var ciImage = CIImage(cvPixelBuffer: pixelBuffer)
        if orientation != .up {
            ciImage = ciImage.oriented(orientation)
        }

        // Downscale image if 4K/2K to preserve strict 50MB extension memory budget
        let extent = ciImage.extent
        let maxDimension: CGFloat = 1280.0
        if extent.width > maxDimension || extent.height > maxDimension {
            let scale = maxDimension / max(extent.width, extent.height)
            ciImage = ciImage.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        }

        guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
              let jpegData = SampleHandler.sharedCIContext.jpegRepresentation(
                  of: ciImage,
                  colorSpace: colorSpace,
                  options: [kCGImageDestinationLossyCompressionQuality as CIImageRepresentationOption: 0.65]
              ) else {
            return
        }

        // Send raw binary frame directly over WebSocket (zero base64 overhead)
        inFlightFrames += 1
        webSocketTask?.send(.data(jpegData)) { [weak self] _ in
            self?.inFlightFrames = max(0, (self?.inFlightFrames ?? 1) - 1)
        }
    }

    override func broadcastFinished() {
        webSocketTask?.cancel(with: .normalClosure, reason: nil)
        isConnected = false
    }
}
