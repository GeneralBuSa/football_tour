import express from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../db.js';
import { createAuthMiddleware, requireEnv } from '../middleware/auth.js';
import { createRateLimiter, validateObjectBody } from '../middleware/security.js';
import { openEventStream, publishToUser, subscribeToUser } from '../services/realtime.js';
import { areFriends } from './friends.js';
import { sendDbError } from '../middleware/errors.js';

const router = express.Router();
const authenticate = createAuthMiddleware();
const jwtSecret = requireEnv('JWT_SECRET');
const sendLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 30, key: req => `msg:${req.user.id}` });
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_MESSAGE_LENGTH = 500;

export function normalizeMessageBody(body) {
  if (typeof body !== 'string') return null;
  const trimmed = body.replace(/\r\n/g, '\n').trim();
  if (!trimmed || trimmed.length > MAX_MESSAGE_LENGTH) return null;
  return trimmed;
}

async function getAcceptedFriendIds(userId) {
  const [{ data: sent }, { data: received }] = await Promise.all([
    supabase.from('friends').select('friend_id').eq('user_id', userId).eq('status', 'accepted'),
    supabase.from('friends').select('user_id').eq('friend_id', userId).eq('status', 'accepted')
  ]);
  return [...(sent || []).map(row => row.friend_id), ...(received || []).map(row => row.user_id)];
}

async function insertMessage(res, { senderId, senderUsername, recipientId, kind, body }) {
  const { data, error } = await supabase
    .from('direct_messages')
    .insert([{ sender_id: senderId, recipient_id: recipientId, kind, body }])
    .select()
    .single();
  if (error) {
    res.status(400).json({ error: 'Mesaj gönderilemedi.' });
    return null;
  }

  const message = { ...data, sender_username: senderUsername };
  publishToUser(recipientId, { type: 'message', message });
  publishToUser(senderId, { type: 'message', message });
  return message;
}

// Kullanıcıya özel canlı bildirim akışı (mesajlar, arkadaşlık değişiklikleri).
// EventSource custom header gönderemediği için token query string ile gelir.
router.get('/stream', async (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(401).end();

  let user;
  try {
    user = jwt.verify(token, jwtSecret);
  } catch {
    return res.status(401).end();
  }

  const friendIds = await getAcceptedFriendIds(user.id).catch(() => []);
  const send = openEventStream(req, res, () => {
    unsubscribe();
    friendIds.forEach(id => publishToUser(id, { type: 'friends_changed', action: 'presence' }));
  });
  const unsubscribe = subscribeToUser(user.id, send);
  send({ type: 'connected' });
  friendIds.forEach(id => publishToUser(id, { type: 'friends_changed', action: 'presence' }));
});

// Arkadaş başına okunmamış mesaj sayıları
router.get('/unread', authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from('direct_messages')
    .select('sender_id')
    .eq('recipient_id', req.user.id)
    .is('read_at', null);
  if (error) return sendDbError(res, error);

  const counts = {};
  (data || []).forEach(row => { counts[row.sender_id] = (counts[row.sender_id] || 0) + 1; });
  res.json({ counts });
});

// Bir arkadaşla olan konuşma geçmişi (eskiden yeniye). Gelen mesajlar okundu işaretlenir.
router.get('/:friendId', authenticate, async (req, res) => {
  const { friendId } = req.params;
  if (!UUID_PATTERN.test(friendId)) return res.status(400).json({ error: 'Geçerli bir friend_id gerekli.' });
  if (!(await areFriends(req.user.id, friendId))) {
    return res.status(403).json({ error: 'Sadece arkadaşlarınızla mesajlaşabilirsiniz.' });
  }

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  const { data, error } = await supabase.rpc('get_conversation', {
    p_user_id: req.user.id,
    p_friend_id: friendId,
    p_limit: limit
  });
  if (error) return sendDbError(res, error);

  await supabase
    .from('direct_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', req.user.id)
    .eq('sender_id', friendId)
    .is('read_at', null);

  res.json(data || []);
});

// Arkadaşa mesaj gönder
router.post('/', authenticate, sendLimiter, validateObjectBody, async (req, res) => {
  const { friend_id } = req.body;
  const body = normalizeMessageBody(req.body.body);
  if (typeof friend_id !== 'string' || !UUID_PATTERN.test(friend_id)) {
    return res.status(400).json({ error: 'Geçerli bir friend_id gerekli.' });
  }
  if (!body) {
    return res.status(400).json({ error: `Mesaj 1-${MAX_MESSAGE_LENGTH} karakter olmalıdır.` });
  }
  if (!(await areFriends(req.user.id, friend_id))) {
    return res.status(403).json({ error: 'Sadece arkadaşlarınızla mesajlaşabilirsiniz.' });
  }

  const message = await insertMessage(res, {
    senderId: req.user.id,
    senderUsername: req.user.username,
    recipientId: friend_id,
    kind: 'text',
    body
  });
  if (message) res.status(201).json(message);
});

// Arkadaşı kurulmuş özel odaya davet et. Gönderenin açık bir özel odası olmalıdır.
router.post('/invite', authenticate, sendLimiter, validateObjectBody, async (req, res) => {
  const { friend_id } = req.body;
  if (typeof friend_id !== 'string' || !UUID_PATTERN.test(friend_id)) {
    return res.status(400).json({ error: 'Geçerli bir friend_id gerekli.' });
  }
  if (!(await areFriends(req.user.id, friend_id))) {
    return res.status(403).json({ error: 'Sadece arkadaşlarınızı davet edebilirsiniz.' });
  }

  const { data: room } = await supabase
    .from('lobby_queue')
    .select('status')
    .eq('user_id', req.user.id)
    .maybeSingle();
  if (room?.status !== 'waiting_private') {
    return res.status(409).json({ error: 'Davet göndermek için önce özel oda kurun.' });
  }

  const message = await insertMessage(res, {
    senderId: req.user.id,
    senderUsername: req.user.username,
    recipientId: friend_id,
    kind: 'game_invite',
    body: `${req.user.username} seni özel oyununa davet etti.`
  });
  if (message) res.status(201).json(message);
});

export default router;
