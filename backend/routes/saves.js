import express from 'express';
import { supabase } from '../db.js';
import { createAuthMiddleware, requireSameUser } from '../middleware/auth.js';
import { validateObjectBody } from '../middleware/security.js';

const router = express.Router();
const authenticate = createAuthMiddleware();

// Oyun kaydet (Upsert)
router.post('/', authenticate, validateObjectBody, async (req, res) => {
  const { save_data } = req.body;
  if (!save_data) return res.status(400).json({ error: 'save_data required' });

  try {
    const { data, error } = await supabase
      .from('game_saves')
      .upsert({ user_id: req.user.id, save_data, updated_at: new Date().toISOString() })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Oyun yükle
router.get('/:userId', authenticate, requireSameUser, async (req, res) => {
  const { userId } = req.params;

  try {
    const { data, error } = await supabase
      .from('game_saves')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Kayıtlı oyun bulunamadı!' });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
