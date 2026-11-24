/**
 * ScreenCast Pro - Mobile Sender Client Controller
 * WebRTC P2P Media Transmitter with Multi-source streaming (Screen, Camera, Canvas)
 */

class ScreenCastSender {
    constructor() {
        this.sessionId = this.getSessionFromUrl();
        this.ws = null;
        this.peerConnection = null;
        this.localStream = null;
        this.activeMode = null; // 'screen', 'camera', 'canvas'

        this.currentFacingMode = 'environment'; // 'user' or 'environment'
        this.isTorchOn = false;
        this.mediaTrack = null;

        // Interactive Canvas State
        this.isDrawing = false;
        this.canvasCtx = null;

        this.rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        this.initDom();
        this.initEvents();
        this.connectSignaling();
    }

    getSessionFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('session') || localStorage.getItem('screencast_last_id') || '';
    }

    initDom() {
        this.dom = {
            connectionBadge: document.getElementById('connectionBadge'),
            connStatusText: document.getElementById('connStatusText'),
            sessionDisplay: document.getElementById('sessionDisplay'),
            pinEntryCard: document.getElementById('pinEntryCard'),
            inputPinCode: document.getElementById('inputPinCode'),
            btnConnectPin: document.getElementById('btnConnectPin'),
            activeSessionCard: document.getElementById('activeSessionCard'),
            btnChangePin: document.getElementById('btnChangePin'),
            btnShareScreen: document.getElementById('btnShareScreen'),
            btnShareCamera: document.getElementById('btnShareCamera'),
            btnShareCanvas: document.getElementById('btnShareCanvas'),
            activeStreamCard: document.getElementById('activeStreamCard'),
            localPreview: document.getElementById('localPreview'),
            interactiveCanvas: document.getElementById('interactiveCanvas'),
            btnSwitchCamera: document.getElementById('btnSwitchCamera'),
            btnToggleTorch: document.getElementById('btnToggleTorch'),
            btnClearCanvas: document.getElementById('btnClearCanvas'),
            btnStopStream: document.getElementById('btnStopStream'),
            mobileToast: document.getElementById('mobileToast')
        };

        if (this.sessionId) {
            this.updateSessionUI(this.sessionId);
        } else {
            this.showPinEntry();
        }

        // Auto-detect iOS vs Android
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        if (isIOS) {
            const iosBox = document.getElementById('iosGuidance');
            if (iosBox) {
                iosBox.style.background = 'rgba(56, 189, 248, 0.12)';
                iosBox.style.padding = '8px 10px';
                iosBox.style.borderRadius = '8px';
                iosBox.style.border = '1px solid rgba(56, 189, 248, 0.4)';
            }
            const platformTitle = document.getElementById('platformTitle');
            if (platformTitle) platformTitle.textContent = 'Phát hiện thiết bị Apple iOS (iPhone/iPad)';
        }
    }

    initEvents() {
        this.dom.btnConnectPin.addEventListener('click', () => this.connectWithPin());
        this.dom.btnChangePin.addEventListener('click', () => this.showPinEntry());
        this.dom.inputPinCode.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') this.connectWithPin();
        });

        this.dom.btnShareScreen.addEventListener('click', () => this.startScreenShare());
        this.dom.btnShareCamera.addEventListener('click', () => this.startCameraShare());
        this.dom.btnShareCanvas.addEventListener('click', () => this.startCanvasShare());
        this.dom.btnStopStream.addEventListener('click', () => this.stopStream());
        this.dom.btnSwitchCamera.addEventListener('click', () => this.switchCamera());
        this.dom.btnToggleTorch.addEventListener('click', () => this.toggleTorch());
        this.dom.btnClearCanvas.addEventListener('click', () => this.clearCanvas());

        this.setupCanvasDrawing();
    }

    async connectWithPin() {
        const raw = this.dom.inputPinCode.value.trim().toUpperCase();
        if (!raw) {
            this.showToast('Vui lòng nhập Mã ID hiển thị trên máy tính!');
            return;
        }

        this.showToast('Đang kiểm tra mã kết nối...');
        try {
            const res = await fetch(`/api/session/verify?id=${encodeURIComponent(raw)}`);
            const data = await res.json();

            if (!data.success) {
                throw new Error(data.error || 'Mã ID không hợp lệ');
            }

            this.sessionId = data.sessionId;
            localStorage.setItem('screencast_last_id', this.sessionId);
            this.updateSessionUI(this.sessionId);
            this.connectSignaling();
            this.showToast(`✅ Kết nối thành công tới PC (${data.pin})!`);
        } catch (e) {
            this.showToast('❌ ' + e.message, 4000);
        }
    }

    showPinEntry() {
        this.dom.pinEntryCard.classList.remove('hidden');
        this.dom.activeSessionCard.classList.add('hidden');
        this.dom.inputPinCode.focus();
        this.setConnectionState(false, 'Chờ nhập mã ID');
    }

    updateSessionUI(sessionId) {
        this.dom.sessionDisplay.textContent = sessionId;
        this.dom.pinEntryCard.classList.add('hidden');
        this.dom.activeSessionCard.classList.remove('hidden');
    }

    connectSignaling() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('[Sender] Connected to signaling server');
            this.ws.send(JSON.stringify({
                type: 'register',
                role: 'sender',
                sessionId: this.sessionId
            }));
            this.setConnectionState(true, 'Đã ghép nối PC');
        };

        this.ws.onmessage = async (event) => {
            try {
                const message = JSON.parse(event.data);
                await this.handleSignalingMessage(message);
            } catch (err) {
                console.error('[Sender] Signaling parse error:', err);
            }
        };

        this.ws.onclose = () => {
            console.warn('[Sender] Disconnected from signaling server');
            this.setConnectionState(false, 'Mất kết nối PC');
        };
    }

    async handleSignalingMessage(message) {
        switch (message.type) {
            case 'receiver_ready':
                this.showToast('Máy tính đã sẵn sàng nhận hình ảnh!');
                if (this.localStream && !this.peerConnection) {
                    this.initiatePeerCall();
                }
                break;

            case 'signal':
                if (message.payload.answer && this.peerConnection) {
                    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(message.payload.answer));
                } else if (message.payload.candidate && this.peerConnection) {
                    try {
                        await this.peerConnection.addIceCandidate(new RTCIceCandidate(message.payload.candidate));
                    } catch (e) {
                        console.error('ICE error:', e);
                    }
                }
                break;

            case 'receiver_disconnected':
                this.showToast('Máy tính đã đóng kết nối');
                this.stopStream();
                break;
        }
    }

    async startScreenShare() {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
                throw new Error('OS_NOT_SUPPORTED');
            }

            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: { ideal: 60, max: 60 },
                    cursor: 'always'
                },
                audio: true
            });

            this.activeMode = 'screen';
            this.handleStreamObtained(stream);
        } catch (err) {
            console.warn('Screen share not supported or declined:', err);
            alert('⚠️ THÔNG BÁO TỪ HỆ THỐNG:\n\nTrình duyệt điện thoại (Safari trên iPhone hoặc Chrome trên Android) bị hệ điều hành chặn quay toàn màn hình để bảo vệ quyền riêng tư.\n\nĐể chiếu màn hình thật:\n1. Với iPhone: Dùng tính năng "Phản chiếu màn hình" (AirPlay) trong Trung tâm điều khiển.\n2. Với Android: Dùng tính năng "Smart View / Phát màn hình" trong Cài đặt nhanh, hoặc cài App Android Native (MediaProjection).\n\nNếu bạn muốn dùng Camera để soi tài liệu/vật thể, vui lòng chọn mục "Chiếu Camera HD & Tài Liệu".');
        }
    }

    async startCameraShare() {
        try {
            const constraints = {
                video: {
                    facingMode: this.currentFacingMode,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    frameRate: { ideal: 60 }
                },
                audio: false
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.activeMode = 'camera';
            this.dom.btnSwitchCamera.classList.remove('hidden');
            this.dom.btnToggleTorch.classList.remove('hidden');
            this.handleStreamObtained(stream);
        } catch (err) {
            console.error('Camera access error:', err);
            this.showToast('Không thể mở Camera. Vui lòng cấp quyền camera trong trình duyệt.');
        }
    }

    startCanvasShare() {
        const canvas = this.dom.interactiveCanvas;
        canvas.width = 1280;
        canvas.height = 720;
        this.clearCanvas();

        const stream = canvas.captureStream(60);
        this.activeMode = 'canvas';
        this.dom.interactiveCanvas.classList.remove('hidden');
        this.dom.localPreview.classList.add('hidden');
        this.dom.btnClearCanvas.classList.remove('hidden');

        this.handleStreamObtained(stream);
    }

    handleStreamObtained(stream) {
        this.localStream = stream;
        this.mediaTrack = stream.getVideoTracks()[0];

        if (this.activeMode !== 'canvas') {
            this.dom.localPreview.srcObject = stream;
            this.dom.localPreview.classList.remove('hidden');
            this.dom.interactiveCanvas.classList.add('hidden');
        }

        this.dom.activeStreamCard.classList.remove('hidden');

        this.mediaTrack.onended = () => {
            this.stopStream();
        };

        this.initiatePeerCall();
    }

    async initiatePeerCall() {
        if (!this.localStream) return;

        if (this.peerConnection) {
            this.peerConnection.close();
        }

        this.peerConnection = new RTCPeerConnection(this.rtcConfig);

        // Add local tracks
        this.localStream.getTracks().forEach(track => {
            this.peerConnection.addTrack(track, this.localStream);
        });

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: 'signal',
                    sessionId: this.sessionId,
                    payload: { candidate: event.candidate }
                }));
            }
        };

        // Create Offer
        const offer = await this.peerConnection.createOffer({
            offerToReceiveVideo: false,
            offerToReceiveAudio: false
        });
        await this.peerConnection.setLocalDescription(offer);

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'signal',
                sessionId: this.sessionId,
                payload: { offer }
            }));
        }

        this.showToast('Đang phát tín hiệu lên máy tính...');
    }

    async switchCamera() {
        if (this.activeMode !== 'camera') return;
        this.currentFacingMode = (this.currentFacingMode === 'user') ? 'environment' : 'user';

        if (this.localStream) {
            this.localStream.getTracks().forEach(t => t.stop());
        }
        await this.startCameraShare();
    }

    async toggleTorch() {
        if (!this.mediaTrack || !this.mediaTrack.applyConstraints) return;
        this.isTorchOn = !this.isTorchOn;

        try {
            await this.mediaTrack.applyConstraints({
                advanced: [{ torch: this.isTorchOn }]
            });
            this.showToast(this.isTorchOn ? 'Đã bật đèn pin' : 'Đã tắt đèn pin');
        } catch (e) {
            this.showToast('Thiết bị không hỗ trợ bật đèn flash qua web');
        }
    }

    setupCanvasDrawing() {
        const canvas = this.dom.interactiveCanvas;
        this.canvasCtx = canvas.getContext('2d');

        const getPos = (e) => {
            const rect = canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: (clientX - rect.left) * (canvas.width / rect.width),
                y: (clientY - rect.top) * (canvas.height / rect.height)
            };
        };

        const startDraw = (e) => {
            this.isDrawing = true;
            const pos = getPos(e);
            this.canvasCtx.beginPath();
            this.canvasCtx.moveTo(pos.x, pos.y);
        };

        const draw = (e) => {
            if (!this.isDrawing) return;
            e.preventDefault();
            const pos = getPos(e);
            this.canvasCtx.strokeStyle = '#38bdf8';
            this.canvasCtx.lineWidth = 6;
            this.canvasCtx.lineCap = 'round';
            this.canvasCtx.lineTo(pos.x, pos.y);
            this.canvasCtx.stroke();
        };

        const stopDraw = () => {
            this.isDrawing = false;
        };

        canvas.addEventListener('mousedown', startDraw);
        canvas.addEventListener('mousemove', draw);
        window.addEventListener('mouseup', stopDraw);

        canvas.addEventListener('touchstart', startDraw, { passive: false });
        canvas.addEventListener('touchmove', draw, { passive: false });
        window.addEventListener('touchend', stopDraw);
    }

    clearCanvas() {
        const canvas = this.dom.interactiveCanvas;
        if (!this.canvasCtx) return;
        this.canvasCtx.fillStyle = '#0f172a';
        this.canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

        // Watermark
        this.canvasCtx.fillStyle = '#334155';
        this.canvasCtx.font = '24px "Plus Jakarta Sans", sans-serif';
        this.canvasCtx.fillText('Vẽ lên màn hình điện thoại để phát lên PC', 40, 60);
    }

    stopStream() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        this.dom.activeStreamCard.classList.add('hidden');
        this.dom.btnSwitchCamera.classList.add('hidden');
        this.dom.btnToggleTorch.classList.add('hidden');
        this.dom.btnClearCanvas.classList.add('hidden');
        this.activeMode = null;

        this.showToast('Đã dừng truyền phát');
    }

    setConnectionState(connected, text) {
        this.dom.connStatusText.textContent = text;
        this.dom.connectionBadge.className = `conn-badge ${connected ? 'connected' : 'connecting'}`;
    }

    showToast(message, duration = 3000) {
        const toast = this.dom.mobileToast;
        toast.textContent = message;
        toast.classList.remove('hidden');

        clearTimeout(this.toastTimeout);
        this.toastTimeout = setTimeout(() => {
            toast.classList.add('hidden');
        }, duration);
    }
}

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
    window.sender = new ScreenCastSender();
});
