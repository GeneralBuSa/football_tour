import express from 'express';
import { randomInt } from 'node:crypto';
import { supabase } from '../db.js';
import { createAuthMiddleware, requireSameUser } from '../middleware/auth.js';
import { createRateLimiter, validateObjectBody } from '../middleware/security.js';
import { publishToSession } from '../services/realtime.js';
import { sendDbError } from '../middleware/errors.js';

const router = express.Router();
const authenticate = createAuthMiddleware();
// Oda kodu tahminine karşı kullanıcı başına katılma denemesi sınırı.
const joinPrivateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20, key: req => `join-private:${req.user.id}` });

// Karışabilecek karakterler (O/0, I/1) içermeyen 6 haneli oda kodu (~10^9 olasılık).
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_PATTERN = /^[A-Za-z0-9]{6}$/;

export function generateRoomCode() {
  let code = '';
  for (let i = 0; i < 6; i++) code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  return code;
}

function formatMatchResult(result) {
  return {
    status: result.status,
    matched_with: result.status === 'matched' ? (result.matched_username || 'Rakip') : undefined,
    avatar: result.status === 'matched' ? (result.avatar || '👤') : undefined,
    session_id: result.session_id || undefined
  };
}

// Lobi sırasına katıl ve hemen rakip ara
router.post('/join', authenticate, async (req, res) => {
  const { data, error } = await supabase.rpc('matchmake_player', { p_user_id: req.user.id });
  if (error) {
    console.error('[lobby/join] RPC failed:', error.message);
    return res.status(503).json({ error: 'Eşleştirme servisi şu anda kullanılamıyor.' });
  }

  const result = data?.[0];
  if (!result) return res.status(500).json({ error: 'Matchmaking result missing' });
  return res.json(formatMatchResult(result));
});

// Sıradan / özel odadan ayrıl
router.post('/leave', authenticate, async (req, res) => {
  const { data: cancelledSessionId, error } = await supabase.rpc('leave_matchmaking', { p_user_id: req.user.id });
  if (error) {
    console.error('[lobby/leave] RPC failed:', error.message);
    return res.status(503).json({ error: 'Eşleştirme servisi şu anda kullanılamıyor.' });
  }

  if (cancelledSessionId) {
    publishToSession(cancelledSessionId, { type: 'cancelled', user_id: req.user.id });
  }
  res.json({ success: true });
});

// Durumu yokla: kuyruk kaydını canlı tutar ve hâlâ arıyorsa yeniden eşleştirir
router.get('/status/:userId', authenticate, requireSameUser, async (req, res) => {
  const { data, error } = await supabase.rpc('poll_matchmaking', { p_user_id: req.user.id });
  if (error) {
    console.error('[lobby/status] RPC failed:', error.message);
    return res.status(503).json({ error: 'Eşleştirme servisi şu anda kullanılamıyor.' });
  }

  const result = data?.[0];
  if (!result) return res.json({ status: 'idle' });
  return res.json(formatMatchResult(result));
});

// Özel oda oluştur (Host). Her oda için yeni bir kod üretilir; katılmak için kullanıcı
// adıyla birlikte bu kod ya da oda sahibinden gelen bir oyun daveti gerekir.
router.post('/create-private', authenticate, async (req, res) => {
  const roomCode = generateRoomCode();
  const { error } = await supabase.rpc('open_private_room', { p_user_id: req.user.id, p_room_code: roomCode });

  if (error) return sendDbError(res, error);
  return res.json({ status: 'waiting_private', room_code: roomCode });
});

// Özel odaya katıl (Guest)
router.post('/join-private', authenticate, joinPrivateLimiter, validateObjectBody, async (req, res) => {
  const { host_username, room_code } = req.body;
  if (typeof host_username !== 'string' || !/^[A-Za-z0-9_]{3,24}$/.test(host_username.trim())) {
    return res.status(400).json({ error: 'Geçerli bir kullanıcı adı gerekli.' });
  }
  // Kod isteğe bağlıdır: davetle gelen arkadaş kodsuz katılabilir (sunucuda denetlenir).
  if (room_code !== undefined && room_code !== null && (typeof room_code !== 'string' || !ROOM_CODE_PATTERN.test(room_code.trim()))) {
    return res.status(400).json({ error: 'Oda kodu 6 karakter olmalıdır.' });
  }

  const { data, error } = await supabase.rpc('join_private_session', {
    p_user_id: req.user.id,
    p_host_username: host_username.trim(),
    p_room_code: typeof room_code === 'string' ? room_code.trim().toUpperCase() : null
  });

  if (error) {
    const message = error.message || 'Private room join failed';
    if (message.includes('HOST_NOT_FOUND')) return res.status(404).json({ error: 'Oda kurucusu bulunamadı!' });
    if (message.includes('CANNOT_JOIN_OWN_ROOM')) return res.status(400).json({ error: 'Kendi odanıza katılamazsınız!' });
    if (message.includes('ROOM_CODE_INVALID')) return res.status(403).json({ error: 'Oda kodu hatalı. Kodu oda sahibinden isteyin ya da davet bekleyin.' });
    if (message.includes('PRIVATE_ROOM_UNAVAILABLE')) {
      return res.status(404).json({ error: 'Aktif bir özel oda bulunamadı veya oda dolu!' });
    }
    console.error('[lobby/join-private] RPC failed:', message);
    return res.status(503).json({ error: 'Eşleştirme servisi şu anda kullanılamıyor.' });
  }

  const result = data?.[0];
  if (!result) return res.status(500).json({ error: 'Private room result missing' });
  publishToSession(result.session_id, { type: 'player_joined', user_id: req.user.id });
  return res.json(formatMatchResult(result));
});

export default router;
