import express from 'express';
import { supabase } from '../db.js';
import { createAuthMiddleware, requireSameUser } from '../middleware/auth.js';
import { validateObjectBody } from '../middleware/security.js';

const router = express.Router();
const authenticate = createAuthMiddleware();

router.get('/:userId', authenticate, requireSameUser, async (req, res) => {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('user_id', req.params.userId)
    .order('played_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.post('/', authenticate, validateObjectBody, async (req, res) => {
  const { result_data } = req.body;
  if (!result_data || typeof result_data !== 'object' || Array.isArray(result_data)) {
    return res.status(400).json({ error: 'result_data object required' });
  }

  const { data, error } = await supabase
    .from('games')
    .insert([{ user_id: req.user.id, result_data }])
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
