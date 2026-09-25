// Canlı eşleştirme ve çevrimiçi oyun akışının HTTP + SSE entegrasyon testleri.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { ageSession, onlineState, startTestServer } from './support/testEnv.js';

let env;
before(async () => { env = await startTestServer(); });
after(async () => { await env.close(); });

async function matchPair() {
  await env.db.query('DELETE FROM lobby_queue');
  const host = await env.registerUser('host');
  const guest = await env.registerUser('guest');
  const first = await env.api('POST', '/lobby/join', { token: host.token, body: {} });
  assert.equal(first.status, 200);
  assert.equal(first.body.status, 'searching');
  const second = await env.api('POST', '/lobby/join', { token: guest.token, body: {} });
  assert.equal(second.body.status, 'matched');
  return { host, guest, sessionId: second.body.session_id };
}

test('quick match: both players see the same session through /lobby/status', async () => {
  const { host, guest, sessionId } = await matchPair();
  const hostStatus = await env.api('GET', `/lobby/status/${host.id}`, { token: host.token });
  assert.equal(hostStatus.body.status, 'matched');
  assert.equal(hostStatus.body.matched_with, guest.username);
  assert.equal(hostStatus.body.session_id, sessionId);
});

test('lobby status of another user is forbidden', async () => {
  const a = await env.registerUser();
  const b = await env.registerUser();
  const res = await env.api('GET', `/lobby/status/${b.id}`, { token: a.token });
  assert.equal(res.status, 403);
});

test('lobby endpoints require authentication', async () => {
  assert.equal((await env.api('POST', '/lobby/join', { body: {} })).status, 401);
  assert.equal((await env.api('POST', '/lobby/leave', { body: {} })).status, 401);
});

test('cancel before match: leaving the queue returns user to idle', async () => {
  await env.db.query('DELETE FROM lobby_queue');
  const user = await env.registerUser();
  await env.api('POST', '/lobby/join', { token: user.token, body: {} });
  const leave = await env.api('POST', '/lobby/leave', { token: user.token, body: {} });
  assert.equal(leave.status, 200);
  const status = await env.api('GET', `/lobby/status/${user.id}`, { token: user.token });
  assert.equal(status.body.status, 'idle');
});

test('opponent leaving after match cancels the session and notifies over SSE', async () => {
  const { host, guest, sessionId } = await matchPair();
  const stream = env.openStream(`/multiplayer/sessions/${sessionId}/events`, host.token);
  await stream.ready;
  await stream.next(e => e.type === 'connected');

  await env.api('POST', '/lobby/leave', { token: guest.token, body: {} });
  const cancelled = await stream.next(e => e.type === 'cancelled');
  assert.equal(cancelled.user_id, guest.id);

  const status = await env.api('GET', `/lobby/status/${host.id}`, { token: host.token });
  assert.equal(status.body.status, 'cancelled');
  stream.close();
});

test('private room: host creates, guest joins with username + room code, both get matched', async () => {
  await env.db.query('DELETE FROM lobby_queue');
  const host = await env.registerUser('room');
  const guest = await env.registerUser('friend');
  const created = await env.api('POST', '/lobby/create-private', { token: host.token, body: {} });
  assert.equal(created.body.status, 'waiting_private');
  assert.match(created.body.room_code, /^[A-HJ-NP-Z2-9]{6}$/);
  const waiting = await env.api('GET', `/lobby/status/${host.id}`, { token: host.token });
  assert.equal(waiting.body.status, 'waiting_private');

  // Kullanıcı adını bilmek tek başına yetmez.
  const noCode = await env.api('POST', '/lobby/join-private', { token: guest.token, body: { host_username: host.username } });
  assert.equal(noCode.status, 403);
  const wrongCode = await env.api('POST', '/lobby/join-private', { token: guest.token, body: { host_username: host.username, room_code: 'AAAAAA' } });
  assert.equal(wrongCode.status, 403);

  const joined = await env.api('POST', '/lobby/join-private', {
    token: guest.token, body: { host_username: host.username, room_code: created.body.room_code.toLowerCase() }
  });
  assert.equal(joined.status, 200);
  assert.equal(joined.body.matched_with, host.username);

  const hostStatus = await env.api('GET', `/lobby/status/${host.id}`, { token: host.token });
  assert.equal(hostStatus.body.status, 'matched');
  assert.equal(hostStatus.body.session_id, joined.body.session_id);
});

test('private room errors are mapped to friendly HTTP responses', async () => {
  await env.db.query('DELETE FROM lobby_queue');
  const host = await env.registerUser('solo');
  const other = await env.registerUser('other');
  assert.equal((await env.api('POST', '/lobby/join-private', { token: other.token, body: { host_username: 'x' } })).status, 400);
  assert.equal((await env.api('POST', '/lobby/join-private', { token: other.token, body: { host_username: host.username, room_code: 'ab' } })).status, 400);
  assert.equal((await env.api('POST', '/lobby/join-private', { token: other.token, body: { host_username: 'nobody_123' } })).status, 404);
  assert.equal((await env.api('POST', '/lobby/join-private', { token: other.token, body: { host_username: host.username } })).status, 404);
  const room = await env.api('POST', '/lobby/create-private', { token: host.token, body: {} });
  assert.equal((await env.api('POST', '/lobby/join-private', { token: host.token, body: { host_username: host.username, room_code: room.body.room_code } })).status, 400);

  // Kod tahmini sınırlıdır.
  const guesser = await env.registerUser('guess');
  let limited = false;
  for (let i = 0; i < 25 && !limited; i++) {
    const res = await env.api('POST', '/lobby/join-private', { token: guesser.token, body: { host_username: host.username, room_code: 'ZZZZZZ' } });
    limited = res.status === 429;
  }
  assert.equal(limited, true);
});

test('game sync: host initialises, turn ownership is enforced, opponent receives every move', async () => {
  const { host, guest, sessionId } = await matchPair();
  const guestStream = env.openStream(`/multiplayer/sessions/${sessionId}/events`, guest.token);
  await guestStream.ready;
  await guestStream.next(e => e.type === 'connected');

  const baseState = onlineState({ names: [host.username, guest.username] });

  // Guest oyunu başlatamaz
  const guestInit = await env.api('PUT', `/multiplayer/sessions/${sessionId}/state`, { token: guest.token, body: { state_data: baseState } });
  assert.equal(guestInit.status, 403);

  const init = await env.api('PUT', `/multiplayer/sessions/${sessionId}/state`, { token: host.token, body: { state_data: baseState, event_type: 'dice_roll' } });
  assert.equal(init.status, 200);
  const diceEvent = await guestStream.next(e => e.type === 'dice_roll');
  assert.equal(diceEvent.user_id, host.id);
  assert.equal(diceEvent.version, init.body.updated_at);

  // Sürüm olmadan yazılamaz
  const noVersion = await env.api('PUT', `/multiplayer/sessions/${sessionId}/state`, { token: host.token, body: { state_data: baseState } });
  assert.equal(noVersion.status, 409);

  // Sıra host'ta: guest yazamaz
  const wrongTurn = await env.api('PUT', `/multiplayer/sessions/${sessionId}/state`, {
    token: guest.token, body: { state_data: baseState, version: init.body.updated_at }
  });
  assert.equal(wrongTurn.status, 403);

  // Host sırayı devreder
  const handOver = await env.api('PUT', `/multiplayer/sessions/${sessionId}/state`, {
    token: host.token, body: { state_data: { ...baseState, currentPlayer: 1 }, event_type: 'end_turn', version: init.body.updated_at }
  });
  assert.equal(handOver.status, 200);
  const endTurn = await guestStream.next(e => e.type === 'end_turn');
  assert.equal(endTurn.state_data.currentPlayer, 1);

  // Eski sürümle yazma reddedilir (yarış durumu koruması)
  const stale = await env.api('PUT', `/multiplayer/sessions/${sessionId}/state`, {
    token: guest.token, body: { state_data: { ...baseState, currentPlayer: 0 }, version: init.body.updated_at }
  });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.db_version, handOver.body.updated_at);

  // Güncel sürümle guest hamlesi kabul edilir
  const guestMove = await env.api('PUT', `/multiplayer/sessions/${sessionId}/state`, {
    token: guest.token, body: { state_data: { ...baseState, currentPlayer: 0, turnCount: 2 }, event_type: 'end_turn', version: handOver.body.updated_at }
  });
  assert.equal(guestMove.status, 200);
  guestStream.close();
});

test('state endpoint validates payloads and participants', async () => {
  const { host, sessionId } = await matchPair();
  const outsider = await env.registerUser('outsider');
  assert.equal((await env.api('PUT', `/multiplayer/sessions/${sessionId}/state`, { token: host.token, body: { state_data: [] } })).status, 400);
  assert.equal((await env.api('PUT', `/multiplayer/sessions/${sessionId}/state`, { token: host.token, body: { state_data: {}, event_type: 'DROP TABLE' } })).status, 400);
  assert.equal((await env.api('PUT', `/multiplayer/sessions/${sessionId}/state`, { token: outsider.token, body: { state_data: {} } })).status, 403);
  assert.equal((await env.api('GET', `/multiplayer/sessions/${sessionId}`, { token: outsider.token })).status, 403);
  const outsiderTicket = await env.streamTicket(outsider.token);
  const events = await fetch(`${env.baseUrl}/api/multiplayer/sessions/${sessionId}/events?ticket=${outsiderTicket}`);
  assert.equal(events.status, 403);
  // Uzun ömürlü oturum token'ı URL'de kabul edilmez; yalnızca akış bileti.
  const sessionToken = await fetch(`${env.baseUrl}/api/multiplayer/sessions/${sessionId}/events?ticket=${host.token}`);
  assert.equal(sessionToken.status, 401);
  const noToken = await fetch(`${env.baseUrl}/api/multiplayer/sessions/${sessionId}/events`);
  assert.equal(noToken.status, 401);
});

test('session details include both players with usernames', async () => {
  const { host, guest, sessionId } = await matchPair();
  const res = await env.api('GET', `/multiplayer/sessions/${sessionId}`, { token: guest.token });
  assert.equal(res.status, 200);
  const byRole = Object.fromEntries(res.body.game_session_players.map(p => [p.role, p]));
  assert.equal(byRole.host.users.username, host.username);
  assert.equal(byRole.guest.users.username, guest.username);
});

test('leaving a started match is a forfeit: the other player wins regardless of money', async () => {
  const { host, guest, sessionId } = await matchPair();
  const guestStream = env.openStream(`/multiplayer/sessions/${sessionId}/events`, guest.token);
  await guestStream.ready;

  // Maç başladı: host 4. hücredeki kutudan +₺90K kazandı (host daha zengin).
  const state = onlineState({ names: [host.username, guest.username], money: [1_090_000, 1_000_000], pos: [4, 0] });
  const init = await env.api('PUT', `/multiplayer/sessions/${sessionId}/state`, { token: host.token, body: { state_data: state, event_type: 'dice_roll' } });
  assert.equal(init.status, 200);

  // Host parası daha fazla olsa bile oyunu terk ettiği için kaybeder.
  const res = await env.api('POST', `/multiplayer/sessions/${sessionId}/finish`, {
    token: host.token, body: { state_data: state, result_data: { reason: 'forfeit' } }
  });
  assert.equal(res.status, 200);
  const event = await guestStream.next(e => e.type === 'finished');
  assert.equal(event.result_data.reason, 'forfeit');
  assert.equal(event.result_data.winner_user_id, guest.id);

  const guestStats = await env.api('GET', `/stats/${guest.id}`, { token: guest.token });
  assert.equal(guestStats.body.wins, 1);
  guestStream.close();
});

test('finishing a match records stats once and closes the session', async () => {
  const { host, guest, sessionId } = await matchPair();
  const hostStream = env.openStream(`/multiplayer/sessions/${sessionId}/events`, host.token);
  await hostStream.ready;

  // Host İstanbul'u (₺100K) aldı ve sırayı devretti; süre dolduğunda guest daha zengin.
  const names = [host.username, guest.username];
  const bought = await env.api('PUT', `/multiplayer/sessions/${sessionId}/state`, {
    token: host.token, body: { state_data: onlineState({ names, money: [900_000, 1_000_000], owned: [[0], []] }), event_type: 'buy_city' }
  });
  assert.equal(bought.status, 200);
  const handOver = await env.api('PUT', `/multiplayer/sessions/${sessionId}/state`, {
    token: host.token, body: { state_data: onlineState({ names, money: [900_000, 1_000_000], owned: [[0], []], currentPlayer: 1 }), event_type: 'end_turn', version: bought.body.updated_at }
  });
  assert.equal(handOver.status, 200);

  // Süre dolmadan "time" ile bitirilemez.
  const early = await env.api('POST', `/multiplayer/sessions/${sessionId}/finish`, {
    token: guest.token, body: { state_data: {}, result_data: { reason: 'time' } }
  });
  assert.equal(early.status, 409);
  await ageSession(env.db, sessionId);

  // İstemcinin iddia ettiği kurallara aykırı son durum yok sayılır; sonuç sunucunun kabul
  // ettiği durumdan çıkar.
  const finalState = onlineState({ names, money: [100, 9_999_999], currentPlayer: 1, turnCount: 7 });
  const finish = await env.api('POST', `/multiplayer/sessions/${sessionId}/finish`, {
    token: guest.token, body: { state_data: finalState, result_data: { reason: 'time' } }
  });
  assert.equal(finish.status, 200);
  assert.equal(finish.body.status, 'finished');
  const finishedEvent = await hostStream.next(e => e.type === 'finished');
  assert.equal(finishedEvent.result_data.reason, 'time');

  assert.equal(finishedEvent.state_data.players[0].money, 900_000);
  assert.equal(finishedEvent.state_data.players[1].money, 1_000_000);

  const again = await env.api('POST', `/multiplayer/sessions/${sessionId}/finish`, {
    token: host.token, body: { state_data: finalState, result_data: { reason: 'time' } }
  });
  assert.equal(again.status, 409);

  const guestStats = await env.api('GET', `/stats/${guest.id}`, { token: guest.token });
  const hostStats = await env.api('GET', `/stats/${host.id}`, { token: host.token });
  assert.deepEqual([guestStats.body.games_played, guestStats.body.wins, guestStats.body.xp], [1, 1, 1000]);
  assert.deepEqual([hostStats.body.games_played, hostStats.body.wins, hostStats.body.xp], [1, 0, 500]);

  const afterFinish = await env.api('PUT', `/multiplayer/sessions/${sessionId}/state`, {
    token: guest.token, body: { state_data: finalState, version: finish.body.updated_at }
  });
  assert.equal(afterFinish.status, 409);
  hostStream.close();
});
