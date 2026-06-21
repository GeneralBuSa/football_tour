import express from 'express';
import { supabase } from '../db.js';

const router = express.Router();

// Lobi sırasına katıl
router.post('/join', async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  try {
    // 1. Varsa eski sırayı temizle
    await supabase.from('lobby_queue').delete().eq('user_id', user_id);

    // 2. Bekleyen oyuncu ara
    const { data: waitingPlayers, error: searchError } = await supabase
      .from('lobby_queue')
      .select('*, users(username, avatar)')
      .eq('status', 'searching')
      .neq('user_id', user_id)
      .order('created_at', { ascending: true })
      .limit(1);

    if (searchError) return res.status(400).json({ error: searchError.message });

    if (waitingPlayers && waitingPlayers.length > 0) {
      const peer = waitingPlayers[0];

      // Eşleşme bulundu, her iki tarafı da güncelle
      const { error: updateSelfError } = await supabase
        .from('lobby_queue')
        .insert([{ user_id, status: 'matched', matched_with: peer.user_id }]);

      if (updateSelfError) return res.status(400).json({ error: updateSelfError.message });

      await supabase
        .from('lobby_queue')
        .update({ status: 'matched', matched_with: user_id })
        .eq('user_id', peer.user_id);

      return res.json({ status: 'matched', matched_with: peer.users?.username || 'Rakip', avatar: peer.users?.avatar || '👤' });
    } else {
      // Bekleyen yoksa sıraya ekle
      const { error: insertError } = await supabase
        .from('lobby_queue')
        .insert([{ user_id, status: 'searching' }]);

      if (insertError) return res.status(400).json({ error: insertError.message });

      return res.json({ status: 'searching' });
    }
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Sıradan ayrıl
router.post('/leave', async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  try {
    const { error } = await supabase.from('lobby_queue').delete().eq('user_id', user_id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Durumu kontrol et
router.get('/status/:userId', async (req, res) => {
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
        avatar: peerData?.avatar || '👤'
      });
    }

    res.json({ status: data.status });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Özel oda oluştur (Host)
router.post('/create-private', async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

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
router.post('/join-private', async (req, res) => {
  const { user_id, host_username } = req.body;
  if (!user_id || !host_username) return res.status(400).json({ error: 'Missing fields' });

  try {
    const { data: host, error: hostError } = await supabase
      .from('users')
      .select('id')
      .eq('username', host_username)
      .single();

    if (hostError || !host) return res.status(404).json({ error: 'Oda kurucusu bulunamadı!' });
    if (host.id === user_id) return res.status(400).json({ error: 'Kendi odanıza katılamazsınız!' });

    const { data: hostLobby, error: lobbyError } = await supabase
      .from('lobby_queue')
      .select('*')
      .eq('user_id', host.id)
      .eq('status', 'waiting_private')
      .single();

    if (lobbyError || !hostLobby) {
      return res.status(404).json({ error: 'Aktif bir özel oda bulunamadı veya oda dolu!' });
    }

    await supabase.from('lobby_queue').delete().eq('user_id', user_id);

    await supabase
      .from('lobby_queue')
      .insert([{ user_id, status: 'matched', matched_with: host.id }]);

    await supabase
      .from('lobby_queue')
      .update({ status: 'matched', matched_with: user_id })
      .eq('user_id', host.id);

    return res.json({ status: 'matched', matched_with: host_username });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
