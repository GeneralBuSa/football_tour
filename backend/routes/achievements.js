import express from 'express';
import { supabase } from '../db.js';
import { createAuthMiddleware, requireSameUser } from '../middleware/auth.js';
import { validateObjectBody } from '../middleware/security.js';
import { sendDbError } from '../middleware/errors.js';

const router = express.Router();
const authenticate = createAuthMiddleware();
const ALLOWED_ACHIEVEMENTS = new Set([
  'PROPERTIES_5', 'MAX_STADIUM', 'WIN_WORLD_CUP', 'GOLD_LOOT',
  'BANKRUPT', 'FIRST_WIN', 'RICH_PLAYER', 'FULL_GROUP'
]);

router.get('/:userId', authenticate, requireSameUser, async (req, res) => {
  const { data, error } = await supabase
    .from('achievements')
    .select('*')
    .eq('user_id', req.params.userId);

  if (error) return sendDbError(res, error);
  res.json(data);
});

router.post('/:userId', authenticate, requireSameUser, validateObjectBody, async (req, res) => {
  const { achievement_id } = req.body;
  if (typeof achievement_id !== 'string' || !ALLOWED_ACHIEVEMENTS.has(achievement_id)) {
    return res.status(400).json({ error: 'A valid achievement_id is required' });
  }

  const { data: existing } = await supabase
    .from('achievements')
    .select('*')
    .eq('user_id', req.params.userId)
    .eq('achievement_id', achievement_id)
    .limit(1)
    .maybeSingle();
  if (existing) return res.json(existing);

  const { data, error } = await supabase
    .from('achievements')
    .insert([{ user_id: req.params.userId, achievement_id }])
    .select()
    .single();

  if (error) return sendDbError(res, error);
  res.json(data);
});

export default router;
