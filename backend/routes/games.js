import express from 'express';
import { supabase } from '../db.js';

const router = express.Router();

router.get('/:userId', async (req, res) => {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('user_id', req.params.userId)
    .order('played_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.post('/', async (req, res) => {
  const { user_id, result_data } = req.body;
  if (!user_id || !result_data) return res.status(400).json({ error: 'user_id and result_data required' });

  const { data, error } = await supabase
    .from('games')
    .insert([{ user_id, result_data }])
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
