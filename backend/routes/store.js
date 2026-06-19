import express from 'express';
import { supabase } from '../db.js';

const router = express.Router();

router.get('/items', async (req, res) => {
  const { data, error } = await supabase
    .from('store_items')
    .select('*');

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.post('/purchase', async (req, res) => {
  const { user_id, item_id } = req.body;
  if (!user_id || !item_id) return res.status(400).json({ error: 'user_id and item_id required' });

  const { data, error } = await supabase
    .from('purchases')
    .insert([{ user_id, item_id }])
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.get('/purchases/:userId', async (req, res) => {
  const { data, error } = await supabase
    .from('purchases')
    .select('*, store_items(*)')
    .eq('user_id', req.params.userId);

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
