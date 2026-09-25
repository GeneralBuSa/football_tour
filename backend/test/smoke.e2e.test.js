// Uçtan uca smoke testi: iki oyuncu kayıt olur, arkadaş olur, mesajlaşır, özel odada
// eşleşir, canlı hamle aktarımıyla oynar ve maçı bitirir. Yeni bir özellik eklendiğinde
// bu senaryo kırılırsa ana kullanıcı yolculuğu bozulmuş demektir.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './support/testEnv.js';

let env;
before(async () => { env = await startTestServer(); });
after(async () => { await env.close(); });

test('full player journey: register → friends → chat → invite → live match → results', async () => {
  const { api } = env;
  const host = await env.registerUser('smoke_host');
  const guest = await env.registerUser('smoke_guest');

  // Başlangıç karakteri
  assert.equal((await api('POST', '/store/starter/claim', { token: host.token, body: { character_key: 'viking' } })).status, 200);
  assert.equal((await api('POST', '/store/starter/claim', { token: guest.token, body: { character_key: 'rocket' } })).status, 200);

  // Arkadaşlık
  assert.equal((await api('POST', '/friends/add', { token: host.token, body: { friend_username: guest.username } })).status, 200);
  assert.equal((await api('POST', '/friends/accept', { token: guest.token, body: { friend_id: host.id } })).status, 200);

  // Canlı bildirim akışları
  const guestInbox = env.openStream(`/messages/stream?token=${guest.token}`);
  await guestInbox.ready;
  await guestInbox.next(e => e.type === 'connected');

  // Mesaj
  await api('POST', '/messages', { token: host.token, body: { friend_id: guest.id, body: 'Hazır mısın?' } });
  await guestInbox.next(e => e.type === 'message' && e.message.body === 'Hazır mısın?');

  // Özel oda + davet
  assert.equal((await api('POST', '/lobby/create-private', { token: host.token, body: {} })).status, 200);
  assert.equal((await api('POST', '/messages/invite', { token: host.token, body: { friend_id: guest.id } })).status, 201);
  const invite = await guestInbox.next(e => e.type === 'message' && e.message.kind === 'game_invite');
  assert.equal(invite.message.sender_username, host.username);

  const joined = await api('POST', '/lobby/join-private', { token: guest.token, body: { host_username: invite.message.sender_username } });
  assert.equal(joined.body.status, 'matched');
  const sessionId = joined.body.session_id;
  const hostStatus = await api('GET', `/lobby/status/${host.id}`, { token: host.token });
  assert.equal(hostStatus.body.session_id, sessionId);

  // Canlı oyun
  const hostEvents = env.openStream(`/multiplayer/sessions/${sessionId}/events?token=${host.token}`);
  const guestEvents = env.openStream(`/multiplayer/sessions/${sessionId}/events?token=${guest.token}`);
  await Promise.all([hostEvents.ready, guestEvents.ready]);

  const players = [{ name: host.username, money: 1_000_000 }, { name: guest.username, money: 1_000_000 }];
  let version = null;
  let turn = 0;
  const tokens = [host.token, guest.token];
  for (let move = 0; move < 4; move++) {
    const nextPlayer = (turn + 1) % 2;
    const state = { players, currentPlayer: nextPlayer, turnCount: 1 + Math.floor((move + 1) / 2) };
    const res = await api('PUT', `/multiplayer/sessions/${sessionId}/state`, {
      token: tokens[turn], body: { state_data: state, event_type: 'end_turn', version }
    });
    assert.equal(res.status, 200, `move ${move}: ${JSON.stringify(res.body)}`);
    version = res.body.updated_at;
    const watcher = turn === 0 ? guestEvents : hostEvents;
    const event = await watcher.next(e => e.type === 'end_turn' && e.version === version);
    assert.equal(event.state_data.currentPlayer, nextPlayer);
    turn = nextPlayer;
  }

  const finalState = { players: [{ ...players[0], money: 1_500_000 }, { ...players[1], money: 200_000 }], currentPlayer: 0, turnCount: 3 };
  const finish = await api('POST', `/multiplayer/sessions/${sessionId}/finish`, {
    token: host.token, body: { state_data: finalState, result_data: { reason: 'completed' } }
  });
  assert.equal(finish.status, 200);
  await guestEvents.next(e => e.type === 'finished');

  const hostStats = await api('GET', `/stats/${host.id}`, { token: host.token });
  assert.equal(hostStats.body.wins, 1);
  assert.equal(hostStats.body.xp, 1000);

  // Maç geçmişi kaydı
  await api('POST', '/games', { token: guest.token, body: { result_data: { players: finalState.players } } });
  const history = await api('GET', `/games/${guest.id}`, { token: guest.token });
  assert.equal(history.body.length, 1);

  [guestInbox, hostEvents, guestEvents].forEach(stream => stream.close());
});
