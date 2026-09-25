import express from 'express';
import { supabase } from '../db.js';
import { createAuthMiddleware, requireEnv, verifyStreamTicket } from '../middleware/auth.js';
import { validateObjectBody } from '../middleware/security.js';
import { openEventStream, publishToSession, subscribeToSession } from '../services/realtime.js';
import { sendDbError } from '../middleware/errors.js';
import {
  GAME_DURATION_SECONDS, hasGameState, initialState, validateStateTransition
} from '../game/stateRules.js';

const router = express.Router();
const authenticate = createAuthMiddleware();
const jwtSecret = requireEnv('JWT_SECRET');
const CLOSED_STATUSES = ['finished', 'cancelled'];
const EVENT_TYPE_PATTERN = /^[a-z_]{1,32}$/;
// Tur sayısı istemciden gelir; istatistiğe (integer sütun) yazılmadan önce sınırlandırılır.
const MAX_TURNS = 10_000;
const FINISH_REASONS = ['bankruptcy', 'time', 'forfeit'];
// Süre bitimi iddiası, maç oluşturulduktan en az bu kadar sonra kabul edilir.
const TIME_TOLERANCE_SECONDS = 60;

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

// Oturumlar yalnızca lobi eşleştirmesi ve özel oda akışıyla (routes/lobby.js) oluşturulur.
// Eskiden burada kimliği bilen herkesin özel odaya katılabildiği doğrudan
// oluşturma/katılma uç noktaları vardı; istemci kullanmıyordu, kaldırıldı.

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

    // 5. Oyun kuralları: son kabul edilen durumdan bu duruma kurallara uygun bir hamleyle
    // geçilebilir mi? (para, şehir, stadyum ve sıra denetimi — bkz. game/stateRules.js)
    // Eski sürüme dayanan yazma, kural denetiminden önce "stale" olarak bildirilir ki
    // istemci sunucudaki güncel durumu çekip uygulasın (kesin eşitlik yine UPDATE'te aranır).
    if (version && Date.parse(version) !== Date.parse(session.updated_at)) {
      return res.status(409).json({ error: 'Stale state update ignored', db_version: session.updated_at });
    }
    const previousState = hasGameState(session.state_data) ? session.state_data : initialState(players.length);
    const rules = validateStateTransition(previousState, state_data);
    if (!rules.ok) {
      return res.status(422).json({ error: 'Invalid game state', reason: rules.reason });
    }

    // 6. Güncelleme işlemini son görülen sürüme koşullandır. Böylece paralel
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
  const reason = result_data.reason;
  if (!FINISH_REASONS.includes(reason)) {
    return res.status(400).json({ error: 'Invalid finish reason' });
  }

  if (!(await ensureParticipant(sessionId, req.user.id))) {
    return res.status(403).json({ error: 'Session access denied' });
  }

  const [{ data: session, error: sessionError }, { data: players, error: playersError }] = await Promise.all([
    supabase.from('game_sessions').select('status, state_data, created_at').eq('id', sessionId).maybeSingle(),
    supabase.from('game_session_players').select('user_id, role').eq('session_id', sessionId)
  ]);
  if (sessionError || playersError) return sendDbError(res, sessionError || playersError);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (CLOSED_STATUSES.includes(session.status)) return res.status(409).json({ error: 'Session is already closed' });

  // Sonuç, sunucunun kurallara göre kabul ettiği son durumdan belirlenir. Sırası gelen
  // oyuncu son hamlesini (ör. iflas ettiren kira) bitiş isteğiyle birlikte gönderebilir;
  // o hamle de aynı kural denetiminden geçmelidir. Diğer oyuncunun gönderdiği durum yok sayılır.
  const storedState = hasGameState(session.state_data) ? session.state_data : null;
  const roleIndex = { host: 0, guest: 1 };
  const requesterIndex = roleIndex[players?.find(p => p.user_id === req.user.id)?.role];
  const turnOwner = storedState ? storedState.currentPlayer : 0;
  let finalState = storedState;
  if (reason !== 'forfeit' && requesterIndex === turnOwner && hasGameState(state_data) &&
      validateStateTransition(storedState || initialState(players.length), state_data).ok) {
    finalState = state_data;
  }

  // Hiç oynanmamış maç sonuç/istatistik üretmez (ör. eşleşip hemen bitirilen maçlarla XP toplama).
  if (!finalState) return res.status(409).json({ error: 'Match has not started' });
  if (reason === 'bankruptcy' && !finalState.players.some(p => Number(p?.money) <= 0)) {
    return res.status(409).json({ error: 'No player is bankrupt' });
  }
  if (reason === 'time') {
    const elapsedSeconds = (Date.now() - new Date(session.created_at).getTime()) / 1000;
    if (!(elapsedSeconds >= GAME_DURATION_SECONDS - TIME_TOLERANCE_SECONDS)) {
      return res.status(409).json({ error: 'Match time is not over yet' });
    }
  }

  const { data, error } = await supabase
    .from('game_sessions')
    .update({ state_data: finalState, result_data, status: 'finished', updated_at: new Date().toISOString() })
    .eq('id', sessionId)
    .in('status', ['waiting', 'active'])
    .select()
    .maybeSingle();

  if (error) return sendDbError(res, error);
  if (!data) return res.status(409).json({ error: 'Session is already closed' });

  // Oturum yalnızca bir kez 'finished' olabildiği için istatistikler de bir kez işlenir.
  const winnerIndex = getWinnerIndex(finalState);
  const winnerRole = winnerIndex === 0 ? 'host' : winnerIndex === 1 ? 'guest' : null;
  // Hükmen yenilgi: maçı terk eden oyuncu (isteği yapan) kaybeder; kazanan sunucuda belirlenir.
  const winnerUserId = reason === 'forfeit'
    ? players?.find(p => p.user_id !== req.user.id)?.user_id || null
    : players?.find(p => p.role === winnerRole)?.user_id || null;
  const { error: statsError } = await supabase.rpc('apply_session_result', {
    p_session_id: sessionId,
    p_winner_user_id: winnerUserId,
    p_turns: Number.isInteger(finalState.turnCount) ? Math.min(Math.max(finalState.turnCount, 0), MAX_TURNS) : 0
  });
  if (statsError) console.error('[multiplayer/finish] stats update failed:', statsError.message);

  await broadcastSession(sessionId, {
    type: 'finished',
    user_id: req.user.id,
    state_data: finalState,
    result_data: { ...result_data, winner_user_id: winnerUserId }
  });
  res.json(data);
});

// SSE endpoint — tarayıcı EventSource custom header gönderemediği için kısa ömürlü
// akış bileti query string ile gelir (POST /api/auth/stream-ticket).
router.get('/sessions/:sessionId/events', async (req, res) => {
  const { sessionId } = req.params;
  const user = verifyStreamTicket(req.query.ticket, jwtSecret);
  if (!user) return res.status(401).end();

  if (!(await ensureParticipant(sessionId, user.id))) {
    return res.status(403).end();
  }

  const send = openEventStream(req, res, () => unsubscribe());
  const unsubscribe = subscribeToSession(sessionId, send);
  send({ type: 'connected', session_id: sessionId });
});

export default router;

