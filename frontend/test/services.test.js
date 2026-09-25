// ApiService, SocialService yardımcıları ve analitik gizlilik kuralları.
import './setup/dom.js';
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ApiService, describeHttpError } from '../services/ApiService.js';
import {
  conversationPartnerId, groupFriends, mergeMessages, validateMessageBody, MAX_MESSAGE_LENGTH, SocialStream
} from '../services/SocialService.js';
import { sanitizeParams, trackEvent, CONSENT_STORAGE_KEY } from '../services/analytics.js';

function mockFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return handler(url, options);
  };
  return calls;
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (body === undefined) throw new SyntaxError('no body');
      return body;
    }
  };
}

beforeEach(() => {
  localStorage.clear();
});

test('login stores token and user; requests carry the bearer token', async () => {
  const api = new ApiService();
  const calls = mockFetch((url) => url.endsWith('/auth/login')
    ? jsonResponse(200, { token: 'jwt-1', user: { id: 'u1', username: 'ali' } })
    : jsonResponse(200, { ok: true }));

  await api.login('ali', 'secret-pass');
  assert.equal(localStorage.getItem('ft26_auth_token'), 'jwt-1');
  assert.equal(api.getUser().username, 'ali');

  await api.getStats('u1');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer jwt-1');
});

test('401 clears the session and dispatches a session-expired event', async () => {
  const api = new ApiService();
  api.setToken('expired');
  api.setUser({ id: 'u1' });
  let expired = 0;
  const onExpired = () => { expired += 1; };
  addEventListener('ft26:session-expired', onExpired);
  mockFetch(() => jsonResponse(401, { error: 'Invalid or expired token' }));

  const res = await api.getMe();
  removeEventListener('ft26:session-expired', onExpired);
  assert.equal(res.status, 401);
  assert.equal(api.isLoggedIn(), false);
  assert.equal(expired, 1);
});

test('non-401 errors mentioning "token" no longer log the user out', async () => {
  const api = new ApiService();
  api.setToken('valid');
  mockFetch(() => jsonResponse(400, { error: 'Şifre sıfırlama süresi dolmuş veya geçersiz token.' }));
  const res = await api.resetPassword('bad', 'new-password');
  assert.match(res.error, /token/);
  assert.equal(api.isLoggedIn(), true);
});

test('network failures and timeouts return actionable messages instead of throwing', async () => {
  const api = new ApiService();
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  const offline = await api.getStoreItems();
  assert.equal(offline.status, 0);
  assert.match(offline.error, /bağlantını kontrol/i);

  globalThis.fetch = async () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; };
  const timeout = await api.getStoreItems();
  assert.match(timeout.error, /zamanında yanıt vermedi/);
});

test('HTTP error mapping hides 5xx internals and explains other failures', () => {
  assert.match(describeHttpError(500, 'duplicate key value violates constraint'), /geçici bir sorun/);
  assert.match(describeHttpError(429, ''), /Çok fazla istek/);
  assert.equal(describeHttpError(404, 'Kullanıcı bulunamadı!'), 'Kullanıcı bulunamadı!');
  assert.match(describeHttpError(403, ''), /yetkin yok/);
});

test('empty / non-JSON error bodies still produce an error object', async () => {
  const api = new ApiService();
  mockFetch(() => jsonResponse(502, undefined));
  const res = await api.getLeaderboard();
  assert.equal(res.status, 502);
  assert.ok(res.error);
});

test('social API helpers hit the right endpoints', async () => {
  const api = new ApiService();
  api.setToken('t');
  api.setUser({ id: 'me' });
  const calls = mockFetch(() => jsonResponse(200, {}));
  await api.rejectFriendRequest('f1');
  await api.removeFriend('f2');
  await api.sendMessage('f3', 'selam');
  await api.getConversation('f3', 20);
  await api.sendGameInvite('f4');
  await api.deleteAccount('pw');
  assert.deepEqual(calls.map(c => `${c.options.method} ${c.url.replace(/^.*\/api/, '')}`), [
    'POST /friends/reject',
    'DELETE /friends/f2',
    'POST /messages',
    'GET /messages/f3?limit=20',
    'POST /messages/invite',
    'DELETE /auth/account'
  ]);
  assert.deepEqual(JSON.parse(calls[2].options.body), { friend_id: 'f3', body: 'selam' });
  assert.equal(api.getMessageStreamUrl().includes('token=t'), true);
});

test('logged-out users cannot call social endpoints', async () => {
  const api = new ApiService();
  const calls = mockFetch(() => jsonResponse(200, {}));
  assert.ok((await api.sendMessage('x', 'y')).error);
  assert.ok((await api.removeFriend('x')).error);
  assert.equal(calls.length, 0);
  assert.equal(api.getMessageStreamUrl(), null);
});

test('mergeMessages de-duplicates by id and keeps chronological order', () => {
  const merged = mergeMessages(
    [{ id: 'b', created_at: '2026-01-01T10:00:02Z', body: 'b' }, { id: 'a', created_at: '2026-01-01T10:00:01Z', body: 'a' }],
    [{ id: 'b', created_at: '2026-01-01T10:00:02Z', body: 'b2' }, { id: 'c', created_at: '2026-01-01T10:00:03Z', body: 'c' }]
  );
  assert.deepEqual(merged.map(m => m.id + m.body), ['aa', 'bb2', 'cc']);
});

test('conversationPartnerId returns the other participant', () => {
  assert.equal(conversationPartnerId({ sender_id: 'me', recipient_id: 'f' }, 'me'), 'f');
  assert.equal(conversationPartnerId({ sender_id: 'f', recipient_id: 'me' }, 'me'), 'f');
});

test('validateMessageBody trims and enforces the length limit', () => {
  assert.deepEqual(validateMessageBody('  hey  '), { ok: true, value: 'hey' });
  assert.equal(validateMessageBody('   ').ok, false);
  assert.equal(validateMessageBody('x'.repeat(MAX_MESSAGE_LENGTH + 1)).ok, false);
  assert.equal(validateMessageBody(null).ok, false);
});

test('groupFriends splits accepted, incoming and outgoing requests', () => {
  const grouped = groupFriends([
    { id: 1, status: 'accepted' },
    { id: 2, status: 'pending', is_sender: false },
    { id: 3, status: 'pending', is_sender: true }
  ]);
  assert.deepEqual([grouped.accepted.length, grouped.incoming[0].id, grouped.outgoing[0].id], [1, 2, 3]);
  assert.deepEqual(groupFriends({ error: 'x' }), { accepted: [], incoming: [], outgoing: [] });
});

test('SocialStream delivers parsed events to subscribers and ignores heartbeats', () => {
  const sources = [];
  globalThis.EventSource = class {
    constructor(url) { this.url = url; sources.push(this); }
    close() { this.closed = true; }
  };
  const stream = new SocialStream({ api: { getMessageStreamUrl: () => 'http://api.test/stream', isLoggedIn: () => true } });
  const received = [];
  const unsubscribe = stream.subscribe(payload => received.push(payload.type));
  sources[0].onmessage({ data: JSON.stringify({ type: 'heartbeat' }) });
  sources[0].onmessage({ data: JSON.stringify({ type: 'message', message: {} }) });
  sources[0].onmessage({ data: 'not json' });
  assert.deepEqual(received, ['message']);
  unsubscribe();
  assert.equal(sources[0].closed, true);
  delete globalThis.EventSource;
});

test('analytics params never include free text / PII', () => {
  assert.deepEqual(
    sanitizeParams({ mode: 'online', turns: 12, won: true, email: 'a@b.com', message: 'Selam dostum nasılsın', 'bad-key': 1 }),
    { mode: 'online', turns: 12, won: true }
  );
});

test('trackEvent is a no-op without configuration or consent', () => {
  let sent = 0;
  globalThis.gtag = () => { sent += 1; };
  localStorage.setItem(CONSENT_STORAGE_KEY, 'granted');
  // NEXT_PUBLIC_GA_MEASUREMENT_ID bu test ortamında tanımlı değil.
  assert.equal(trackEvent('sign_up'), false);
  assert.equal(sent, 0);
  delete globalThis.gtag;
});
