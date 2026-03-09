import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { authMiddleware } from './middleware/auth.js';
import { errorHandler } from './middleware/errors.js';
import { attachWebSocketServer } from './ws/live.js';
import { log } from './utils/logger.js';

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

// Request logging — skip static files and health checks
app.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.path.startsWith('/api')) return next();
  const start = Date.now();
  const userId = (req.headers['x-user-id'] as string)?.slice(0, 8);
  res.on('finish', () => {
    log.req(req.method, req.path, res.statusCode, Date.now() - start, userId ? { user: userId } : undefined);
  });
  next();
});

// Health check (no auth)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// POST /api/users — no auth (creates the user)
// GET/PATCH /api/users/:userId — auth handled inside the router
// GET /api/users/:userId/scans — auth handled inside the router
app.use('/api/users', usersRouter);

// Image streaming — no auth required (paths contain UUIDs as access tokens)
// Upload still requires auth (POST handler checks userId)
app.use('/api/images', imagesRouter);

// All remaining API routes require auth
app.use('/api/generate', authMiddleware, generateRouter);
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
  log.info('server', `Listening on port ${config.port}`, {
    project: config.projectId,
    models: {
      text: config.vertex.modelText,
      textFallback: config.vertex.modelTextFallback,
      image: config.vertex.modelImage,
      live: config.vertex.modelLive,
    },
  });
});
