import express from 'express';
import { supabase } from '../db.js';
import { createAuthMiddleware, requireSameUser } from '../middleware/auth.js';
import { validateObjectBody } from '../middleware/security.js';
import { isUserOnline, publishToUser } from '../services/realtime.js';
import { sendDbError } from '../middleware/errors.js';

const router = express.Router();
const authenticate = createAuthMiddleware();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// İki kullanıcı arasındaki (her iki yöndeki) arkadaşlık kaydını getirir.
export async function findRelationship(userId, otherUserId) {
  const { data, error } = await supabase
    .from('friends')
    .select('*')
    .in('user_id', [userId, otherUserId])
    .in('friend_id', [userId, otherUserId]);
  if (error) throw new Error(error.message);
  return (data || []).find(row => row.user_id !== row.friend_id) || null;
}

export async function areFriends(userId, otherUserId) {
  const relation = await findRelationship(userId, otherUserId);
  return relation?.status === 'accepted';
}

function notifyFriendChange(userIds, action) {
  userIds.forEach(id => publishToUser(id, { type: 'friends_changed', action }));
}

// Arkadaşları ve bekleyen istekleri listele
router.get('/:userId', authenticate, requireSameUser, async (req, res) => {
  const { userId } = req.params;

  const { data: sent, error: errorSent } = await supabase
    .from('friends')
    .select('*, users:friend_id(id, username, avatar)')
    .eq('user_id', userId);

  const { data: received, error: errorRec } = await supabase
    .from('friends')
    .select('*, users:user_id(id, username, avatar)')
    .eq('friend_id', userId);

  if (errorSent || errorRec) {
    return sendDbError(res, errorSent || errorRec);
  }

  const toEntry = (row, isSender) => ({
    id: row.id,
    friend_id: row.users?.id,
    username: row.users?.username || 'Bilinmeyen Kullanıcı',
    avatar: row.users?.avatar || '👤',
    status: row.status,
    is_sender: isSender,
    online: row.status === 'accepted' && !!row.users?.id && isUserOnline(row.users.id)
  });

  res.json([
    ...(sent || []).map(row => toEntry(row, true)),
    ...(received || []).map(row => toEntry(row, false))
  ]);
});

// Arkadaş isteği gönder. Karşı taraf zaten istek gönderdiyse doğrudan kabul edilir.
router.post('/add', authenticate, validateObjectBody, async (req, res) => {
  const { friend_username } = req.body;
  const user_id = req.user.id;
  if (typeof friend_username !== 'string' || !/^[A-Za-z0-9_]{3,24}$/.test(friend_username.trim())) {
    return res.status(400).json({ error: 'Geçerli bir kullanıcı adı girin.' });
  }

  const { data: friend, error: userError } = await supabase
    .from('users')
    .select('id, username')
    .eq('username', friend_username.trim())
    .maybeSingle();

  if (userError || !friend) return res.status(404).json({ error: 'Kullanıcı bulunamadı!' });
  if (friend.id === user_id) return res.status(400).json({ error: 'Kendinizi arkadaş ekleyemezsiniz!' });

  const existing = await findRelationship(user_id, friend.id);
  if (existing?.status === 'accepted') {
    return res.status(409).json({ error: 'Bu kullanıcı ile zaten arkadaşsınız.' });
  }
  if (existing?.status === 'blocked') {
    return res.status(403).json({ error: 'Bu kullanıcıya istek gönderilemiyor.' });
  }
  if (existing && existing.user_id === user_id) {
    return res.status(409).json({ error: 'Bu kullanıcıya zaten bekleyen bir isteğiniz var.' });
  }
  if (existing) {
    const { data, error } = await supabase
      .from('friends')
      .update({ status: 'accepted' })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) return sendDbError(res, error);
    notifyFriendChange([user_id, friend.id], 'accepted');
    return res.json({ ...data, auto_accepted: true });
  }

  const { data, error } = await supabase
    .from('friends')
    .insert([{ user_id, friend_id: friend.id, status: 'pending' }])
    .select()
    .single();

  if (error) return res.status(409).json({ error: 'Bu kullanıcı ile zaten arkadaşsınız veya bekleyen bir istek var.' });
  notifyFriendChange([friend.id], 'request');
  res.json(data);
});

// Gelen arkadaşlık isteğini kabul et
router.post('/accept', authenticate, validateObjectBody, async (req, res) => {
  const { friend_id } = req.body;
  const user_id = req.user.id;
  if (typeof friend_id !== 'string' || !UUID_PATTERN.test(friend_id)) {
    return res.status(400).json({ error: 'Geçerli bir friend_id gerekli.' });
  }

  const { data, error } = await supabase
    .from('friends')
    .update({ status: 'accepted' })
    .eq('user_id', friend_id)
    .eq('friend_id', user_id)
    .eq('status', 'pending')
    .select()
    .maybeSingle();

  if (error) return sendDbError(res, error);
  if (!data) return res.status(404).json({ error: 'Bekleyen arkadaşlık isteği bulunamadı.' });
  notifyFriendChange([friend_id, user_id], 'accepted');
  res.json(data);
});

// Gelen isteği reddet
router.post('/reject', authenticate, validateObjectBody, async (req, res) => {
  const { friend_id } = req.body;
  const user_id = req.user.id;
  if (typeof friend_id !== 'string' || !UUID_PATTERN.test(friend_id)) {
    return res.status(400).json({ error: 'Geçerli bir friend_id gerekli.' });
  }

  const { data, error } = await supabase
    .from('friends')
    .delete()
    .eq('user_id', friend_id)
    .eq('friend_id', user_id)
    .eq('status', 'pending')
    .select();

  if (error) return sendDbError(res, error);
  if (!data?.length) return res.status(404).json({ error: 'Bekleyen arkadaşlık isteği bulunamadı.' });
  notifyFriendChange([friend_id, user_id], 'rejected');
  res.json({ success: true });
});

// Arkadaşı çıkar veya gönderilen isteği geri çek
router.delete('/:friendId', authenticate, async (req, res) => {
  const { friendId } = req.params;
  const user_id = req.user.id;
  if (!UUID_PATTERN.test(friendId)) {
    return res.status(400).json({ error: 'Geçerli bir friend_id gerekli.' });
  }

  const relation = await findRelationship(user_id, friendId);
  if (!relation || relation.status === 'blocked') {
    return res.status(404).json({ error: 'Arkadaşlık kaydı bulunamadı.' });
  }
  if (relation.status === 'pending' && relation.user_id !== user_id) {
    return res.status(400).json({ error: 'Gelen istekleri reddetmek için /friends/reject kullanın.' });
  }

  const { error } = await supabase.from('friends').delete().eq('id', relation.id);
  if (error) return sendDbError(res, error);
  notifyFriendChange([friendId, user_id], relation.status === 'accepted' ? 'removed' : 'cancelled');
  res.json({ success: true });
});

export default router;
