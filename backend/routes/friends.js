import express from 'express';
import { supabase } from '../db.js';
import { createAuthMiddleware, requireSameUser } from '../middleware/auth.js';
import { validateObjectBody } from '../middleware/security.js';

const router = express.Router();
const authenticate = createAuthMiddleware();

// Arkadaşları listele
router.get('/:userId', authenticate, requireSameUser, async (req, res) => {
  const { userId } = req.params;

  try {
    // 1. Gönderilen istekler veya kabul edilen arkadaşlar
    const { data: sent, error: errorSent } = await supabase
      .from('friends')
      .select('*, users:friend_id(id, username, avatar)')
      .eq('user_id', userId);

    // 2. Gelen istekler veya kabul edilen arkadaşlar
    const { data: received, error: errorRec } = await supabase
      .from('friends')
      .select('*, users:user_id(id, username, avatar)')
      .eq('friend_id', userId);

    if (errorSent || errorRec) {
      return res.status(400).json({ error: errorSent?.message || errorRec?.message });
    }

    const list = [];
    
    if (sent) {
      sent.forEach(f => {
        list.push({
          id: f.id,
          friend_id: f.users?.id,
          username: f.users?.username || 'Bilinmeyen Kullanıcı',
          avatar: f.users?.avatar || '👤',
          status: f.status,
          is_sender: true
        });
      });
    }

    if (received) {
      received.forEach(f => {
        list.push({
          id: f.id,
          friend_id: f.users?.id,
          username: f.users?.username || 'Bilinmeyen Kullanıcı',
          avatar: f.users?.avatar || '👤',
          status: f.status,
          is_sender: false
        });
      });
    }

    res.json(list);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Arkadaş isteği gönder
router.post('/add', authenticate, validateObjectBody, async (req, res) => {
  const { friend_username } = req.body;
  const user_id = req.user.id;
  if (!friend_username) return res.status(400).json({ error: 'Missing fields' });

  try {
    // 1. Kullanıcıyı bul
    const { data: friend, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('username', friend_username)
      .single();

    if (userError || !friend) return res.status(404).json({ error: 'Kullanıcı bulunamadı!' });
    if (friend.id === user_id) return res.status(400).json({ error: 'Kendinizi arkadaş ekleyemezsiniz!' });

    // 2. İstek oluştur
    const { data, error } = await supabase
      .from('friends')
      .insert([{ user_id, friend_id: friend.id, status: 'pending' }])
      .select()
      .single();

    if (error) return res.status(400).json({ error: 'Bu kullanıcı ile zaten arkadaşsınız veya bekleyen bir istek var.' });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Arkadaşlık isteğini kabul et
router.post('/accept', authenticate, validateObjectBody, async (req, res) => {
  const { friend_id } = req.body;
  const user_id = req.user.id;
  if (!friend_id) return res.status(400).json({ error: 'Missing fields' });

  try {
    const { data, error } = await supabase
      .from('friends')
      .update({ status: 'accepted' })
      .eq('user_id', friend_id)
      .eq('friend_id', user_id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
