import express from 'express';
import { supabase } from '../db.js';

const router = express.Router();

// Oyun kaydet (Upsert)
router.post('/', async (req, res) => {
  const { user_id, save_data } = req.body;
  if (!user_id || !save_data) return res.status(400).json({ error: 'user_id and save_data required' });

  try {
    const { data, error } = await supabase
      .from('game_saves')
      .upsert({ user_id, save_data, updated_at: new Date().toISOString() })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Oyun yükle
router.get('/:userId', async (req, res) => {
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
