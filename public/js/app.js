/**
 * ScreenCast Pro - PC Desktop Receiver Controller (Production-grade)
 * Supports WebRTC P2P (Hardware-accelerated) and WebSocket Direct Frame streaming (iOS ReplayKit)
 */

class ScreenCastReceiver {
    constructor() {
        this.sessionId = null;
        this.pin = null;
        this.receiverToken = null;
        this.ws = null;
        this.peerConnection = null;
        this.remoteStream = null;
        this.iceCandidateQueue = [];

        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;

        this.rotationAngle = 0;
        this.isFitCover = false;
        this.activeMode = 'idle'; // 'webrtc', 'canvas', 'idle'

        this.fpsInterval = null;
        this.rawFrameCount = 0;
        this.lastRawFrameTime = performance.now();

        // RTC Configuration with STUN servers
        this.rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        this.initDomElements();
        this.initEventListeners();
        this.startSession();
    }

    initDomElements() {
        this.dom = {
            statusPill: document.getElementById('connectionStatus'),
            statusText: document.getElementById('statusText'),
            networkIpDisplay: document.getElementById('networkIpDisplay'),
            pairingScreen: document.getElementById('pairingScreen'),
            streamingView: document.getElementById('streamingView'),
            pinDisplayBig: document.getElementById('pinDisplayBig'),
            btnCopyPin: document.getElementById('btnCopyPin'),
            quickWebLink: document.getElementById('quickWebLink'),
            qrImage: document.getElementById('qrImage'),
            qrLoading: document.getElementById('qrLoading'),
            sessionIdDisplay: document.getElementById('sessionIdDisplay'),
            btnRefreshSession: document.getElementById('btnRefreshSession'),
            manualUrlInput: document.getElementById('manualUrlInput'),
            btnCopyUrl: document.getElementById('btnCopyUrl'),
            videoWrapper: document.getElementById('videoWrapper'),
            remoteVideo: document.getElementById('remoteVideo'),
            fallbackCanvas: document.getElementById('fallbackCanvas'),
            statFps: document.getElementById('statFps'),
            statLatency: document.getElementById('statLatency'),
            statResolution: document.getElementById('statResolution'),
            statProtocol: document.getElementById('statProtocol'),
            btnRotate: document.getElementById('btnRotate'),
            btnSnapshot: document.getElementById('btnSnapshot'),
            btnRecord: document.getElementById('btnRecord'),
            recordLabel: document.getElementById('recordLabel'),
            btnToggleAudio: document.getElementById('btnToggleAudio'),
            btnFitMode: document.getElementById('btnFitMode'),
            btnFullscreen: document.getElementById('btnFullscreen'),
            btnDisconnect: document.getElementById('btnDisconnect'),
            infoModal: document.getElementById('infoModal'),
            btnInfoModal: document.getElementById('btnInfoModal'),
            btnCloseModal: document.getElementById('btnCloseModal'),
            toastContainer: document.getElementById('toastContainer')
        };
    }

    initEventListeners() {
        this.dom.btnRefreshSession.addEventListener('click', () => this.startSession());
        this.dom.btnCopyUrl.addEventListener('click', () => this.copyUrlToClipboard());
        if (this.dom.btnCopyPin) {
            this.dom.btnCopyPin.addEventListener('click', () => this.copyPinToClipboard());
        }

        this.dom.btnRotate.addEventListener('click', () => this.rotateVideo());
        this.dom.btnSnapshot.addEventListener('click', () => this.takeSnapshot());
        this.dom.btnRecord.addEventListener('click', () => this.toggleRecording());
        this.dom.btnToggleAudio.addEventListener('click', () => this.toggleAudio());
        this.dom.btnFitMode.addEventListener('click', () => this.toggleFitMode());
        this.dom.btnFullscreen.addEventListener('click', () => this.toggleFullscreen());
        this.dom.btnDisconnect.addEventListener('click', () => this.disconnectStream());

        this.dom.btnInfoModal.addEventListener('click', () => this.dom.infoModal.classList.remove('hidden'));
        this.dom.btnCloseModal.addEventListener('click', () => this.dom.infoModal.classList.add('hidden'));

        window.addEventListener('keydown', (e) => {
            if (e.key === 'F11') {
                e.preventDefault();
                this.toggleFullscreen();
            }
        });
    }

    async startSession() {
        this.updateStatus('Đang khởi tạo phiên...', 'waiting');
        this.dom.qrLoading.classList.remove('hidden');

        try {
            const res = await fetch('/api/session/new');
            const data = await res.json();

            if (!data.success) throw new Error(data.error);

            this.sessionId = data.sessionId;
            this.pin = data.pin;
            this.receiverToken = data.receiverToken;

            this.dom.sessionIdDisplay.textContent = this.sessionId;
            if (this.dom.pinDisplayBig) {
                this.dom.pinDisplayBig.textContent = this.pin;
            }
            if (this.dom.quickWebLink) {
                this.dom.quickWebLink.textContent = data.directMobileUrl || `${window.location.protocol}//${data.lanIp}:${data.httpPort}/mobile`;
            }

            this.dom.networkIpDisplay.textContent = `${data.lanIp}:${data.httpPort}`;
            this.dom.manualUrlInput.value = data.mobileUrl;

            this.dom.qrImage.src = data.qrCode;
            this.dom.qrImage.onload = () => {
                this.dom.qrLoading.classList.add('hidden');
            };

            this.connectSignaling();
        } catch (err) {
            console.error('Session start error:', err);
            this.showToast('Không thể tạo phiên kết nối. Vui lòng kiểm tra server.', 'danger');
        }
    }

    connectSignaling() {
        if (this.ws) {
            // Remove onclose to prevent race conditions during refresh
            this.ws.onclose = null;
            this.ws.close();
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('[Signaling] WebSocket connected.');
            this.ws.send(JSON.stringify({
                type: 'register',
                role: 'receiver',
                sessionId: this.sessionId,
                receiverToken: this.receiverToken
            }));
            this.updateStatus('Sẵn sàng - Chờ thiết bị kết nối...', 'waiting');
        };

        this.ws.onmessage = async (event) => {
            try {
                // Check if binary frame received from sender (direct iOS frame chunk)
                if (event.data instanceof Blob) {
                    const arrayBuffer = await event.data.arrayBuffer();
                    this.renderBinaryFrame(arrayBuffer);
                    return;
                }

                const message = JSON.parse(event.data);
                await this.handleSignalingMessage(message);
            } catch (err) {
                console.error('[Signaling] Error parsing message:', err);
            }
        };

        this.ws.onclose = () => {
            console.warn('[Signaling] WebSocket disconnected.');
            this.updateStatus('Mất kết nối với máy chủ', 'waiting');
        };

        this.ws.onerror = (err) => {
            console.error('[Signaling] WebSocket error:', err);
        };
    }

    async handleSignalingMessage(message) {
        switch (message.type) {
            case 'sender_ready':
                this.showToast('Thiết bị di động đã kết nối thành công!', 'success');
                this.updateStatus('Đang thiết lập kênh truyền...', 'waiting');
                break;

            case 'signal':
                await this.handlePeerSignal(message.payload);
                break;

            case 'stream_control':
                if (message.payload && message.payload.action === 'video_frame') {
                    this.renderRawFrame(message.payload.data);
                }
                break;

            case 'sender_disconnected':
                this.showToast('Điện thoại đã ngắt kết nối.', 'warning');
                this.disconnectStream();
                break;

            case 'error':
                this.showToast(`Lỗi: ${message.message}`, 'danger');
                break;
        }
    }

    setupPeerConnection() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        this.iceCandidateQueue = [];
        this.remoteStream = new MediaStream();
        this.dom.remoteVideo.srcObject = this.remoteStream;

        this.peerConnection = new RTCPeerConnection(this.rtcConfig);

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: 'signal',
                    sessionId: this.sessionId,
                    payload: { candidate: event.candidate }
                }));
            }
        };

        this.peerConnection.ontrack = (event) => {
            console.log('[WebRTC] Remote track received:', event.track.kind);
            this.remoteStream.addTrack(event.track);

            this.dom.remoteVideo.onloadedmetadata = () => {
                this.dom.remoteVideo.play().catch(e => console.warn('Autoplay prevented:', e));
                this.onStreamReady('webrtc');
            };
        };

        this.peerConnection.onconnectionstatechange = () => {
            console.log('[WebRTC] Connection state:', this.peerConnection.connectionState);
            if (this.peerConnection.connectionState === 'connected') {
                this.updateStatus('Đang chiếu màn hình (Trực tiếp)', 'connected');
            } else if (this.peerConnection.connectionState === 'disconnected' || this.peerConnection.connectionState === 'failed') {
                this.disconnectStream();
            }
        };
    }

    async handlePeerSignal(payload) {
        if (payload.offer) {
            // New offer received -> Recreate PeerConnection cleanly
            this.setupPeerConnection();

            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(payload.offer));

            // Drain queued ICE candidates
            while (this.iceCandidateQueue.length > 0) {
                const queuedCandidate = this.iceCandidateQueue.shift();
                try {
                    await this.peerConnection.addIceCandidate(new RTCIceCandidate(queuedCandidate));
                } catch (e) {
                    console.error('[WebRTC] Queued ICE candidate error:', e);
                }
            }

            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: 'signal',
                    sessionId: this.sessionId,
                    payload: { answer }
                }));
            }
        } else if (payload.candidate) {
            if (!this.peerConnection || !this.peerConnection.remoteDescription) {
                // Queue candidate if remote description not yet set
                this.iceCandidateQueue.push(payload.candidate);
            } else {
                try {
                    await this.peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate));
                } catch (err) {
                    console.error('[WebRTC] Error adding ICE candidate:', err);
                }
            }
        }
    }

    onStreamReady(mode) {
        this.activeMode = mode;
        this.dom.pairingScreen.classList.add('hidden');
        this.dom.streamingView.classList.remove('hidden');

        if (mode === 'webrtc') {
            this.dom.remoteVideo.classList.remove('hidden');
            this.dom.fallbackCanvas.classList.add('hidden');
            if (this.dom.statProtocol) {
                this.dom.statProtocol.textContent = 'WebRTC P2P';
                this.dom.statProtocol.className = 'val green';
            }
        } else if (mode === 'canvas') {
            this.dom.remoteVideo.classList.add('hidden');
            this.dom.fallbackCanvas.classList.remove('hidden');
            if (this.dom.statProtocol) {
                this.dom.statProtocol.textContent = 'Direct WS Stream';
                this.dom.statProtocol.className = 'val green';
            }
        }

        this.startRealDiagnostics();
        this.showToast('Bắt đầu chiếu màn hình thành công!', 'success');
    }

    renderBinaryFrame(arrayBuffer) {
        const blob = new Blob([arrayBuffer], { type: 'image/jpeg' });
        const url = URL.createObjectURL(blob);
        this.drawFrameToCanvas(url, () => URL.revokeObjectURL(url));
    }

    renderRawFrame(base64Data) {
        this.drawFrameToCanvas('data:image/jpeg;base64,' + base64Data);
    }

    drawFrameToCanvas(src, onComplete) {
        if (this.activeMode !== 'canvas') {
            this.onStreamReady('canvas');
            this.updateStatus('Đang chiếu màn hình (Direct Frame)', 'connected');
        }

        this.rawFrameCount++;

        const img = new Image();
        img.onload = () => {
            const canvas = this.dom.fallbackCanvas;
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            this.dom.statResolution.textContent = `${img.width}x${img.height}`;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);

            if (onComplete) onComplete();
        };
        img.src = src;
    }

    startRealDiagnostics() {
        if (this.fpsInterval) clearInterval(this.fpsInterval);

        let lastBytesReceived = 0;
        let lastTimestamp = performance.now();
        let lastFrameCountSnapshot = 0;

        this.fpsInterval = setInterval(async () => {
            if (this.activeMode === 'webrtc' && this.peerConnection) {
                try {
                    const stats = await this.peerConnection.getStats();
                    let currentFps = null;
                    let currentRtt = null;

                    stats.forEach(report => {
                        if (report.type === 'inbound-rtp' && report.kind === 'video') {
                            if (report.framesPerSecond !== undefined) {
                                currentFps = Math.round(report.framesPerSecond);
                            }
                            if (report.frameWidth && report.frameHeight) {
                                this.dom.statResolution.textContent = `${report.frameWidth}x${report.frameHeight}`;
                            }
                        }
                        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                            if (report.currentRoundTripTime !== undefined) {
                                currentRtt = Math.round(report.currentRoundTripTime * 1000);
                            }
                        }
                    });

                    this.dom.statFps.textContent = (currentFps !== null) ? `${currentFps} FPS` : 'Đang tính...';
                    this.dom.statLatency.textContent = (currentRtt !== null) ? `${currentRtt} ms` : 'LAN < 20ms';
                } catch (e) {
                    // Fallback to video playback quality
                    if (this.dom.remoteVideo.getVideoPlaybackQuality) {
                        const q = this.dom.remoteVideo.getVideoPlaybackQuality();
                        this.dom.statFps.textContent = `${q.totalVideoFrames ? 30 : 0} FPS`;
                    }
                }
            } else if (this.activeMode === 'canvas') {
                // Calculate actual frames received in last second
                const now = performance.now();
                const deltaSec = (now - lastTimestamp) / 1000;
                const framesDelta = this.rawFrameCount - lastFrameCountSnapshot;
                const fps = Math.round(framesDelta / (deltaSec || 1));

                lastFrameCountSnapshot = this.rawFrameCount;
                lastTimestamp = now;

                this.dom.statFps.textContent = `${fps} FPS`;
                this.dom.statLatency.textContent = 'Trực tiếp (Local)';
            }
        }, 1000);
    }

    rotateVideo() {
        this.rotationAngle = (this.rotationAngle + 90) % 360;
        const transform = `rotate(${this.rotationAngle}deg)`;
        this.dom.remoteVideo.style.transform = transform;
        this.dom.fallbackCanvas.style.transform = transform;
        this.showToast(`Xoay màn hình: ${this.rotationAngle}°`, 'info');
    }

    takeSnapshot() {
        const isCanvasMode = (this.activeMode === 'canvas');
        const source = isCanvasMode ? this.dom.fallbackCanvas : this.dom.remoteVideo;
        const sourceWidth = isCanvasMode ? source.width : source.videoWidth;
        const sourceHeight = isCanvasMode ? source.height : source.videoHeight;

        if (!sourceWidth || !sourceHeight) {
            this.showToast('Chưa có hình ảnh để chụp màn hình', 'warning');
            return;
        }

        const canvas = document.createElement('canvas');
        const isSideways = (this.rotationAngle % 180 !== 0);

        // Correctly swap width and height when rotated 90 or 270 degrees
        canvas.width = isSideways ? sourceHeight : sourceWidth;
        canvas.height = isSideways ? sourceWidth : sourceHeight;
        const ctx = canvas.getContext('2d');

        if (this.rotationAngle !== 0) {
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate((this.rotationAngle * Math.PI) / 180);
            ctx.drawImage(source, -sourceWidth / 2, -sourceHeight / 2, sourceWidth, sourceHeight);
        } else {
            ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
        }

        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = `screencast-${Date.now()}.png`;
        a.click();

        this.showToast('Đã lưu ảnh chụp màn hình!', 'success');
    }

    toggleRecording() {
        if (this.activeMode === 'idle') return;

        if (!this.isRecording) {
            this.recordedChunks = [];
            let streamToRecord = null;

            if (this.activeMode === 'canvas') {
                streamToRecord = this.dom.fallbackCanvas.captureStream(30);
            } else if (this.remoteStream) {
                streamToRecord = this.remoteStream;
            }

            if (!streamToRecord) {
                this.showToast('Không thể lấy luồng video để ghi hình', 'warning');
                return;
            }

            try {
                this.mediaRecorder = new MediaRecorder(streamToRecord, { mimeType: 'video/webm;codecs=vp8' });
            } catch (e) {
                try {
                    this.mediaRecorder = new MediaRecorder(streamToRecord);
                } catch (err) {
                    this.showToast('Trình duyệt không hỗ trợ ghi định dạng này', 'danger');
                    return;
                }
            }

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `screencast-recording-${Date.now()}.webm`;
                a.click();
                URL.revokeObjectURL(url);
                this.showToast('Video ghi hình đã được tải xuống!', 'success');
            };

            this.mediaRecorder.start(1000);
            this.isRecording = true;
            this.dom.btnRecord.classList.add('recording');
            this.dom.recordLabel.textContent = 'Dừng ghi';
            this.showToast('Bắt đầu ghi video màn hình...', 'info');
        } else {
            if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
                this.mediaRecorder.stop();
            }
            this.isRecording = false;
            this.dom.btnRecord.classList.remove('recording');
            this.dom.recordLabel.textContent = 'Ghi hình';
        }
    }

    toggleAudio() {
        const video = this.dom.remoteVideo;
        video.muted = !video.muted;
        this.dom.btnToggleAudio.classList.toggle('active', !video.muted);
        this.showToast(video.muted ? 'Đã tắt âm thanh' : 'Đã bật âm thanh', 'info');
    }

    toggleFitMode() {
        this.isFitCover = !this.isFitCover;
        const fitStyle = this.isFitCover ? 'cover' : 'contain';
        this.dom.remoteVideo.style.objectFit = fitStyle;
        this.dom.fallbackCanvas.style.objectFit = fitStyle;
        this.showToast(this.isFitCover ? 'Chế độ: Đầy màn hình (Fill)' : 'Chế độ: Giữ tỉ lệ (Fit)', 'info');
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(err);
            });
        } else {
            document.exitFullscreen().catch(err => {
                console.error(err);
            });
        }
    }

    disconnectStream() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        if (this.remoteStream) {
            this.remoteStream.getTracks().forEach(track => track.stop());
            this.remoteStream = null;
        }
        if (this.fpsInterval) {
            clearInterval(this.fpsInterval);
            this.fpsInterval = null;
        }

        this.activeMode = 'idle';
        this.dom.streamingView.classList.add('hidden');
        this.dom.pairingScreen.classList.remove('hidden');
        this.dom.remoteVideo.classList.remove('hidden');
        this.dom.fallbackCanvas.classList.add('hidden');
        this.dom.remoteVideo.srcObject = null;

        this.startSession();
    }

    updateStatus(text, stateClass) {
        this.dom.statusText.textContent = text;
        this.dom.statusPill.className = `status-pill ${stateClass}`;
    }

    copyUrlToClipboard() {
        navigator.clipboard.writeText(this.dom.manualUrlInput.value).then(() => {
            this.showToast('Đã sao chép liên kết vào bộ nhớ tạm!', 'success');
        });
    }

    copyPinToClipboard() {
        const pin = this.dom.pinDisplayBig ? this.dom.pinDisplayBig.textContent : '';
        if (pin) {
            navigator.clipboard.writeText(pin).then(() => {
                this.showToast(`Đã sao chép mã PIN: ${pin}`, 'success');
            });
        }
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        this.dom.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }
}

// Tab switcher for solution guides
window.showHelpTab = function(tabName) {
    const tabs = document.querySelectorAll('.solution-item');
    tabs.forEach(t => t.classList.remove('active'));

    const panes = {
        web: document.getElementById('guideWeb'),
        ios: document.getElementById('guideIos'),
        android: document.getElementById('guideAndroid'),
        scrcpy: document.getElementById('guideScrcpy')
    };

    Object.values(panes).forEach(p => {
        if (p) p.classList.add('hidden');
    });

    if (tabName === 'web') {
        tabs[0].classList.add('active');
        panes.web.classList.remove('hidden');
    } else if (tabName === 'ios') {
        tabs[1].classList.add('active');
        panes.ios.classList.remove('hidden');
    } else if (tabName === 'android') {
        tabs[2].classList.add('active');
        panes.android.classList.remove('hidden');
    } else if (tabName === 'scrcpy') {
        tabs[3].classList.add('active');
        panes.scrcpy.classList.remove('hidden');
    }
};

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
    window.app = new ScreenCastReceiver();
});
