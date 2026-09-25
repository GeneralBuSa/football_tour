// Auth, profil, istatistik, başarım, maç geçmişi, bulut kayıt ve mağaza uçları.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { startTestServer, TEST_JWT_SECRET } from './support/testEnv.js';

let env;
before(async () => { env = await startTestServer(); });
after(async () => { await env.close(); });

test('health check and unknown endpoints', async () => {
  const health = await env.api('GET', '/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.status, 'ok');
  assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(health.headers.get('x-powered-by'), null);
  assert.equal((await env.api('GET', '/does-not-exist')).status, 404);
});

test('malformed JSON returns 400 instead of 500', async () => {
  const res = await env.api('POST', '/auth/login', { body: '{"username":' });
  assert.equal(res.status, 400);
});

test('disallowed CORS origin is rejected with 403', async () => {
  const res = await env.api('GET', '/health', { headers: { Origin: 'https://evil.example' } });
  assert.equal(res.status, 403);
  const ok = await env.api('GET', '/health', { headers: { Origin: 'http://localhost:3000' } });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'http://localhost:3000');
});

test('register: creates user with 2000 starting coins and returns a valid JWT', async () => {
  const user = await env.registerUser('newbie');
  const payload = jwt.verify(user.token, TEST_JWT_SECRET);
  assert.equal(payload.id, user.id);
  const stats = await env.api('GET', `/stats/${user.id}`, { token: user.token });
  assert.equal(stats.body.total_earnings, 2000);
});

test('register validation and duplicate detection (case-insensitive email)', async () => {
  const existing = await env.registerUser('dup');
  const cases = [
    [{ username: 'ab', email: 'a@b.co', password: 'longenough' }, 400],
    [{ username: 'valid_name', email: 'not-an-email', password: 'longenough' }, 400],
    [{ username: 'valid_name', email: 'a@b.co', password: 'short' }, 400],
    [{ username: 'bad name!', email: 'a@b.co', password: 'longenough' }, 400],
    [{ username: existing.username, email: 'fresh@example.com', password: 'longenough' }, 400],
    [{ username: 'fresh_name_x', email: existing.email.toUpperCase(), password: 'longenough' }, 400]
  ];
  for (const [body, status] of cases) {
    const res = await env.api('POST', '/auth/register', { body });
    assert.equal(res.status, status, JSON.stringify(body));
    assert.ok(res.body.error);
  }
});

test('login succeeds with correct password and fails otherwise', async () => {
  const user = await env.registerUser('login');
  const ok = await env.api('POST', '/auth/login', { body: { username: user.username, password: user.password } });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);
  const bad = await env.api('POST', '/auth/login', { body: { username: user.username, password: 'wrong-password' } });
  assert.equal(bad.status, 400);
  const unknown = await env.api('POST', '/auth/login', { body: { username: 'nobody_here', password: 'whatever1' } });
  assert.equal(unknown.status, 400);
});

test('protected endpoints reject missing, malformed and expired tokens', async () => {
  const user = await env.registerUser('tok');
  assert.equal((await env.api('GET', '/auth/me')).status, 401);
  assert.equal((await env.api('GET', '/auth/me', { headers: { Authorization: 'Token abc' } })).status, 401);
  const expired = jwt.sign({ id: user.id, username: user.username }, TEST_JWT_SECRET, { expiresIn: -10 });
  assert.equal((await env.api('GET', '/auth/me', { token: expired })).status, 401);
  const forged = jwt.sign({ id: user.id }, 'another-secret');
  assert.equal((await env.api('GET', '/auth/me', { token: forged })).status, 401);
  const me = await env.api('GET', '/auth/me', { token: user.token });
  assert.equal(me.body.username, user.username);
  assert.equal(me.body.password_hash, undefined);
});

test('avatar update is persisted and validated', async () => {
  const user = await env.registerUser('ava');
  const res = await env.api('PUT', '/auth/avatar', { token: user.token, body: { avatar: '🦁' } });
  assert.equal(res.status, 200);
  assert.equal(res.body.avatar, '🦁');
  assert.equal((await env.api('PUT', '/auth/avatar', { token: user.token, body: { avatar: 'x'.repeat(2001) } })).status, 400);
});

test('password reset flow (dev mode token) is single use', async () => {
  const user = await env.registerUser('reset');
  const forgot = await env.api('POST', '/auth/forgot-password', { body: { username: user.username, email: user.email.toUpperCase() } });
  assert.equal(forgot.status, 200);
  assert.ok(forgot.body.resetToken);

  const reset = await env.api('POST', '/auth/reset-password', { body: { resetToken: forgot.body.resetToken, newPassword: 'brand-new-pass' } });
  assert.equal(reset.status, 200);
  const reuse = await env.api('POST', '/auth/reset-password', { body: { resetToken: forgot.body.resetToken, newPassword: 'another-pass-1' } });
  assert.equal(reuse.status, 400);
  const login = await env.api('POST', '/auth/login', { body: { username: user.username, password: 'brand-new-pass' } });
  assert.equal(login.status, 200);

  // Yanlış e-posta ya da joker karakter bilgi sızdırmaz ve token üretmez
  const wildcard = await env.api('POST', '/auth/forgot-password', { body: { username: user.username, email: '%' } });
  assert.equal(wildcard.body.resetToken, undefined);
});

test('account deletion requires the password and removes all related data', async () => {
  const user = await env.registerUser('gone');
  const friend = await env.registerUser('stay');
  await env.api('POST', '/friends/add', { token: user.token, body: { friend_username: friend.username } });
  await env.api('POST', '/friends/accept', { token: friend.token, body: { friend_id: user.id } });
  await env.api('POST', '/messages', { token: user.token, body: { friend_id: friend.id, body: 'bye' } });
  await env.api('POST', '/saves', { token: user.token, body: { save_data: { turnCount: 1 } } });

  assert.equal((await env.api('DELETE', '/auth/account', { token: user.token, body: {} })).status, 400);
  assert.equal((await env.api('DELETE', '/auth/account', { token: user.token, body: { password: 'wrong-password' } })).status, 403);
  assert.equal((await env.api('DELETE', '/auth/account', { body: { password: user.password } })).status, 401);

  const deleted = await env.api('DELETE', '/auth/account', { token: user.token, body: { password: user.password } });
  assert.equal(deleted.status, 200);

  assert.equal((await env.api('GET', '/auth/me', { token: user.token })).status, 404);
  const login = await env.api('POST', '/auth/login', { body: { username: user.username, password: user.password } });
  assert.equal(login.status, 400);
  const { rows } = await env.db.query(
    `SELECT (SELECT count(*) FROM stats WHERE user_id = $1)::int AS stats,
            (SELECT count(*) FROM direct_messages WHERE sender_id = $1 OR recipient_id = $1)::int AS messages,
            (SELECT count(*) FROM friends WHERE user_id = $1 OR friend_id = $1)::int AS friends,
            (SELECT count(*) FROM game_saves WHERE user_id = $1)::int AS saves`, [user.id]
  );
  assert.deepEqual(rows[0], { stats: 0, messages: 0, friends: 0, saves: 0 });
  assert.equal((await env.api('GET', `/friends/${friend.id}`, { token: friend.token })).body.length, 0);
});

test('stats, achievements and game history are private per user', async () => {
  const a = await env.registerUser('aa');
  const b = await env.registerUser('bb');
  assert.equal((await env.api('GET', `/stats/${b.id}`, { token: a.token })).status, 403);
  assert.equal((await env.api('GET', `/achievements/${b.id}`, { token: a.token })).status, 403);
  assert.equal((await env.api('GET', `/games/${b.id}`, { token: a.token })).status, 403);

  const unlock = await env.api('POST', `/achievements/${a.id}`, { token: a.token, body: { achievement_id: 'FIRST_WIN' } });
  assert.equal(unlock.status, 200);
  const twice = await env.api('POST', `/achievements/${a.id}`, { token: a.token, body: { achievement_id: 'FIRST_WIN' } });
  assert.equal(twice.body.id, unlock.body.id);
  assert.equal((await env.api('POST', `/achievements/${a.id}`, { token: a.token, body: { achievement_id: 'HACKED' } })).status, 400);
  assert.equal((await env.api('GET', `/achievements/${a.id}`, { token: a.token })).body.length, 1);

  const game = await env.api('POST', '/games', { token: a.token, body: { result_data: { players: [{ name: 'x', money: 5 }] } } });
  assert.equal(game.status, 200);
  const history = await env.api('GET', `/games/${a.id}`, { token: a.token });
  assert.equal(history.body.length, 1);
  assert.equal((await env.api('POST', '/games', { token: a.token, body: { result_data: [] } })).status, 400);

  const leaderboard = await env.api('GET', '/stats');
  assert.equal(leaderboard.status, 200);
  assert.ok(Array.isArray(leaderboard.body));
});

test('cloud save: upsert and load, 404 when missing', async () => {
  const user = await env.registerUser('save');
  assert.equal((await env.api('GET', `/saves/${user.id}`, { token: user.token })).status, 404);
  assert.equal((await env.api('POST', '/saves', { token: user.token, body: { save_data: [1, 2] } })).status, 400);
  await env.api('POST', '/saves', { token: user.token, body: { save_data: { turnCount: 3 } } });
  await env.api('POST', '/saves', { token: user.token, body: { save_data: { turnCount: 4 } } });
  const loaded = await env.api('GET', `/saves/${user.id}`, { token: user.token });
  assert.equal(loaded.body.save_data.turnCount, 4);
});

test('store: catalog, purchase with balance check, duplicates and entitlements', async () => {
  const user = await env.registerUser('shop');
  const items = await env.api('GET', '/store/items');
  assert.equal(items.status, 200);
  const players = await env.api('GET', '/store/players');
  assert.equal(players.body.length, 5);
  const prices = players.body.map(p => Number(p.price));
  assert.deepEqual(prices, [...prices].sort((x, y) => x - y), 'oyuncular fiyata göre artan sırada gelmeli');

  const king = items.body.find(item => item.sku === 'player_king');
  const buy = await env.api('POST', '/store/purchase', { token: user.token, body: { item_id: king.id } });
  assert.equal(buy.status, 200);
  assert.equal(buy.body.balance, 1500);
  assert.equal((await env.api('POST', '/store/purchase', { token: user.token, body: { item_id: king.id } })).status, 409);

  const entitlements = await env.api('GET', `/store/entitlements/${user.id}`, { token: user.token });
  assert.deepEqual(entitlements.body.map(e => e.character_key), ['king']);
  const purchases = await env.api('GET', `/store/purchases/${user.id}`, { token: user.token });
  assert.equal(purchases.body[0].store_items.sku, 'player_king');

  const missing = await env.api('POST', '/store/purchase', { token: user.token, body: { item_id: '00000000-0000-0000-0000-000000000000' } });
  assert.equal(missing.status, 404);

  // Bakiye yetmezse satın alma reddedilir ve bakiye değişmez
  await env.db.query('UPDATE stats SET total_earnings = 100 WHERE user_id = $1', [user.id]);
  const rocket = items.body.find(item => item.sku === 'player_rocket');
  const broke = await env.api('POST', '/store/purchase', { token: user.token, body: { item_id: rocket.id } });
  assert.equal(broke.body.error, 'Yetersiz bakiye');
  assert.equal(broke.status, 400);
});

test('starter character can be claimed exactly once', async () => {
  const user = await env.registerUser('starter');
  assert.equal((await env.api('POST', '/store/starter/claim', { token: user.token, body: { character_key: 'king' } })).status, 400);
  const claim = await env.api('POST', '/store/starter/claim', { token: user.token, body: { character_key: 'rocket' } });
  assert.equal(claim.status, 200);
  assert.equal((await env.api('POST', '/store/starter/claim', { token: user.token, body: { character_key: 'viking' } })).status, 409);
});

test('payments: coin packs are listed; checkout and webhook fail safely without Stripe keys', async () => {
  const user = await env.registerUser('pay');
  const packs = await env.api('GET', '/payments/coin-packs');
  assert.deepEqual(packs.body.map(p => p.key), ['coins_100', 'coins_300', 'coins_500', 'coins_1000']);
  assert.equal((await env.api('POST', '/payments/coin-packs/checkout', { token: user.token, body: { pack_key: 'coins_999' } })).status, 400);
  assert.equal((await env.api('POST', '/payments/coin-packs/checkout', { token: user.token, body: { pack_key: 'coins_100' } })).status, 503);
  assert.equal((await env.api('POST', '/payments/webhook', { body: {} })).status, 503);
});

test('without ALLOW_DEV_RESET_TOKEN the reset token is never returned in the response', async () => {
  const user = await env.registerUser('safe');
  const previous = process.env.ALLOW_DEV_RESET_TOKEN;
  process.env.ALLOW_DEV_RESET_TOKEN = '';
  try {
    const res = await env.api('POST', '/auth/forgot-password', { body: { username: user.username, email: user.email } });
    assert.equal(res.status, 503);
    assert.equal(res.body.resetToken, undefined);
    const { rows } = await env.db.query('SELECT count(*)::int AS n FROM password_reset_tokens WHERE user_id = $1', [user.id]);
    assert.equal(rows[0].n, 0, 'kullanılamayacak token veritabanında bırakılmamalı');
  } finally {
    process.env.ALLOW_DEV_RESET_TOKEN = previous;
  }
});
