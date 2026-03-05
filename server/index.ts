import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { authMiddleware } from './middleware/auth.js';
import { errorHandler } from './middleware/errors.js';
import { attachWebSocketServer } from './ws/live.js';

import generateRouter from './routes/generate.js';
import usersRouter from './routes/users.js';
import imagesRouter from './routes/images.js';
import scansRouter from './routes/scans.js';
import chatsRouter from './routes/chats.js';
import generateImageRouter from './routes/generateImage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Middleware
app.use(cors({
  origin: config.allowedOrigins,
  credentials: true,
  allowedHeaders: ['Content-Type', 'X-User-Id'],
  methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
}));

app.use(express.json({ limit: '50mb' }));

// Health check (no auth)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// POST /api/users — no auth (creates the user)
// GET/PATCH /api/users/:userId — auth handled inside the router
// GET /api/users/:userId/scans — auth handled inside the router
app.use('/api/users', usersRouter);

// All remaining API routes require auth
app.use('/api/generate', authMiddleware, generateRouter);
app.use('/api/images', authMiddleware, imagesRouter);
app.use('/api/scans', authMiddleware, scansRouter);
app.use('/api/scans', authMiddleware, chatsRouter);
app.use('/api/generate-image', authMiddleware, generateImageRouter);

// Error handler
app.use(errorHandler);

// In production, serve the built frontend from dist/
const distPath = path.resolve(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Create HTTP server and attach WebSocket
const server = http.createServer(app);
attachWebSocketServer(server);

server.listen(config.port, () => {
  console.log(`ArtLens AI proxy listening on port ${config.port}`);
});
