// Entry point: HTTP server (Express) + real-time server (Socket.io).
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { openDb } from './db.js';
import { loadSecret, makeAuth } from './security.js';
import { apiRouter } from './routes.js';
import { Game } from './game.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self' ws: wss:",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join('; ');

export function createServer({
  dbPath = process.env.DB_PATH || path.join(ROOT, 'data', 'city.db'),
  dataDir = path.dirname(dbPath === ':memory:' ? path.join(ROOT, 'data', 'x') : dbPath),
  secureCookies = process.env.NODE_ENV === 'production',
} = {}) {
  const repo = openDb(dbPath);
  const auth = makeAuth(loadSecret(dataDir), { secureCookies });

  const app = express();
  app.disable('x-powered-by');
  // Behind a hosting proxy (Render, Railway, Fly...) so req.ip is the real client.
  if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);

  app.use((req, res, next) => {
    res.set('Content-Security-Policy', CSP);
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.set('X-Frame-Options', 'DENY');
    next();
  });

  const server = http.createServer(app);
  const io = new Server(server, { serveClient: true, maxHttpBufferSize: 16 * 1024 });
  // Socket auth: same session cookie as the REST API.
  io.use((socket, next) => {
    const uid = auth.uidFromCookieHeader(socket.handshake.headers.cookie);
    if (!uid) return next(new Error('unauthorized'));
    socket.data.uid = uid;
    next();
  });
  const game = new Game(io, repo);

  app.use(express.json({ limit: '600kb' }));
  const api = apiRouter({ repo, auth, game });
  app.use('/api', api);

  app.get('/vendor/three.module.js', (req, res) =>
    res.sendFile(path.join(ROOT, 'node_modules/three/build/three.module.min.js')));
  app.use('/shared', express.static(path.join(ROOT, 'shared')));
  app.use(express.static(path.join(ROOT, 'public'), { extensions: ['html'] }));

  const close = () =>
    new Promise((resolve) => {
      game.stop();
      api.limiters.forEach((l) => l.stop());
      io.close();
      server.close(() => {
        repo.close();
        resolve();
      });
    });

  return { app, server, io, game, repo, close };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 3000;
  const s = createServer();
  s.server.listen(port, () => console.log(`شهر دیجیتال روی http://localhost:${port} اجرا شد`));
  const shutdown = () => s.close().then(() => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
