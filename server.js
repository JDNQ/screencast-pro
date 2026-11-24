const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const https = require('https');
const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');
const QRCode = require('qrcode');
const selfsigned = require('selfsigned');
const { Bonjour } = require('bonjour-service');

const HTTP_PORT = process.env.HTTP_PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

// Find best local IPv4 address
function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    let preferredIp = '127.0.0.1';
    
    // Sort interfaces to prioritize Wi-Fi and Ethernet
    const order = ['wi-fi', 'wifi', 'ethernet', 'en0', 'wlan0', 'eth0'];
    
    for (const pref of order) {
        for (const name of Object.keys(interfaces)) {
            if (name.toLowerCase().includes(pref)) {
                for (const iface of interfaces[name]) {
                    if (iface.family === 'IPv4' && !iface.internal) {
                        return iface.address;
                    }
                }
            }
        }
    }
    
    // Fallback: any non-internal IPv4 that isn't virtual (ignore 169.254, 26.)
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                if (!iface.address.startsWith('169.254') && !iface.address.startsWith('26.')) {
                    return iface.address;
                }
                preferredIp = iface.address;
            }
        }
    }
    
    return preferredIp;
}

const LAN_IP = getLocalIpAddress();

// Express App
const app = express();
app.use(express.json());

// Serve static receiver files for PC
app.use('/', express.static(path.join(__dirname, 'public')));

// Serve mobile client
app.use('/mobile', express.static(path.join(__dirname, 'mobile-client')));

// Active sessions: sessionId -> { receiverWs, senderWs, createdAt }
const sessions = new Map();

function generateSessionId() {
    return 'CAST-' + Math.floor(100000 + Math.random() * 900000);
}

// API: Get server connection info and QR code
app.get('/api/session/new', async (req, res) => {
    const sessionId = generateSessionId();
    sessions.set(sessionId, {
        receiverWs: null,
        senderWs: null,
        createdAt: Date.now()
    });

    // Mobile URL will use HTTPS so browser allows camera/screen capture APIs
    const mobileUrl = `https://${LAN_IP}:${HTTPS_PORT}/mobile/?session=${sessionId}`;
    const httpFallbackUrl = `http://${LAN_IP}:${HTTP_PORT}/mobile/?session=${sessionId}`;
    
    try {
        const qrDataUrl = await QRCode.toDataURL(mobileUrl, {
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
            lanIp: LAN_IP,
            httpPort: HTTP_PORT,
            httpsPort: HTTPS_PORT,
            mobileUrl,
            httpFallbackUrl,
            qrCode: qrDataUrl
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// API: Get IP and system info
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

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                const { type, sessionId, payload } = data;

                switch (type) {
                    case 'register': {
                        currentSessionId = sessionId;
                        clientRole = data.role; // 'receiver' or 'sender'
                        
                        let session = sessions.get(sessionId);
                        if (!session) {
                            session = { receiverWs: null, senderWs: null, createdAt: Date.now() };
                            sessions.set(sessionId, session);
                        }

                        if (clientRole === 'receiver') {
                            session.receiverWs = ws;
                            console.log(`[Session ${sessionId}] PC Receiver connected.`);
                            ws.send(JSON.stringify({ type: 'registered', role: 'receiver' }));
                            
                            // If sender is already waiting, notify both
                            if (session.senderWs && session.senderWs.readyState === WebSocket.OPEN) {
                                session.receiverWs.send(JSON.stringify({ type: 'sender_ready' }));
                                session.senderWs.send(JSON.stringify({ type: 'receiver_ready' }));
                            }
                        } else if (clientRole === 'sender') {
                            session.senderWs = ws;
                            console.log(`[Session ${sessionId}] Mobile Sender connected.`);
                            ws.send(JSON.stringify({ type: 'registered', role: 'sender' }));

                            if (session.receiverWs && session.receiverWs.readyState === WebSocket.OPEN) {
                                session.receiverWs.send(JSON.stringify({ type: 'sender_ready' }));
                                session.senderWs.send(JSON.stringify({ type: 'receiver_ready' }));
                            }
                        }
                        break;
                    }

                    case 'signal': {
                        // Forward WebRTC signaling (offer, answer, candidate) to the opposite peer
                        const session = sessions.get(currentSessionId);
                        if (!session) return;

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

                if (!session.receiverWs && !session.senderWs) {
                    setTimeout(() => {
                        const s = sessions.get(currentSessionId);
                        if (s && !s.receiverWs && !s.senderWs) {
                            sessions.delete(currentSessionId);
                        }
                    }, 5 * 60 * 1000);
                }
            }
        });
    });
}

async function start() {
    // Setup SSL Certificate for HTTPS
    let httpsOptions;
    const certDir = path.join(__dirname, '.cert');
    const certPath = path.join(certDir, 'cert.pem');
    const keyPath = path.join(certDir, 'key.pem');

    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        httpsOptions = {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath)
        };
    } else {
        console.log('[Security] Generating self-signed TLS certificates for local HTTPS...');
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
        console.log(`📱 Mobile Web Client:   https://${LAN_IP}:${HTTPS_PORT}/mobile`);
        console.log(`🍎 Apple iOS AirPlay:   Broadcast active on LAN via Bonjour`);
        console.log(`======================================================\n`);

        // Advertise mDNS AirPlay service on LAN for Apple devices
        try {
            const bonjour = new Bonjour();
            bonjour.publish({
                name: `ScreenCast-Pro-${os.hostname()}`,
                type: 'airplay',
                port: 7000,
                txt: {
                    model: 'AppleTV3,2',
                    srcvers: '220.68',
                    flags: '0x4'
                }
            });
            console.log(`[mDNS/Bonjour] AirPlay service advertised as: ScreenCast-Pro-${os.hostname()}`);
        } catch (e) {
            console.warn('[mDNS/Bonjour] Could not publish mDNS broadcast:', e.message);
        }
    });

    httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
        // HTTPS ready
    });
}

start().catch(err => {
    console.error('Fatal Server Error:', err);
});
