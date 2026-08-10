import express from 'express';
import { EventEmitter } from 'events';
import { supabase } from '../db.js';
import jwt from 'jsonwebtoken';
import { createAuthMiddleware, requireEnv } from '../middleware/auth.js';
import { validateObjectBody } from '../middleware/security.js';

const router = express.Router();
const authenticate = createAuthMiddleware();
const jwtSecret = requireEnv('JWT_SECRET');
const sessionBus = new EventEmitter();
sessionBus.setMaxListeners(200);

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
  sessionBus.emit(sessionId, { ...payload, emitted_at: new Date().toISOString() });
}

router.post('/sessions', authenticate, validateObjectBody, async (req, res) => {
  const { mode = 'private' } = req.body || {};

  const { data: session, error } = await supabase
    .from('game_sessions')
    .insert([{ host_user_id: req.user.id, status: 'waiting', mode, state_data: {} }])
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  const { error: playerError } = await supabase
    .from('game_session_players')
    .insert([{ session_id: session.id, user_id: req.user.id, role: 'host' }]);

  if (playerError) return res.status(400).json({ error: playerError.message });

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
  if (session.status === 'finished') return res.status(409).json({ error: 'Session is already finished' });

  const { count: playerCount, error: countError } = await supabase
    .from('game_session_players')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId);
  if (countError) return res.status(500).json({ error: 'Failed to inspect session capacity' });
  if (playerCount >= 2) return res.status(409).json({ error: 'Session is full' });

  const { error: joinError } = await supabase
    .from('game_session_players')
    .upsert([{ session_id: sessionId, user_id: req.user.id, role: 'guest' }], { onConflict: 'session_id,user_id' });

  if (joinError) return res.status(400).json({ error: joinError.message });

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
    .select('*, game_session_players(user_id, role, users(username, avatar))')
    .eq('id', sessionId)
    .single();

  if (error) return res.status(404).json({ error: 'Session not found' });
  res.json(data);
});

router.put('/sessions/:sessionId/state', authenticate, validateObjectBody, async (req, res) => {
  const { sessionId } = req.params;
  const { state_data, event_type = 'state_update', version } = req.body || {};

  if (!state_data || typeof state_data !== 'object' || Array.isArray(state_data)) {
    return res.status(400).json({ error: 'state_data object required' });
  }
  if (JSON.stringify(state_data).length > 200_000) {
    return res.status(413).json({ error: 'state_data is too large' });
  }
  if (!(await ensureParticipant(sessionId, req.user.id))) {
    return res.status(403).json({ error: 'Session access denied' });
  }

  const { data: currentSession, error: currentSessionError } = await supabase
    .from('game_sessions')
    .select('status')
    .eq('id', sessionId)
    .single();
  if (currentSessionError) return res.status(404).json({ error: 'Session not found' });
  if (currentSession.status === 'finished') return res.status(409).json({ error: 'Session is already finished' });

  try {
    // 1. Mevcut session durumunu çek
    const { data: session, error: sessionErr } = await supabase
      .from('game_sessions')
      .select('state_data, updated_at')
      .eq('id', sessionId)
      .single();

    if (sessionErr || !session) {
      return res.status(404).json({ error: 'Session not found' });
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
      .eq('id', sessionId);

    if (version) updateQuery = updateQuery.eq('updated_at', version);

    const { data, error } = await updateQuery
      .select()
      .maybeSingle();

    if (error) return res.status(400).json({ error: error.message });
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

  if (!(await ensureParticipant(sessionId, req.user.id))) {
    return res.status(403).json({ error: 'Session access denied' });
  }

  const { data, error } = await supabase
    .from('game_sessions')
    .update({ state_data, result_data, status: 'finished', updated_at: new Date().toISOString() })
    .eq('id', sessionId)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  await broadcastSession(sessionId, { type: 'finished', user_id: req.user.id, state_data, result_data });
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

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive'
  });

  const send = payload => {
    res.write(`event: message\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  send({ type: 'connected', session_id: sessionId });
  const heartbeat = setInterval(() => send({ type: 'heartbeat' }), 25000);
  sessionBus.on(sessionId, send);

  req.on('close', () => {
    clearInterval(heartbeat);
    sessionBus.off(sessionId, send);
  });
});

export default router;

