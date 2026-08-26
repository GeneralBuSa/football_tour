import express from 'express';
import { supabase } from '../db.js';
import { createAuthMiddleware, requireSameUser } from '../middleware/auth.js';
import { validateObjectBody } from '../middleware/security.js';

const router = express.Router();
const authenticate = createAuthMiddleware();

router.get('/items', async (req, res) => {
  const { data, error } = await supabase
    .from('store_items')
    .select('*')
    .eq('is_active', true);

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.get('/players', async (_req, res) => {
  const { data, error } = await supabase
    .from('store_items')
    .select('*')
    .eq('type', 'Player')
    .eq('currency', 'COIN')
    .eq('is_active', true)
    .order('price', { ascending: true });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.post('/starter/claim', authenticate, validateObjectBody, async (req, res) => {
  const { character_key } = req.body;
  if (!['viking', 'rocket'].includes(character_key)) {
    return res.status(400).json({ error: 'Starter character must be viking or rocket' });
  }
  const { data, error } = await supabase.rpc('claim_starter_character', {
    p_user_id: req.user.id,
    p_character_key: character_key
  });
  if (error) {
    if (error.message?.includes('STARTER_ALREADY_CLAIMED')) return res.status(409).json({ error: 'Starter character already claimed' });
    console.error('[store/starter] RPC failed:', error.message);
    return res.status(503).json({ error: 'Başlangıç karakter sistemi hazır değil. Supabase migration SQL dosyasını çalıştırın.' });
  }
  res.json({ character_key, claimed: true, result: data?.[0] || null });
});

router.get('/entitlements/:userId', authenticate, requireSameUser, async (req, res) => {
  const { data, error } = await supabase
    .from('character_entitlements')
    .select('character_key, source, granted_at')
    .eq('user_id', req.user.id)
    .order('granted_at', { ascending: true });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.post('/purchase', authenticate, validateObjectBody, async (req, res) => {
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
    if (message.includes('no unique or exclusion constraint matching the ON CONFLICT specification')) {
      return res.status(500).json({
        error: 'purchases tablosunda (user_id, item_id) için unique constraint eksik. database/schema.sql dosyasını yeniden uygulayın.'
      });
    }

    console.error('[store/purchase] RPC failed:', message);
    return res.status(503).json({ error: 'Purchase service is temporarily unavailable' });
  }

  const purchase = data?.[0];
  if (!purchase) return res.status(500).json({ error: 'Purchase result missing' });

  res.json({
    id: purchase.purchase_id || purchase.out_purchase_id,
    user_id: req.user.id,
    item_id: purchase.item_id || purchase.out_item_id || item_id,
    balance: purchase.balance ?? purchase.out_balance
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
