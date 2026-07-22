import express from 'express';
import { supabase } from '../db.js';
import { createAuthMiddleware, requireSameUser } from '../middleware/auth.js';

const router = express.Router();
const authenticate = createAuthMiddleware();

// Lobi sırasına katıl
router.post('/join', authenticate, async (req, res) => {
  const user_id = req.user.id;

  try {
    const { data, error } = await supabase.rpc('matchmake_player', { p_user_id: user_id });
    if (error) return res.status(400).json({ error: error.message });

    const result = data?.[0];
    if (!result) return res.status(500).json({ error: 'Matchmaking result missing' });

    return res.json({
      status: result.status,
      matched_with: result.matched_username || undefined,
      avatar: result.avatar || undefined,
      session_id: result.session_id || undefined
    });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Sıradan ayrıl
router.post('/leave', authenticate, async (req, res) => {
  const user_id = req.user.id;

  try {
    const { error } = await supabase.from('lobby_queue').delete().eq('user_id', user_id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Durumu kontrol et
router.get('/status/:userId', authenticate, requireSameUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('lobby_queue')
      .select('*')
      .eq('user_id', req.params.userId)
      .single();

    if (error || !data) return res.json({ status: 'idle' });

    if (data.status === 'matched') {
      // Eşleşilen kullanıcının adını ve avatarını çek
      const { data: peerData } = await supabase
        .from('users')
        .select('username, avatar')
        .eq('id', data.matched_with)
        .single();

      return res.json({ 
        status: 'matched', 
        matched_with: peerData?.username || 'Rakip',
        avatar: peerData?.avatar || '👤',
        session_id: data.session_id
      });
    }

    res.json({ status: data.status });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Özel oda oluştur (Host)
router.post('/create-private', authenticate, async (req, res) => {
  const user_id = req.user.id;

  try {
    await supabase.from('lobby_queue').delete().eq('user_id', user_id);

    const { data, error } = await supabase
      .from('lobby_queue')
      .insert([{ user_id, status: 'waiting_private' }])
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ status: 'waiting_private' });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Özel odaya katıl (Guest)
router.post('/join-private', authenticate, async (req, res) => {
  const { host_username } = req.body;
  const user_id = req.user.id;
  if (!host_username) return res.status(400).json({ error: 'Missing fields' });

  try {
    const { data, error } = await supabase.rpc('join_private_session', {
      p_user_id: user_id,
      p_host_username: host_username
    });

    if (error) {
      const message = error.message || 'Private room join failed';
      if (message.includes('HOST_NOT_FOUND')) return res.status(404).json({ error: 'Oda kurucusu bulunamadı!' });
      if (message.includes('CANNOT_JOIN_OWN_ROOM')) return res.status(400).json({ error: 'Kendi odanıza katılamazsınız!' });
      if (message.includes('PRIVATE_ROOM_UNAVAILABLE')) {
        return res.status(404).json({ error: 'Aktif bir özel oda bulunamadı veya oda dolu!' });
      }
      return res.status(400).json({ error: message });
    }

    const result = data?.[0];
    if (!result) return res.status(500).json({ error: 'Private room result missing' });
    return res.json({
      status: result.status,
      matched_with: result.matched_username,
      avatar: result.avatar,
      session_id: result.session_id
    });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

