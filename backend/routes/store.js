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

  const { data, error } = await supabase.rpc('purchase_store_item', {
    p_user_id: req.user.id,
    p_item_id: item_id
  });

  if (error) {
    const message = error.message || 'Purchase failed';
    if (message.includes('ITEM_NOT_FOUND')) return res.status(404).json({ error: 'Item not found' });
    if (message.includes('ITEM_ALREADY_PURCHASED')) return res.status(409).json({ error: 'Bu eşya zaten satın alınmış.' });
    if (message.includes('INSUFFICIENT_BALANCE')) return res.status(400).json({ error: 'Yetersiz bakiye' });

    // Özel bilinen hatalar dışındaki tüm SQL/fonksiyon/kısıt (ON CONFLICT vb.) hatalarında JS fallback çalıştır
    const { data: item, error: itemErr } = await supabase
      .from('store_items')
      .select('id, price')
      .eq('id', item_id)
      .maybeSingle();

    if (itemErr || !item) return res.status(404).json({ error: 'Item not found' });

    const { data: existing } = await supabase
      .from('purchases')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('item_id', item_id)
      .maybeSingle();

    if (existing) return res.status(409).json({ error: 'Bu eşya zaten satın alınmış.' });

    const { data: userStats } = await supabase
      .from('stats')
      .select('total_earnings')
      .eq('user_id', req.user.id)
      .maybeSingle();

    const currentBalance = Number(userStats?.total_earnings || 0);
    if (currentBalance < Number(item.price)) {
      return res.status(400).json({ error: 'Yetersiz bakiye' });
    }

    const newBalance = currentBalance - Number(item.price);

    const { data: purchaseData, error: purchaseErr } = await supabase
      .from('purchases')
      .insert([{ user_id: req.user.id, item_id }])
      .select()
      .single();

    if (purchaseErr) {
      if (purchaseErr.code === '23505' || purchaseErr.message.includes('unique')) {
        return res.status(409).json({ error: 'Bu eşya zaten satın alınmış.' });
      }
      return res.status(400).json({ error: purchaseErr.message });
    }

    await supabase
      .from('stats')
      .update({ total_earnings: newBalance, updated_at: new Date().toISOString() })
      .eq('user_id', req.user.id);

    return res.json({
      id: purchaseData.id,
      user_id: req.user.id,
      item_id,
      balance: newBalance
    });

    return res.status(400).json({ error: message });
  }

  const purchase = data?.[0];
  if (!purchase) return res.status(500).json({ error: 'Purchase result missing' });

  res.json({
    id: purchase.purchase_id || purchase.out_purchase_id,
    user_id: req.user.id,
    item_id: purchase.item_id || purchase.out_item_id || item_id,
    balance: purchase.balance || purchase.out_balance
  });
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
