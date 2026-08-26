import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import statsRoutes from './routes/stats.js';
import achievementsRoutes from './routes/achievements.js';
import gamesRoutes from './routes/games.js';
import storeRoutes from './routes/store.js';
import lobbyRoutes from './routes/lobby.js';
import friendsRoutes from './routes/friends.js';
import savesRoutes from './routes/saves.js';
import multiplayerRoutes from './routes/multiplayer.js';
import paymentRoutes from './routes/payments.js';
import { createRateLimiter, securityHeaders } from './middleware/security.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Middlewares
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map(origin => origin.trim());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Football Tour Backend is running with Supabase' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/achievements', achievementsRoutes);
app.use('/api/games', gamesRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/lobby', lobbyRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/saves', savesRoutes);
app.use('/api/multiplayer', multiplayerRoutes);
app.use('/api/payments', paymentRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err.message);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});



