import express from 'express';
import { supabase } from '../db.js';
import { createAuthMiddleware, requireSameUser } from '../middleware/auth.js';

const router = express.Router();
const authenticate = createAuthMiddleware();

// Liderlik tablosu için tüm istatistikleri getir
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('stats')
      .select('*, users (username)')
      .order('wins', { ascending: false })
      .limit(10);

    if (error) return res.status(400).json({ error: error.message });
    
    // UI'ın beklediği formata dönüştür
    const formattedData = data.map(item => ({
      playerName: item.users?.username || 'Bilinmeyen Oyuncu',
      score: item.total_earnings,
      properties: item.total_properties,
      turns: item.total_turns,
      wins: item.wins
    }));
    
    res.json(formattedData);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:userId', authenticate, requireSameUser, async (req, res) => {
  const { data, error } = await supabase
    .from('stats')
    .select('*')
    .eq('user_id', req.params.userId)
    .single();

  if (error) return res.status(404).json({ error: 'Stats not found' });
  res.json(data);
});

export default router;
