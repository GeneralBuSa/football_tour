import express from 'express';
import { supabase } from '../db.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { createRateLimiter, validateObjectBody } from '../middleware/security.js';
import { sendDbError } from '../middleware/errors.js';

const router = express.Router();
const authenticate = createAuthMiddleware();
// Kod tahmin etmeye (brute force) karşı hem kullanıcı hem IP bazlı sınır.
const userLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10, key: req => `promo:${req.user.id}` });
const ipLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 30, key: req => `promo-ip:${req.ip}` });

export const PROMO_CODE_PATTERN = /^[A-Z0-9-]{4,32}$/;

export function normalizePromoCode(value) {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return PROMO_CODE_PATTERN.test(code) ? code : null;
}

const ERRORS = {
  PROMO_NOT_FOUND: [404, 'Bu promosyon kodu geçersiz.'],
  PROMO_NOT_STARTED: [409, 'Bu promosyon kodu henüz aktif değil.'],
  PROMO_EXPIRED: [410, 'Bu promosyon kodunun süresi dolmuş.'],
  PROMO_EXHAUSTED: [410, 'Bu promosyon kodunun kullanım limiti dolmuş.'],
  PROMO_ALREADY_REDEEMED: [409, 'Bu kodu daha önce kullandın.']
};

router.post('/redeem', authenticate, ipLimiter, userLimiter, validateObjectBody, async (req, res) => {
  const code = normalizePromoCode(req.body.code);
  if (!code) {
    return res.status(400).json({ error: 'Kod 4-32 karakter olmalı; harf, rakam ve tire içerebilir.' });
  }

  const { data, error } = await supabase.rpc('redeem_promo_code', { p_user_id: req.user.id, p_code: code });
  if (error) {
    const known = Object.keys(ERRORS).find(key => error.message?.includes(key));
    if (known) {
      const [status, message] = ERRORS[known];
      return res.status(status).json({ error: message, code: known });
    }
    return sendDbError(res, error);
  }

  const result = data?.[0];
  if (!result) return res.status(500).json({ error: 'Promosyon sonucu alınamadı.' });
  res.json({
    code: result.out_code,
    coins: Number(result.out_coins) || 0,
    character_key: result.out_character || null,
    character_already_owned: !!result.out_character_already_owned,
    balance: result.out_balance === null ? null : Number(result.out_balance)
  });
});

export default router;
