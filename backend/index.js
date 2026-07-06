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
app.use(express.json());

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

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});



