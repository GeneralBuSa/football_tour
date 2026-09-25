import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter, validateObjectBody } from '../middleware/security.js';
import { requireSameUser } from '../middleware/auth.js';

function response() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; }
  };
}

test('validateObjectBody rejects arrays and accepts JSON objects', () => {
  const rejected = response();
  validateObjectBody({ body: [] }, rejected, () => {});
  assert.equal(rejected.statusCode, 400);

  const accepted = response();
  let nextCalled = false;
  validateObjectBody({ body: { ok: true } }, accepted, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

test('rate limiter blocks requests after configured maximum', () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 1, key: () => 'security-test' });
  const first = response();
  const second = response();
  limiter({ ip: '127.0.0.1' }, first, () => {});
  limiter({ ip: '127.0.0.1' }, second, () => {});
  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 429);
  assert.equal(second.headers['Retry-After'], 60);
});

test('rate limiters keep independent counters for the same client', () => {
  // Regresyon: genel API limiti login limitini tüketmemeli.
  const general = createRateLimiter({ windowMs: 60_000, max: 100 });
  const login = createRateLimiter({ windowMs: 60_000, max: 2 });
  const req = { ip: '10.0.0.1' };
  for (let i = 0; i < 20; i++) general(req, response(), () => {});
  const loginResponse = response();
  let allowed = false;
  login(req, loginResponse, () => { allowed = true; });
  assert.equal(allowed, true);
  assert.equal(loginResponse.statusCode, 200);
});

test('requireSameUser blocks access to other users data', () => {
  const blocked = response();
  requireSameUser({ params: { userId: 'b' }, body: {}, user: { id: 'a' } }, blocked, () => {});
  assert.equal(blocked.statusCode, 403);

  let allowed = false;
  requireSameUser({ params: { userId: 'a' }, body: {}, user: { id: 'a' } }, response(), () => { allowed = true; });
  assert.equal(allowed, true);
});

test('sendDbError hides database internals from the client', async () => {
  const { sendDbError, GENERIC_DB_ERROR } = await import('../middleware/errors.js');
  const res = response();
  const originalError = console.error;
  console.error = () => {};
  try {
    sendDbError(res, { message: 'duplicate key value violates unique constraint "users_email_lower_idx"' });
  } finally {
    console.error = originalError;
  }
  assert.equal(res.statusCode, 500);
  assert.equal(res.payload.error, GENERIC_DB_ERROR);
  assert.doesNotMatch(JSON.stringify(res.payload), /constraint|users_/);
});
