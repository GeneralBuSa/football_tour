#!/usr/bin/env node
// Çalışan (lokal/staging/prod) bir API'ye karşı hızlı smoke kontrolü.
//
//   SMOKE_API_URL=https://api.example.com/api npm run smoke
//
// Varsayılan olarak sadece okuma yapar. SMOKE_WRITE=1 verilirse iki geçici kullanıcı
// oluşturup eşleştirme, arkadaşlık ve mesajlaşma akışını da dener (staging için).

const base = (process.env.SMOKE_API_URL || 'http://localhost:8000/api').replace(/\/$/, '');
const allowWrites = process.env.SMOKE_WRITE === '1';
let failures = 0;

async function call(method, path, { token, body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  let json = null;
  try { json = await response.json(); } catch { /* boş gövde */ }
  return { status: response.status, body: json };
}

async function check(name, fn) {
  try {
    await fn();
    console.log(`✔ ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`✖ ${name}: ${error.message}`);
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

await check('health', async () => {
  const res = await call('GET', '/health');
  expect(res.status === 200 && res.body?.status === 'ok', `status ${res.status}`);
});
await check('store catalog', async () => {
  const res = await call('GET', '/store/items');
  expect(res.status === 200 && Array.isArray(res.body) && res.body.length > 0, `status ${res.status}`);
});
await check('coin packs', async () => {
  const res = await call('GET', '/payments/coin-packs');
  expect(res.status === 200 && Array.isArray(res.body), `status ${res.status}`);
});
await check('leaderboard', async () => {
  const res = await call('GET', '/stats');
  expect(res.status === 200 && Array.isArray(res.body), `status ${res.status}`);
});
await check('protected routes require auth', async () => {
  const res = await call('GET', '/auth/me');
  expect(res.status === 401, `expected 401, got ${res.status}`);
});

if (allowWrites) {
  const suffix = Date.now().toString(36).slice(-6);
  const users = [];
  await check('register two users', async () => {
    for (const name of [`smk_a_${suffix}`, `smk_b_${suffix}`]) {
      const res = await call('POST', '/auth/register', {
        body: { username: name, email: `${name}@example.com`, password: `Smoke-${suffix}-pass` }
      });
      expect(res.status === 200, `register ${name}: ${res.status} ${res.body?.error}`);
      users.push({ ...res.body.user, token: res.body.token });
    }
  });
  const [a, b] = users;
  if (a && b) {
    await check('friend request + accept', async () => {
      expect((await call('POST', '/friends/add', { token: a.token, body: { friend_username: b.username } })).status === 200, 'add');
      expect((await call('POST', '/friends/accept', { token: b.token, body: { friend_id: a.id } })).status === 200, 'accept');
    });
    await check('direct message', async () => {
      const res = await call('POST', '/messages', { token: a.token, body: { friend_id: b.id, body: 'smoke' } });
      expect(res.status === 201, `status ${res.status}`);
    });
    await check('quick match', async () => {
      expect((await call('POST', '/lobby/join', { token: a.token, body: {} })).body?.status === 'searching', 'first player should wait');
      const res = await call('POST', '/lobby/join', { token: b.token, body: {} });
      expect(res.body?.status === 'matched' && res.body.session_id, `second player: ${JSON.stringify(res.body)}`);
      await call('POST', '/lobby/leave', { token: a.token, body: {} });
      await call('POST', '/lobby/leave', { token: b.token, body: {} });
    });
    await check('cleanup friendship', async () => {
      expect((await call('DELETE', `/friends/${b.id}`, { token: a.token })).status === 200, 'remove');
    });
  }
}

if (failures) {
  console.error(`\n${failures} smoke check(s) failed against ${base}`);
  process.exit(1);
}
console.log(`\nAll smoke checks passed against ${base}`);
