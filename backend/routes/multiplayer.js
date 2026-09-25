import express from 'express';
import { supabase } from '../db.js';
import jwt from 'jsonwebtoken';
import { createAuthMiddleware, requireEnv } from '../middleware/auth.js';
import { validateObjectBody } from '../middleware/security.js';
import { openEventStream, publishToSession, subscribeToSession } from '../services/realtime.js';
import { sendDbError } from '../middleware/errors.js';

const router = express.Router();
const authenticate = createAuthMiddleware();
const jwtSecret = requireEnv('JWT_SECRET');
const CLOSED_STATUSES = ['finished', 'cancelled'];
const EVENT_TYPE_PATTERN = /^[a-z_]{1,32}$/;

async function ensureParticipant(sessionId, userId) {
  const { data, error } = await supabase
    .from('game_session_players')
    .select('user_id')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .maybeSingle();

  return !error && !!data;
}

async function broadcastSession(sessionId, payload) {
  publishToSession(sessionId, payload);
}

// Oyun durumundaki en zengin oyuncunun indeksini döndürür (0 = host, 1 = guest).
export function getWinnerIndex(stateData) {
  const players = Array.isArray(stateData?.players) ? stateData.players : [];
  let winner = -1;
  players.forEach((player, index) => {
    const money = Number(player?.money);
    if (!Number.isFinite(money)) return;
    if (winner === -1 || money > Number(players[winner].money)) winner = index;
  });
  return winner;
}

router.post('/sessions', authenticate, validateObjectBody, async (req, res) => {
  const { mode = 'private' } = req.body || {};
  if (!['private', 'matchmaking'].includes(mode)) {
    return res.status(400).json({ error: 'Invalid session mode' });
  }

  const { data: session, error } = await supabase
    .from('game_sessions')
    .insert([{ host_user_id: req.user.id, status: 'waiting', mode, state_data: {} }])
    .select()
    .single();

  if (error) return sendDbError(res, error);

  const { error: playerError } = await supabase
    .from('game_session_players')
    .insert([{ session_id: session.id, user_id: req.user.id, role: 'host' }]);

  if (playerError) return sendDbError(res, playerError);

  res.json(session);
});

router.post('/sessions/:sessionId/join', authenticate, validateObjectBody, async (req, res) => {
  const { sessionId } = req.params;

  const { data: session, error: sessionError } = await supabase
    .from('game_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) return res.status(404).json({ error: 'Session not found' });
  if (CLOSED_STATUSES.includes(session.status)) return res.status(409).json({ error: 'Session is already closed' });

  const { count: playerCount, error: countError } = await supabase
    .from('game_session_players')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId);
  if (countError) return res.status(500).json({ error: 'Failed to inspect session capacity' });
  if (playerCount >= 2) return res.status(409).json({ error: 'Session is full' });

  const { error: joinError } = await supabase
    .from('game_session_players')
    .upsert([{ session_id: sessionId, user_id: req.user.id, role: 'guest' }], { onConflict: 'session_id,user_id' });

  if (joinError) return sendDbError(res, joinError);

  await supabase
    .from('game_sessions')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', sessionId);

  await broadcastSession(sessionId, { type: 'player_joined', user_id: req.user.id });
  res.json({ success: true, session_id: sessionId });
});

router.get('/sessions/:sessionId', authenticate, async (req, res) => {
  const { sessionId } = req.params;
  if (!(await ensureParticipant(sessionId, req.user.id))) {
    return res.status(403).json({ error: 'Session access denied' });
  }

  const { data, error } = await supabase
    .from('game_sessions')
    .select('*, game_session_players(user_id, role, users(username, avatar, selected_character))')
    .eq('id', sessionId)
    .single();

  if (error) return res.status(404).json({ error: 'Session not found' });
  res.json(data);
});

router.put('/sessions/:sessionId/state', authenticate, validateObjectBody, async (req, res) => {
  const { sessionId } = req.params;
  const { state_data, event_type = 'state_update', version } = req.body || {};
  if (typeof event_type !== 'string' || !EVENT_TYPE_PATTERN.test(event_type)) {
    return res.status(400).json({ error: 'Invalid event_type' });
  }

  if (!state_data || typeof state_data !== 'object' || Array.isArray(state_data)) {
    return res.status(400).json({ error: 'state_data object required' });
  }
  if (JSON.stringify(state_data).length > 200_000) {
    return res.status(413).json({ error: 'state_data is too large' });
  }
  if (!(await ensureParticipant(sessionId, req.user.id))) {
    return res.status(403).json({ error: 'Session access denied' });
  }

  try {
    // 1. Mevcut session durumunu çek
    const { data: session, error: sessionErr } = await supabase
      .from('game_sessions')
      .select('status, state_data, updated_at')
      .eq('id', sessionId)
      .single();

    if (sessionErr || !session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (CLOSED_STATUSES.includes(session.status)) {
      return res.status(409).json({ error: 'Session is already closed', status: session.status });
    }

    // 2. İlk state kurulumundan sonraki her yazma, son görülen sürümü taşımalıdır.
    if (Object.keys(session.state_data || {}).length > 0 && !version) {
      return res.status(409).json({ error: 'State version required', db_version: session.updated_at });
    }

    // 3. Katılımcıları ve rollerini bul
    const { data: players, error: playersErr } = await supabase
      .from('game_session_players')
      .select('user_id, role')
      .eq('session_id', sessionId);

    if (playersErr || !players) {
      return res.status(500).json({ error: 'Failed to verify session players' });
    }

    const hostPlayer = players.find(p => p.role === 'host');
    const guestPlayer = players.find(p => p.role === 'guest');

    const hostUserId = hostPlayer?.user_id;
    const guestUserId = guestPlayer?.user_id;

    // 4. Sıra sahibi (Turn ownership) kontrolü
    if (session.state_data && typeof session.state_data.currentPlayer === 'number') {
      const currentTurn = session.state_data.currentPlayer;
      if (currentTurn === 0 && req.user.id !== hostUserId) {
        return res.status(403).json({ error: 'It is not your turn (Host turn)' });
      }
      if (currentTurn === 1 && req.user.id !== guestUserId) {
        return res.status(403).json({ error: 'It is not your turn (Guest turn)' });
      }
    } else {
      // Henüz başlatılmamış state'i sadece Host kurabilir
      if (req.user.id !== hostUserId) {
        return res.status(403).json({ error: 'Only the session host can initialize the state' });
      }
    }

    // 5. Güncelleme işlemini son görülen sürüme koşullandır. Böylece paralel
    // istemcilerden yalnızca biri aynı state sürümünü güncelleyebilir.
    let updateQuery = supabase
      .from('game_sessions')
      .update({ state_data, status: 'active', updated_at: new Date().toISOString() })
      .eq('id', sessionId)
      .in('status', ['waiting', 'active']);

    if (version) updateQuery = updateQuery.eq('updated_at', version);

    const { data, error } = await updateQuery
      .select()
      .maybeSingle();

    if (error) return sendDbError(res, error);
    if (!data) {
      return res.status(409).json({ error: 'Stale state update ignored', db_version: session.updated_at });
    }

    await supabase.from('game_session_events').insert([{
      session_id: sessionId,
      user_id: req.user.id,
      event_type,
      payload: state_data
    }]);

    await broadcastSession(sessionId, {
      type: event_type,
      user_id: req.user.id,
      state_data,
      version: data.updated_at
    });

    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/sessions/:sessionId/finish', authenticate, validateObjectBody, async (req, res) => {
  const { sessionId } = req.params;
  const { state_data = {}, result_data = {} } = req.body || {};

  if (!state_data || typeof state_data !== 'object' || Array.isArray(state_data) ||
      !result_data || typeof result_data !== 'object' || Array.isArray(result_data)) {
    return res.status(400).json({ error: 'state_data and result_data objects required' });
  }
  if (JSON.stringify(state_data).length > 200_000 || JSON.stringify(result_data).length > 100_000) {
    return res.status(413).json({ error: 'Game result is too large' });
  }

  if (!(await ensureParticipant(sessionId, req.user.id))) {
    return res.status(403).json({ error: 'Session access denied' });
  }

  const { data, error } = await supabase
    .from('game_sessions')
    .update({ state_data, result_data, status: 'finished', updated_at: new Date().toISOString() })
    .eq('id', sessionId)
    .in('status', ['waiting', 'active'])
    .select()
    .maybeSingle();

  if (error) return sendDbError(res, error);
  if (!data) return res.status(409).json({ error: 'Session is already closed' });

  // Oturum yalnızca bir kez 'finished' olabildiği için istatistikler de bir kez işlenir.
  const winnerIndex = getWinnerIndex(state_data);
  const { data: players } = await supabase
    .from('game_session_players')
    .select('user_id, role')
    .eq('session_id', sessionId);
  const winnerRole = winnerIndex === 0 ? 'host' : winnerIndex === 1 ? 'guest' : null;
  // Hükmen yenilgi: maçı terk eden oyuncu (isteği yapan) kaybeder; kazanan sunucuda belirlenir.
  const winnerUserId = result_data.reason === 'forfeit'
    ? players?.find(p => p.user_id !== req.user.id)?.user_id || null
    : players?.find(p => p.role === winnerRole)?.user_id || null;
  const { error: statsError } = await supabase.rpc('apply_session_result', {
    p_session_id: sessionId,
    p_winner_user_id: winnerUserId,
    p_turns: Number.isInteger(state_data.turnCount) ? state_data.turnCount : 0
  });
  if (statsError) console.error('[multiplayer/finish] stats update failed:', statsError.message);

  await broadcastSession(sessionId, {
    type: 'finished',
    user_id: req.user.id,
    state_data,
    result_data: { ...result_data, winner_user_id: winnerUserId }
  });
  res.json(data);
});

// SSE endpoint — tarayıcı EventSource custom header gönderemediği için
// query string üzerinden token doğrulama yapılır
router.get('/sessions/:sessionId/events', async (req, res) => {
  const { sessionId } = req.params;
  const token = req.query.token;

  if (!token) return res.status(401).end();

  let user;
  try {
    user = jwt.verify(token, jwtSecret);
  } catch {
    return res.status(401).end();
  }

  if (!(await ensureParticipant(sessionId, user.id))) {
    return res.status(403).end();
  }

  const send = openEventStream(req, res, () => unsubscribe());
  const unsubscribe = subscribeToSession(sessionId, send);
  send({ type: 'connected', session_id: sessionId });
});

export default router;

