// Promosyon kodu ve oyunda kullanılacak karakter seçimi testleri.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './support/testEnv.js';

let env;
before(async () => { env = await startTestServer(); });
after(async () => { await env.close(); });

async function createCode(code, fields = {}) {
  await env.db.query(
    `INSERT INTO promo_codes (code, coin_reward, character_key, max_redemptions, starts_at, expires_at, is_active)
     VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, now()), $6, $7)`,
    [code, fields.coins ?? 0, fields.character ?? null, fields.max ?? null, fields.starts ?? null, fields.expires ?? null, fields.active ?? true]
  );
}

const redeem = (user, code) => env.api('POST', '/promo/redeem', { token: user.token, body: { code } });

test('valid code grants coins once, is case-insensitive and records the ledger', async () => {
  await createCode('HOSGELDIN-26', { coins: 500 });
  const user = await env.registerUser('promo');
  const first = await redeem(user, '  hosgeldin-26 ');
  assert.equal(first.status, 200);
  assert.deepEqual([first.body.code, first.body.coins, first.body.balance], ['HOSGELDIN-26', 500, 2500]);

  const again = await redeem(user, 'HOSGELDIN-26');
  assert.equal(again.status, 409);
  assert.equal(again.body.code, 'PROMO_ALREADY_REDEEMED');

  const stats = await env.api('GET', `/stats/${user.id}`, { token: user.token });
  assert.equal(stats.body.total_earnings, 2500);
  const { rows } = await env.db.query("SELECT amount FROM coin_ledger WHERE user_id = $1 AND entry_type = 'promo'", [user.id]);
  assert.deepEqual(rows.map(r => Number(r.amount)), [500]);
});

test('character reward adds an entitlement and reports duplicates', async () => {
  await createCode('WIZARD-GIFT', { character: 'wizard' });
  await createCode('WIZARD-GIFT2', { character: 'wizard', coins: 50 });
  const user = await env.registerUser('wiz');
  const res = await redeem(user, 'WIZARD-GIFT');
  assert.equal(res.body.character_key, 'wizard');
  assert.equal(res.body.character_already_owned, false);
  const entitlements = await env.api('GET', `/store/entitlements/${user.id}`, { token: user.token });
  assert.deepEqual(entitlements.body.map(e => [e.character_key, e.source]), [['wizard', 'promo']]);

  const second = await redeem(user, 'WIZARD-GIFT2');
  assert.equal(second.body.character_already_owned, true);
  assert.equal(second.body.coins, 50);
});

test('invalid, inactive, expired, not-started and exhausted codes are rejected', async () => {
  await createCode('OLD-CODE', { coins: 10, starts: '2020-01-01', expires: '2021-01-01' });
  await createCode('FUTURE-CODE', { coins: 10, starts: '2099-01-01' });
  await createCode('OFF-CODE', { coins: 10, active: false });
  await createCode('ONLY-ONE', { coins: 10, max: 1 });
  const a = await env.registerUser('pa');
  const b = await env.registerUser('pb');

  assert.equal((await redeem(a, 'NOPE-1234')).status, 404);
  assert.equal((await redeem(a, 'OFF-CODE')).status, 404);
  assert.equal((await redeem(a, 'OLD-CODE')).status, 410);
  assert.equal((await redeem(a, 'FUTURE-CODE')).status, 409);
  assert.equal((await redeem(a, 'ONLY-ONE')).status, 200);
  const exhausted = await redeem(b, 'ONLY-ONE');
  assert.equal(exhausted.status, 410);
  assert.equal(exhausted.body.code, 'PROMO_EXHAUSTED');

  assert.equal((await redeem(a, 'a b')).status, 400);
  assert.equal((await redeem(a, 'x'.repeat(40))).status, 400);
  assert.equal((await env.api('POST', '/promo/redeem', { body: { code: 'ONLY-ONE' } })).status, 401);

  const { rows } = await env.db.query("SELECT redemption_count FROM promo_codes WHERE code = 'ONLY-ONE'");
  assert.equal(rows[0].redemption_count, 1);
});

test('brute-force attempts are rate limited per user', async () => {
  const user = await env.registerUser('brute');
  let last = 0;
  for (let i = 0; i < 11; i++) last = (await redeem(user, `GUESS-${1000 + i}`)).status;
  assert.equal(last, 429);
});

test('character selection: starter becomes the default, only owned characters can be selected', async () => {
  const user = await env.registerUser('pick');
  await env.api('POST', '/store/starter/claim', { token: user.token, body: { character_key: 'viking' } });
  let me = await env.api('GET', '/auth/me', { token: user.token });
  assert.equal(me.body.selected_character, 'viking');

  const notOwned = await env.api('PUT', '/store/characters/selected', { token: user.token, body: { character_key: 'king' } });
  assert.equal(notOwned.status, 403);
  assert.equal((await env.api('PUT', '/store/characters/selected', { token: user.token, body: { character_key: 'dragon' } })).status, 400);

  const items = await env.api('GET', '/store/items');
  const king = items.body.find(item => item.sku === 'player_king');
  await env.api('POST', '/store/purchase', { token: user.token, body: { item_id: king.id } });
  const selected = await env.api('PUT', '/store/characters/selected', { token: user.token, body: { character_key: 'king' } });
  assert.equal(selected.status, 200);
  assert.equal(selected.body.selected_character, 'king');
  me = await env.api('GET', '/auth/me', { token: user.token });
  assert.equal(me.body.selected_character, 'king');

  const cleared = await env.api('PUT', '/store/characters/selected', { token: user.token, body: { character_key: null } });
  assert.equal(cleared.body.selected_character, null);
});

test('online session exposes each player selected character for the 3D models', async () => {
  await env.db.query('DELETE FROM lobby_queue');
  const host = await env.registerUser('mhost');
  const guest = await env.registerUser('mguest');
  await env.api('POST', '/store/starter/claim', { token: host.token, body: { character_key: 'rocket' } });
  await env.api('POST', '/lobby/join', { token: host.token, body: {} });
  const match = await env.api('POST', '/lobby/join', { token: guest.token, body: {} });
  const session = await env.api('GET', `/multiplayer/sessions/${match.body.session_id}`, { token: guest.token });
  const byRole = Object.fromEntries(session.body.game_session_players.map(p => [p.role, p.users.selected_character]));
  assert.deepEqual(byRole, { host: 'rocket', guest: null });
});
