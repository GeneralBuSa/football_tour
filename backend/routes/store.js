import express from 'express';
import { supabase } from '../db.js';
import { createAuthMiddleware, requireSameUser } from '../middleware/auth.js';
import { validateObjectBody } from '../middleware/security.js';
import { sendDbError } from '../middleware/errors.js';

const router = express.Router();
const authenticate = createAuthMiddleware();
const CHARACTER_KEYS = ['architect', 'king', 'viking', 'rocket', 'wizard'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get('/items', async (req, res) => {
  const { data, error } = await supabase
    .from('store_items')
    .select('*')
    .eq('is_active', true);

  if (error) return sendDbError(res, error);
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
  if (error) return sendDbError(res, error);
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
  // Henüz karakter seçmemiş oyuncu için başlangıç karakteri oyundaki modeli olur.
  await supabase.from('users').update({ selected_character: character_key }).eq('id', req.user.id).is('selected_character', null);
  res.json({ character_key, claimed: true, result: data?.[0] || null });
});

// Oyunda kullanılacak karakteri seç (yalnızca sahip olunan karakterler; null = varsayılan)
router.put('/characters/selected', authenticate, validateObjectBody, async (req, res) => {
  const { character_key } = req.body;
  if (character_key !== null && !CHARACTER_KEYS.includes(character_key)) {
    return res.status(400).json({ error: 'Geçersiz karakter.' });
  }
  if (character_key) {
    const { data: owned, error: ownedError } = await supabase
      .from('character_entitlements')
      .select('character_key')
      .eq('user_id', req.user.id)
      .eq('character_key', character_key)
      .maybeSingle();
    if (ownedError) return sendDbError(res, ownedError);
    if (!owned) return res.status(403).json({ error: 'Bu karaktere sahip değilsin.' });
  }
  const { data, error } = await supabase
    .from('users')
    .update({ selected_character: character_key })
    .eq('id', req.user.id)
    .select('selected_character')
    .single();
  if (error) return sendDbError(res, error);
  res.json(data);
});

router.get('/entitlements/:userId', authenticate, requireSameUser, async (req, res) => {
  const { data, error } = await supabase
    .from('character_entitlements')
    .select('character_key, source, granted_at')
    .eq('user_id', req.user.id)
    .order('granted_at', { ascending: true });
  if (error) return sendDbError(res, error);
  res.json(data);
});

router.post('/purchase', authenticate, validateObjectBody, async (req, res) => {
  const { item_id } = req.body;
  if (typeof item_id !== 'string' || !UUID_PATTERN.test(item_id)) return res.status(400).json({ error: 'item_id required' });

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

  if (error) return sendDbError(res, error);
  res.json(data);
});

export default router;
