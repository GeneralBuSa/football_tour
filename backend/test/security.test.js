import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter, validateObjectBody } from '../middleware/security.js';

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
});
