import express from 'express';
import { supabase } from '../db.js';
import { createAuthMiddleware, requireSameUser } from '../middleware/auth.js';

const router = express.Router();
const authenticate = createAuthMiddleware();

router.get('/:userId', authenticate, requireSameUser, async (req, res) => {
  const { data, error } = await supabase
    .from('achievements')
    .select('*')
    .eq('user_id', req.params.userId);

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.post('/:userId', authenticate, requireSameUser, async (req, res) => {
  const { achievement_id } = req.body;
  if (!achievement_id) return res.status(400).json({ error: 'achievement_id required' });

  const { data, error } = await supabase
    .from('achievements')
    .insert([{ user_id: req.params.userId, achievement_id }])
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
