import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// CRITICAL for Cloud Run: must listen on process.env.PORT if provided
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '50mb' }));

// Health check endpoints for Cloud Run ingress and container probes
app.get('/health', (_req, res) => res.status(200).send('OK'));
app.get('/api/health', (_req, res) => res.status(200).json({ status: 'ok', port: PORT }));

// In-memory room store for SSE peers
interface PeerConnection {
  deviceId: string;
  res: express.Response;
  lastSeen: number;
}

const rooms = new Map<string, {
  hostId: string | null;
  clients: Map<string, PeerConnection>;
  lastState: any;
}>();

function getOrCreateRoom(roomId: string) {
  let room = rooms.get(roomId);
  if (!room) {
    room = {
      hostId: null,
      clients: new Map(),
      lastState: null,
    };
    rooms.set(roomId, room);
  }
  return room;
}

// Ping endpoint for NTP server clock
app.post('/api/rooms/:roomId/ping', (req, res) => {
  const { clientTime } = req.body;
  const serverTime = Date.now();
  res.json({
    clientTime,
    serverTime,
  });
});

// SSE endpoint for live room messages
app.get('/api/rooms/:roomId/events', (req, res) => {
  const roomId = req.params.roomId.toUpperCase();
  const deviceId = (req.query.deviceId as string) || `dev-${Math.random().toString(36).substring(2, 8)}`;
  const isHost = req.query.isHost === 'true';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const room = getOrCreateRoom(roomId);
  if (isHost || !room.hostId) {
    room.hostId = deviceId;
  }

  room.clients.set(deviceId, {
    deviceId,
    res,
    lastSeen: Date.now(),
  });

  res.write(`data: ${JSON.stringify({
    type: 'ROOM_JOINED',
    deviceId,
    roomId,
    isHost: room.hostId === deviceId,
    clientCount: room.clients.size,
    lastState: room.lastState,
  })}\n\n`);

  broadcastToRoom(roomId, {
    type: 'PEER_JOINED',
    deviceId,
    clientCount: room.clients.size,
  }, deviceId);

  req.on('close', () => {
    room.clients.delete(deviceId);
    if (room.hostId === deviceId) {
      const firstClient = room.clients.keys().next().value;
      room.hostId = firstClient || null;
    }
    broadcastToRoom(roomId, {
      type: 'PEER_LEFT',
      deviceId,
      clientCount: room.clients.size,
      newHostId: room.hostId,
    });
  });
});

function broadcastToRoom(roomId: string, message: any, excludeDeviceId?: string) {
  const room = rooms.get(roomId);
  if (!room) return;
  const payload = `data: ${JSON.stringify(message)}\n\n`;
  for (const [id, client] of room.clients.entries()) {
    if (excludeDeviceId && id === excludeDeviceId) continue;
    try {
      client.res.write(payload);
    } catch {
      room.clients.delete(id);
    }
  }
}

app.post('/api/rooms/:roomId/message', (req, res) => {
  const roomId = req.params.roomId.toUpperCase();
  const { message, senderId } = req.body;
  const room = getOrCreateRoom(roomId);

  if (message.type === 'PLAY' || message.type === 'PAUSE' || message.type === 'TRACK_UPDATE') {
    room.lastState = message;
  }

  broadcastToRoom(roomId, message, senderId);
  res.json({ ok: true, peerCount: room.clients.size });
});

app.get('/api/rooms/:roomId', (req, res) => {
  const roomId = req.params.roomId.toUpperCase();
  const room = rooms.get(roomId);
  if (!room) {
    return res.json({ exists: false, peerCount: 0 });
  }
  res.json({
    exists: true,
    hostId: room.hostId,
    peerCount: room.clients.size,
    lastState: room.lastState,
  });
});

// Serve static assets from public directly
const publicPath = path.resolve(__dirname, 'public');
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
}

async function startServer() {
  const distPath = path.resolve(__dirname, 'dist');
  const hasDist = fs.existsSync(path.join(distPath, 'index.html'));

  // If in production or dist/ exists, serve static build
  if (process.env.NODE_ENV === 'production' || (hasDist && process.env.NODE_ENV !== 'development')) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    // In dev mode, mount Vite middleware
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (err) {
      console.warn('Vite middleware could not be loaded, falling back to dist:', err);
      if (hasDist) {
        app.use(express.static(distPath));
        app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
      }
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Party Speaker server listening on port ${PORT} (NODE_ENV=${process.env.NODE_ENV})`);
  });
}

startServer();
