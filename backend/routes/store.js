import express from 'express';
import { supabase } from '../db.js';
import { createAuthMiddleware, requireSameUser } from '../middleware/auth.js';

const router = express.Router();
const authenticate = createAuthMiddleware();

router.get('/items', async (req, res) => {
  const { data, error } = await supabase
    .from('store_items')
    .select('*');

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.post('/purchase', authenticate, async (req, res) => {
  const { item_id } = req.body;
  if (!item_id) return res.status(400).json({ error: 'item_id required' });

  const { data: item, error: itemError } = await supabase
    .from('store_items')
    .select('*')
    .eq('id', item_id)
    .single();

  if (itemError || !item) return res.status(404).json({ error: 'Item not found' });

  const { data: existingPurchase } = await supabase
    .from('purchases')
    .select('id')
    .eq('user_id', req.user.id)
    .eq('item_id', item_id)
    .maybeSingle();

  if (existingPurchase) return res.status(409).json({ error: 'Bu eşya zaten satın alınmış.' });

  const { data: stats, error: statsError } = await supabase
    .from('stats')
    .select('total_earnings')
    .eq('user_id', req.user.id)
    .single();

  if (statsError || !stats) return res.status(404).json({ error: 'Stats not found' });
  if ((stats.total_earnings || 0) < item.price) {
    return res.status(400).json({ error: 'Yetersiz bakiye' });
  }

  const newBalance = stats.total_earnings - item.price;
  const { error: updateError } = await supabase
    .from('stats')
    .update({ total_earnings: newBalance, updated_at: new Date().toISOString() })
    .eq('user_id', req.user.id);

  if (updateError) return res.status(400).json({ error: updateError.message });

  const { data, error } = await supabase
    .from('purchases')
    .insert([{ user_id: req.user.id, item_id }])
    .select('*, store_items(*)')
    .single();

  if (error) {
    await supabase
      .from('stats')
      .update({ total_earnings: stats.total_earnings, updated_at: new Date().toISOString() })
      .eq('user_id', req.user.id);
    return res.status(400).json({ error: error.message });
  }

  res.json({ ...data, balance: newBalance });
});

router.get('/purchases/:userId', authenticate, requireSameUser, async (req, res) => {
  const { data, error } = await supabase
    .from('purchases')
    .select('*, store_items(*)')
    .eq('user_id', req.params.userId);

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
