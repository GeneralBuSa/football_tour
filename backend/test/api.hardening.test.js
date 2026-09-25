// Güvenlik sertleştirmeleri: avatar doğrulaması, kaldırılan eski uç noktalar, liderlik
// tablosunun veri sızdırmaması, girdi doğrulaması ve istemciden gelen sayıların sınırlanması.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { ageSession, onlineState, startTestServer } from './support/testEnv.js';

let env;
let isValidAvatar;
let MAX_AVATAR_DATA_URL_LENGTH;
before(async () => {
  env = await startTestServer();
  ({ isValidAvatar, MAX_AVATAR_DATA_URL_LENGTH } = await import('../routes/auth.js'));
});
after(async () => { await env.close(); });

const jpegDataUrl = size => `data:image/jpeg;base64,${'A'.repeat(size)}`;

test('avatar validation accepts emoji, local images and small uploaded images only', () => {
  ['🦁', '⚽', '👨‍👩‍👧‍👦', 'AB', '/docs/ft26-king.webp', '/assets/logo.webp', jpegDataUrl(20_000), 'data:image/png;base64,iVBORw0KGgo='].forEach(avatar => {
    assert.equal(isValidAvatar(avatar), true, avatar.slice(0, 40));
  });
  [
    '', null, 42, 'x'.repeat(17),
    'https://tracker.example/pixel.png', 'http://evil.example/a.jpg', 'javascript:alert(1)',
    'data:image/svg+xml;base64,PHN2Zz4=', 'data:text/html;base64,PGgxPg==',
    'data:image/jpeg;base64,abc"onerror="alert(1)', jpegDataUrl(MAX_AVATAR_DATA_URL_LENGTH),
    '/assets/../../etc/passwd.png', '//evil.example/a.png', '<img src=x>'
  ].forEach(avatar => {
    assert.equal(isValidAvatar(avatar), false, String(avatar).slice(0, 40));
  });
});

test('avatar endpoint stores an uploaded image and rejects external URLs', async () => {
  const user = await env.registerUser('pic');
  const upload = jpegDataUrl(24_000);
  const ok = await env.api('PUT', '/auth/avatar', { token: user.token, body: { avatar: upload } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.avatar, upload);

  const external = await env.api('PUT', '/auth/avatar', { token: user.token, body: { avatar: 'https://tracker.example/p.png' } });
  assert.equal(external.status, 400);
  const me = await env.api('GET', '/auth/me', { token: user.token });
  assert.equal(me.body.avatar, upload, 'reddedilen istek avatarı değiştirmemeli');
});

test('legacy session create/join endpoints are gone (no bypass of private rooms)', async () => {
  const user = await env.registerUser('legacy');
  const create = await env.api('POST', '/multiplayer/sessions', { token: user.token, body: { mode: 'private' } });
  assert.equal(create.status, 404);
  const join = await env.api('POST', '/multiplayer/sessions/00000000-0000-0000-0000-000000000000/join', { token: user.token, body: {} });
  assert.equal(join.status, 404);
});

test('public leaderboard only exposes display fields, sorted by wins', async () => {
  const a = await env.registerUser('lead');
  const b = await env.registerUser('lead');
  await env.db.query('UPDATE stats SET wins = 5 WHERE user_id = $1', [a.id]);
  await env.db.query('UPDATE stats SET wins = 9 WHERE user_id = $1', [b.id]);

  const res = await env.api('GET', '/stats');
  assert.equal(res.status, 200);
  assert.ok(res.body.length <= 10);
  const names = res.body.map(row => row.playerName);
  assert.ok(names.indexOf(b.username) < names.indexOf(a.username), 'daha çok galibiyet önce gelmeli');
  res.body.forEach(row => {
    assert.deepEqual(Object.keys(row).sort(), ['playerName', 'properties', 'score', 'turns', 'wins']);
  });
  assert.doesNotMatch(JSON.stringify(res.body), /@|password|user_id/);
});

test('store purchase rejects malformed item ids with 400 instead of a server error', async () => {
  const user = await env.registerUser('buyer');
  for (const item_id of ['not-a-uuid', 123, { $ne: null }, '']) {
    const res = await env.api('POST', '/store/purchase', { token: user.token, body: { item_id } });
    assert.equal(res.status, 400, JSON.stringify(item_id));
  }
});

async function startedMatch(prefix) {
  await env.db.query('DELETE FROM lobby_queue');
  const host = await env.registerUser(`${prefix}h`);
  const guest = await env.registerUser(`${prefix}g`);
  await env.api('POST', '/lobby/join', { token: host.token, body: {} });
  const match = await env.api('POST', '/lobby/join', { token: guest.token, body: {} });
  return { host, guest, sessionId: match.body.session_id, names: [host.username, guest.username] };
}

const putState = (sessionId, token, state_data, version, event_type = 'dice_roll') =>
  env.api('PUT', `/multiplayer/sessions/${sessionId}/state`, { token, body: { state_data, version, event_type } });

test('online moves that break the game rules are rejected (anti-cheat)', async () => {
  const { host, sessionId, names } = await startedMatch('cheat');
  const cheats = {
    'kendine para yazmak': onlineState({ names, money: [5_000_000, 1_000_000] }),
    'rakibin parasını silmek': onlineState({ names, money: [1_000_000, 0] }),
    'bedava şehir': onlineState({ names, owned: [[23], []] }),
    'rakibin adına şehir': onlineState({ names, owned: [[], [5]] }),
    'aynı şehir iki oyuncuda': onlineState({ names, money: [900_000, 1_000_000], owned: [[0], [0]] }),
    'bedava stadyum': onlineState({ names, money: [900_000, 1_000_000], owned: [[0], []], stadiums: [{ 0: 3 }, {}] }),
    'tur atlamak': onlineState({ names, currentPlayer: 1, turnCount: 5 }),
    'kesirli para': onlineState({ names, money: [1_000_000.5, 1_000_000] }),
    'eksik oyuncu': { ...onlineState({ names }), players: onlineState({ names }).players.slice(0, 1) }
  };
  for (const [label, state] of Object.entries(cheats)) {
    const res = await putState(sessionId, host.token, state);
    assert.equal(res.status, 422, label);
  }

  // Hücreye göre kazanç: Samsun'a (1) gelip para kazanmak kural dışı; zardan uzun gitmek de.
  assert.equal((await putState(sessionId, host.token, onlineState({ names, money: [1_040_000, 1_000_000], pos: [1, 0] }))).status, 422);
  assert.equal((await putState(sessionId, host.token, onlineState({ names, pos: [20, 0] }))).status, 422);
  assert.equal((await putState(sessionId, host.token, onlineState({ names, pos: [0, 5] }))).status, 422, 'rakibin piyonu oynatılamaz');

  // Kurallara uygun hamle: 4. hücredeki kutudan en büyük ödül (+₺200K).
  const legal = await putState(sessionId, host.token, onlineState({ names, money: [1_200_000, 1_000_000], pos: [4, 0] }));
  assert.equal(legal.status, 200);
  // Kabul edilen durumdan sonra şehir satın alma bedeli ödenmelidir.
  const freeBuy = await putState(sessionId, host.token, onlineState({ names, money: [1_200_000, 1_000_000], owned: [[0], []], pos: [4, 0] }), legal.body.updated_at, 'buy_city');
  assert.equal(freeBuy.status, 422);
  const paidBuy = await putState(sessionId, host.token, onlineState({ names, money: [1_100_000, 1_000_000], owned: [[0], []], pos: [4, 0] }), legal.body.updated_at, 'buy_city');
  assert.equal(paidBuy.status, 200);
});

test('match results come from the server-accepted state, not the finishing request', async () => {
  const { host, guest, sessionId, names } = await startedMatch('result');

  // Oynanmamış maç sonuç/istatistik üretmez.
  const unplayed = await env.api('POST', `/multiplayer/sessions/${sessionId}/finish`, {
    token: host.token, body: { state_data: {}, result_data: { reason: 'forfeit' } }
  });
  assert.equal(unplayed.status, 409);
  assert.equal((await env.api('POST', `/multiplayer/sessions/${sessionId}/finish`, {
    token: host.token, body: { state_data: {}, result_data: { reason: 'completed' } }
  })).status, 400, 'bilinmeyen bitiş nedeni');

  const started = await putState(sessionId, host.token, onlineState({ names, money: [960_000, 1_000_000], pos: [4, 0] }));
  assert.equal(started.status, 200);

  // Kimse iflas etmemişken "bankruptcy" kabul edilmez; sıra sahibi olmayan guest'in
  // gönderdiği sahte iflas durumu da yok sayılır.
  const fakeBankrupt = await env.api('POST', `/multiplayer/sessions/${sessionId}/finish`, {
    token: guest.token, body: { state_data: onlineState({ names, money: [0, 2_000_000] }), result_data: { reason: 'bankruptcy' } }
  });
  assert.equal(fakeBankrupt.status, 409);

  // Süre dolduğunda kazanan, kabul edilmiş durumda daha zengin olan guest'tir.
  await ageSession(env.db, sessionId);
  const finish = await env.api('POST', `/multiplayer/sessions/${sessionId}/finish`, {
    token: host.token, body: { state_data: onlineState({ names, money: [9_000_000, 1] }), result_data: { reason: 'time' } }
  });
  assert.equal(finish.status, 200);
  assert.deepEqual(finish.body.state_data.players.map(p => p.money), [960_000, 1_000_000]);
  const guestStats = await env.api('GET', `/stats/${guest.id}`, { token: guest.token });
  assert.equal(guestStats.body.wins, 1);
  const hostStats = await env.api('GET', `/stats/${host.id}`, { token: host.token });
  assert.equal(hostStats.body.wins, 0);
});

test('resetting the password signs out every existing session', async () => {
  const user = await env.registerUser('revoke');
  const secondDevice = await env.api('POST', '/auth/login', { body: { username: user.username, password: user.password } });
  assert.equal((await env.api('GET', '/auth/me', { token: secondDevice.body.token })).status, 200);

  const forgot = await env.api('POST', '/auth/forgot-password', { body: { username: user.username, email: user.email } });
  const reset = await env.api('POST', '/auth/reset-password', { body: { resetToken: forgot.body.resetToken, newPassword: 'fresh-password-9' } });
  assert.equal(reset.status, 200);

  // Şifre değişmeden önce verilmiş (belki çalınmış) token'lar artık çalışmaz.
  assert.equal((await env.api('GET', '/auth/me', { token: user.token })).status, 401);
  assert.equal((await env.api('GET', '/auth/me', { token: secondDevice.body.token })).status, 401);
  assert.equal((await env.api('POST', '/auth/stream-ticket', { token: user.token, body: {} })).status, 401);

  const login = await env.api('POST', '/auth/login', { body: { username: user.username, password: 'fresh-password-9' } });
  assert.equal(login.status, 200);
  assert.equal((await env.api('GET', '/auth/me', { token: login.body.token })).status, 200);
});

test('stream tickets are short-lived and cannot be used as an API session', async () => {
  const user = await env.registerUser('ticket');
  const res = await env.api('POST', '/auth/stream-ticket', { token: user.token, body: {} });
  assert.equal(res.status, 200);
  assert.equal(res.body.expires_in, 60);
  const payload = JSON.parse(Buffer.from(res.body.ticket.split('.')[1], 'base64url').toString());
  assert.equal(payload.purpose, 'stream');
  assert.ok(payload.exp - payload.iat <= 60);

  assert.equal((await env.api('GET', '/auth/me', { token: res.body.ticket })).status, 401);
  assert.equal((await env.api('POST', '/auth/stream-ticket', { body: {} })).status, 401);
});
