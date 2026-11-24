const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');
const QRCode = require('qrcode');
const selfsigned = require('selfsigned');

const HTTP_PORT = process.env.HTTP_PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

// Robust LAN IP detection: strictly filters out virtual adapters (WSL, Hyper-V, VMware, Radmin, etc.)
function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    const virtualKeywords = [
        'vethernet', 'virtual', 'vmnet', 'vmware', 'hyper-v',
        'wsl', 'radmin', 'tailscale', 'zerotier', 'loopback',
        'bluetooth', 'pseudo', 'teredo', 'isatap'
    ];

    const isVirtual = (name) => {
        const lower = name.toLowerCase();
        return virtualKeywords.some(kw => lower.includes(kw));
    };

    const isUsableIp = (addr) => {
        if (!addr || addr.family !== 'IPv4' || addr.internal) return false;
        // Ignore APIPA (169.254) and Radmin VPN (26.)
        if (addr.address.startsWith('169.254.') || addr.address.startsWith('26.')) return false;
        return true;
    };

    // Priority 1: Physical Wi-Fi
    for (const [name, addrs] of Object.entries(interfaces)) {
        if (isVirtual(name)) continue;
        const lower = name.toLowerCase();
        if (lower.includes('wi-fi') || lower.includes('wifi') || lower.includes('wlan')) {
            for (const addr of addrs) {
                if (isUsableIp(addr)) return addr.address;
            }
        }
    }

    // Priority 2: Physical Ethernet
    for (const [name, addrs] of Object.entries(interfaces)) {
        if (isVirtual(name)) continue;
        const lower = name.toLowerCase();
        if (lower.includes('ethernet') || lower.includes('eth0') || lower.includes('en0')) {
            for (const addr of addrs) {
                if (isUsableIp(addr)) return addr.address;
            }
        }
    }

    // Priority 3: Any non-virtual physical adapter
    for (const [name, addrs] of Object.entries(interfaces)) {
        if (isVirtual(name)) continue;
        for (const addr of addrs) {
            if (isUsableIp(addr)) return addr.address;
        }
    }

    return '127.0.0.1';
}

const LAN_IP = getLocalIpAddress();

// Express App
const app = express();
app.use(express.json());

// Serve static receiver files for PC
app.use('/', express.static(path.join(__dirname, 'public')));

// Serve mobile client
app.use('/mobile', express.static(path.join(__dirname, 'mobile-client')));

// Active sessions: sessionId -> { receiverWs, senderWs, receiverToken, createdAt, lastActivity }
const sessions = new Map();
const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes TTL for inactive sessions

// Rate limiting for PIN verification to prevent brute-force attacks
const verifyAttempts = new Map(); // ip -> { count, resetTime, blockedUntil }
const MAX_VERIFY_ATTEMPTS = 8;
const ATTEMPT_WINDOW_MS = 60 * 1000; // 1 minute
const BLOCK_DURATION_MS = 30 * 1000; // 30 seconds block

// Clean up stale sessions and rate limits periodically
setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions.entries()) {
        const isIdle = !session.receiverWs && !session.senderWs;
        if (isIdle && (now - session.lastActivity > SESSION_TTL_MS)) {
            sessions.delete(id);
            console.log(`[Session GC] Cleaned up expired session: ${id}`);
        }
    }

    // Clean up expired IP rate limiting records
    for (const [ip, record] of verifyAttempts.entries()) {
        if (now > record.resetTime && (!record.blockedUntil || now > record.blockedUntil)) {
            verifyAttempts.delete(ip);
        }
    }
}, 60 * 1000);

function generateSecureSessionId() {
    // Generate a secure 6-digit numeric PIN
    const pin = crypto.randomInt(100000, 999999).toString();
    return {
        sessionId: 'CAST-' + pin,
        pin,
        receiverToken: crypto.randomBytes(16).toString('hex')
    };
}

function normalizeSessionId(id) {
    if (!id) return '';
    const clean = id.toString().trim().toUpperCase();
    if (clean.startsWith('CAST-')) return clean;
    if (/^\d{6}$/.test(clean)) return 'CAST-' + clean;
    return clean;
}

// API: Get server connection info, PIN, and QR code
app.get('/api/session/new', async (req, res) => {
    const { sessionId, pin, receiverToken } = generateSecureSessionId();
    sessions.set(sessionId, {
        receiverWs: null,
        senderWs: null,
        receiverToken,
        createdAt: Date.now(),
        lastActivity: Date.now()
    });

    // Provide plain HTTP link for mobile browsers to avoid self-signed wss: rejection
    const mobileHttpUrl = `http://${LAN_IP}:${HTTP_PORT}/mobile/?session=${sessionId}`;
    const mobileHttpsUrl = `https://${LAN_IP}:${HTTPS_PORT}/mobile/?session=${sessionId}`;
    const directMobileUrl = `http://${LAN_IP}:${HTTP_PORT}/mobile`;
    
    try {
        const qrDataUrl = await QRCode.toDataURL(mobileHttpUrl, {
            errorCorrectionLevel: 'M',
            margin: 2,
            width: 320,
            color: {
                dark: '#0f172a',
                light: '#ffffff'
            }
        });

        res.json({
            success: true,
            sessionId,
            pin,
            receiverToken,
            lanIp: LAN_IP,
            httpPort: HTTP_PORT,
            httpsPort: HTTPS_PORT,
            mobileUrl: mobileHttpUrl,
            mobileHttpsUrl,
            directMobileUrl,
            qrCode: qrDataUrl
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// API: Verify Session ID / PIN code (with IP rate limiting)
app.get('/api/session/verify', (req, res) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    let attemptRecord = verifyAttempts.get(clientIp);
    if (!attemptRecord) {
        attemptRecord = { count: 0, resetTime: now + ATTEMPT_WINDOW_MS, blockedUntil: 0 };
        verifyAttempts.set(clientIp, attemptRecord);
    } else if (now > attemptRecord.resetTime) {
        attemptRecord.count = 0;
        attemptRecord.resetTime = now + ATTEMPT_WINDOW_MS;
    }

    if (attemptRecord.blockedUntil && now < attemptRecord.blockedUntil) {
        const remainingSec = Math.ceil((attemptRecord.blockedUntil - now) / 1000);
        return res.status(429).json({
            success: false,
            error: `Quá nhiều lần thử sai. Vui lòng chờ ${remainingSec} giây rồi thử lại.`
        });
    }

    const rawId = req.query.id || '';
    const normalized = normalizeSessionId(rawId);

    if (normalized && sessions.has(normalized)) {
        // Reset rate limit on successful authentication
        verifyAttempts.delete(clientIp);

        const session = sessions.get(normalized);
        session.lastActivity = Date.now();
        res.json({
            success: true,
            sessionId: normalized,
            pin: normalized.replace('CAST-', ''),
            receiverOnline: !!session.receiverWs
        });
    } else {
        attemptRecord.count++;
        if (attemptRecord.count >= MAX_VERIFY_ATTEMPTS) {
            attemptRecord.blockedUntil = now + BLOCK_DURATION_MS;
        }

        res.status(404).json({
            success: false,
            error: 'Mã kết nối không hợp lệ hoặc phiên đã hết hạn'
        });
    }
});

// API: System info
app.get('/api/info', (req, res) => {
    res.json({
        lanIp: LAN_IP,
        httpPort: HTTP_PORT,
        httpsPort: HTTPS_PORT,
        activeSessions: sessions.size,
        os: os.type() + ' ' + os.release()
    });
});

function setupWebSocket(wss) {
    wss.on('connection', (ws, req) => {
        let currentSessionId = null;
        let clientRole = null; // 'receiver' or 'sender'

        ws.on('message', (message, isBinary) => {
            try {
                // If message is binary (e.g. raw JPEG/H.264 frame from mobile/iOS extension), forward directly
                if (isBinary) {
                    if (!currentSessionId || !sessions.has(currentSessionId)) return;
                    const session = sessions.get(currentSessionId);
                    session.lastActivity = Date.now();
                    const target = (clientRole === 'receiver') ? session.senderWs : session.receiverWs;
                    if (target && target.readyState === WebSocket.OPEN) {
                        target.send(message, { binary: true });
                    }
                    return;
                }

                const data = JSON.parse(message.toString());
                const { type, sessionId, receiverToken, payload } = data;

                switch (type) {
                    case 'register': {
                        currentSessionId = normalizeSessionId(sessionId);
                        clientRole = data.role; // 'receiver' or 'sender'
                        
                        if (!currentSessionId || !sessions.has(currentSessionId)) {
                            ws.send(JSON.stringify({
                                type: 'error',
                                message: 'Phiên kết nối không tồn tại hoặc đã hết hạn'
                            }));
                            ws.close();
                            return;
                        }

                        const session = sessions.get(currentSessionId);
                        session.lastActivity = Date.now();

                        if (clientRole === 'receiver') {
                            // Verify receiverToken strictly: reject if missing or mismatched
                            if (session.receiverToken && session.receiverToken !== receiverToken) {
                                ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized receiver token' }));
                                ws.close();
                                return;
                            }
                            session.receiverWs = ws;
                            console.log(`[Session ${currentSessionId}] PC Receiver connected.`);
                            ws.send(JSON.stringify({ type: 'registered', role: 'receiver', sessionId: currentSessionId }));
                            
                            // If sender is waiting, notify both
                            if (session.senderWs && session.senderWs.readyState === WebSocket.OPEN) {
                                session.receiverWs.send(JSON.stringify({ type: 'sender_ready' }));
                                session.senderWs.send(JSON.stringify({ type: 'receiver_ready' }));
                            }
                        } else if (clientRole === 'sender') {
                            session.senderWs = ws;
                            console.log(`[Session ${currentSessionId}] Mobile Sender connected.`);
                            ws.send(JSON.stringify({ type: 'registered', role: 'sender', sessionId: currentSessionId }));

                            if (session.receiverWs && session.receiverWs.readyState === WebSocket.OPEN) {
                                session.receiverWs.send(JSON.stringify({ type: 'sender_ready' }));
                                session.senderWs.send(JSON.stringify({ type: 'receiver_ready' }));
                            }
                        }
                        break;
                    }

                    case 'signal': {
                        const session = sessions.get(currentSessionId);
                        if (!session) return;
                        session.lastActivity = Date.now();

                        const targetWs = (clientRole === 'receiver') ? session.senderWs : session.receiverWs;
                        if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                            targetWs.send(JSON.stringify({
                                type: 'signal',
                                senderRole: clientRole,
                                payload
                            }));
                        }
                        break;
                    }

                    case 'stream_control': {
                        const session = sessions.get(currentSessionId);
                        if (!session) return;
                        session.lastActivity = Date.now();
                        const targetWs = (clientRole === 'receiver') ? session.senderWs : session.receiverWs;
                        if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                            targetWs.send(JSON.stringify({
                                type: 'stream_control',
                                payload
                            }));
                        }
                        break;
                    }

                    case 'ping': {
                        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                        break;
                    }

                    default:
                        console.warn('Unknown message type:', type);
                }
            } catch (err) {
                console.error('Error handling WebSocket message:', err);
            }
        });

        ws.on('close', () => {
            if (currentSessionId && sessions.has(currentSessionId)) {
                const session = sessions.get(currentSessionId);
                session.lastActivity = Date.now();
                if (clientRole === 'receiver' && session.receiverWs === ws) {
                    session.receiverWs = null;
                    if (session.senderWs && session.senderWs.readyState === WebSocket.OPEN) {
                        session.senderWs.send(JSON.stringify({ type: 'receiver_disconnected' }));
                    }
                } else if (clientRole === 'sender' && session.senderWs === ws) {
                    session.senderWs = null;
                    if (session.receiverWs && session.receiverWs.readyState === WebSocket.OPEN) {
                        session.receiverWs.send(JSON.stringify({ type: 'sender_disconnected' }));
                    }
                }
            }
        });
    });
}

async function start() {
    // Setup SSL Certificate for HTTPS (regenerate if IP changed)
    let httpsOptions;
    const certDir = path.join(__dirname, '.cert');
    const certPath = path.join(certDir, 'cert.pem');
    const keyPath = path.join(certDir, 'key.pem');
    const ipRecordPath = path.join(certDir, 'ip.txt');

    let needNewCert = true;
    if (fs.existsSync(certPath) && fs.existsSync(keyPath) && fs.existsSync(ipRecordPath)) {
        const recordedIp = fs.readFileSync(ipRecordPath, 'utf8').trim();
        if (recordedIp === LAN_IP) {
            needNewCert = false;
            httpsOptions = {
                key: fs.readFileSync(keyPath),
                cert: fs.readFileSync(certPath)
            };
        }
    }

    if (needNewCert) {
        console.log(`[Security] Generating fresh TLS certificate for current IP: ${LAN_IP}...`);
        if (!fs.existsSync(certDir)) {
            fs.mkdirSync(certDir, { recursive: true });
        }
        const attrs = [
            { name: 'commonName', value: LAN_IP },
            { name: 'countryName', value: 'VN' },
            { name: 'organizationName', value: 'ScreenCast Pro' },
            { shortName: 'OU', value: 'MultiDisplay' }
        ];
        const pems = await selfsigned.generate(attrs, {
            days: 365,
            algorithm: 'sha256',
            extensions: [
                {
                    name: 'subjectAltName',
                    altNames: [
                        { type: 2, value: 'localhost' },
                        { type: 7, ip: '127.0.0.1' },
                        { type: 7, ip: LAN_IP }
                    ]
                }
            ]
        });
        fs.writeFileSync(keyPath, pems.private);
        fs.writeFileSync(certPath, pems.cert);
        fs.writeFileSync(ipRecordPath, LAN_IP);
        httpsOptions = {
            key: pems.private,
            cert: pems.cert
        };
        console.log('[Security] TLS certificates generated successfully.');
    }

    // Start HTTP and HTTPS servers
    const httpServer = http.createServer(app);
    const httpsServer = https.createServer(httpsOptions, app);

    // WebSocket Signaling Server attached to both servers
    const wssHttp = new WebSocketServer({ server: httpServer });
    const wssHttps = new WebSocketServer({ server: httpsServer });

    setupWebSocket(wssHttp);
    setupWebSocket(wssHttps);

    // Start listeners
    httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
        console.log(`\n======================================================`);
        console.log(`🚀 [ScreenCast Pro] Multi Display System Activated!`);
        console.log(`💻 PC Receiver URL:     http://localhost:${HTTP_PORT}`);
        console.log(`🌐 Local Network HTTP:  http://${LAN_IP}:${HTTP_PORT}`);
        console.log(`🔒 Local Network HTTPS: https://${LAN_IP}:${HTTPS_PORT}`);
        console.log(`📱 Mobile Web Client:   http://${LAN_IP}:${HTTP_PORT}/mobile`);
        console.log(`======================================================\n`);
    });

    httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
        // HTTPS ready
    });
}

start().catch(err => {
    console.error('Fatal Server Error:', err);
});
