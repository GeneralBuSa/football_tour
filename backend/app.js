import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import statsRoutes from './routes/stats.js';
import achievementsRoutes from './routes/achievements.js';
import gamesRoutes from './routes/games.js';
import storeRoutes from './routes/store.js';
import lobbyRoutes from './routes/lobby.js';
import friendsRoutes from './routes/friends.js';
import messagesRoutes from './routes/messages.js';
import savesRoutes from './routes/saves.js';
import multiplayerRoutes from './routes/multiplayer.js';
import paymentRoutes from './routes/payments.js';
import promoRoutes from './routes/promo.js';
import { createRateLimiter, securityHeaders } from './middleware/security.js';

// Express 4 async handler'lardaki reddedilen promise'leri yakalamaz; yakalanmayan
// bir hata (ör. Stripe/network) Node 20+ sürecini çökertir. Her route handler'ını
// sararak hataları global error handler'a iletiyoruz.
function forwardAsyncErrors(router) {
  for (const layer of router.stack) {
    if (!layer.route) continue;
    for (const routeLayer of layer.route.stack) {
      const handler = routeLayer.handle;
      if (handler.length > 3) continue;
      routeLayer.handle = function asyncSafeHandler(req, res, next) {
        try {
          const result = handler(req, res, next);
          if (result && typeof result.catch === 'function') result.catch(next);
          return result;
        } catch (error) {
          return next(error);
        }
      };
    }
  }
  return router;
}

export function createApp() {
  const app = express();

  // Reverse proxy (Render, Nginx vb.) arkasında rate limit'in gerçek istemci IP'sine
  // göre çalışması için TRUST_PROXY=1 ayarlanmalıdır.
  if (process.env.TRUST_PROXY) {
    const value = process.env.TRUST_PROXY;
    app.set('trust proxy', /^\d+$/.test(value) ? Number(value) : value);
  }
  app.disable('x-powered-by');

  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map(origin => origin.trim());
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      const error = new Error('Not allowed by CORS');
      error.status = 403;
      return callback(error);
    }
  }));
  app.use(securityHeaders);
  app.use(express.json({
    limit: '256kb',
    verify(req, _res, buf) {
      if (req.originalUrl === '/api/payments/webhook') req.rawBody = Buffer.from(buf);
    }
  }));
  app.use('/api', createRateLimiter({ windowMs: 60 * 1000, max: 300 }));

  // Kök adres bir web sayfası değildir; API'nin çalıştığını ve nereye bakılacağını söyler.
  app.get('/', (req, res) => {
    res.json({ name: 'Football Tour API', status: 'ok', health: '/api/health' });
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Football Tour Backend is running with Supabase' });
  });

  const routes = [
    ['/api/auth', authRoutes],
    ['/api/stats', statsRoutes],
    ['/api/achievements', achievementsRoutes],
    ['/api/games', gamesRoutes],
    ['/api/store', storeRoutes],
    ['/api/lobby', lobbyRoutes],
    ['/api/friends', friendsRoutes],
    ['/api/messages', messagesRoutes],
    ['/api/saves', savesRoutes],
    ['/api/multiplayer', multiplayerRoutes],
    ['/api/payments', paymentRoutes],
    ['/api/promo', promoRoutes]
  ];
  for (const [path, router] of routes) app.use(path, forwardAsyncErrors(router));

  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

  // Global Error Handler
  app.use((err, req, res, _next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body is too large' });
    }
    if (err.status === 403) {
      return res.status(403).json({ error: err.message });
    }
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err.message);
    if (res.headersSent) return res.end();
    return res.status(500).json({ error: 'Something went wrong!' });
  });

  return app;
}
