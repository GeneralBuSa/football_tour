// Test ortamı: bellek içi Postgres (PGlite) + gerçek şema + gerçek Express uygulaması.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PgliteSupabase } from './pgliteSupabase.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(here, '../../../database/schema.sql');

export const TEST_JWT_SECRET = 'test-secret-do-not-use-in-production';

export function configureTestEnv() {
  process.env.JWT_SECRET ||= TEST_JWT_SECRET;
  process.env.SUPABASE_URL ||= 'http://supabase.test';
  process.env.SUPABASE_SERVICE_KEY ||= 'test-service-key';
  process.env.CORS_ORIGIN ||= 'http://localhost:3000';
  process.env.NODE_ENV ||= 'test';
  // Testler ve dev-memory şifre sıfırlama token'ını yanıtta görebilir (production'da asla).
  process.env.ALLOW_DEV_RESET_TOKEN ||= '1';
  // Testler aynı IP'den çok sayıda hesap açar.
  process.env.REGISTER_RATE_LIMIT ||= '10000';
}

// Supabase'in sağladığı rolleri ve auth.uid() fonksiyonunu taklit eder, ardından
// database/schema.sql dosyasını olduğu gibi uygular.
export async function createTestDatabase() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT NULL::uuid';
  `);
  await applySchema(db);
  return db;
}

// PGlite pgcrypto eklentisini içermez; gen_random_uuid() Postgres 13+ çekirdeğinde zaten var.
export async function applySchema(db) {
  const sql = readFileSync(schemaPath, 'utf8').replace(/CREATE EXTENSION[^;]*;/g, '');
  await db.exec(sql);
}

export async function startTestServer() {
  configureTestEnv();
  const db = await createTestDatabase();
  const { setSupabaseClient } = await import('../../db.js');
  setSupabaseClient(new PgliteSupabase(db));
  const { createApp } = await import('../../app.js');
  const app = createApp();

  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  async function api(method, urlPath, { token, body, headers = {} } = {}) {
    const response = await fetch(`${baseUrl}/api${urlPath}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers
      },
      body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body))
    });
    const text = await response.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    return { status: response.status, body: json, headers: response.headers };
  }

  let userCounter = 0;
  async function registerUser(prefix = 'user') {
    userCounter += 1;
    const username = `${prefix}_${userCounter}_${Math.random().toString(36).slice(2, 7)}`.slice(0, 24);
    const password = 'correct-horse-battery';
    const res = await api('POST', '/auth/register', {
      body: { username, email: `${username}@example.com`, password }
    });
    if (res.status !== 200) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
    return { ...res.body.user, token: res.body.token, password };
  }

  // Oturum token'ıyla kısa ömürlü SSE akış bileti alır (URL'de yalnızca bilet taşınır).
  async function streamTicket(token) {
    const res = await api('POST', '/auth/stream-ticket', { token });
    if (res.status !== 200) throw new Error(`stream ticket failed: ${res.status}`);
    return res.body.ticket;
  }

  // SSE akışını dinler; gelen olayları toplar ve beklemeye izin verir. token verilirse
  // önce akış bileti alınır ve ?ticket= olarak eklenir.
  function openStream(urlPath, token) {
    const controller = new AbortController();
    const events = [];
    const waiters = [];
    const url = token
      ? streamTicket(token).then(ticket => `${urlPath}${urlPath.includes('?') ? '&' : '?'}ticket=${encodeURIComponent(ticket)}`)
      : Promise.resolve(urlPath);
    const ready = url.then(fullPath => fetch(`${baseUrl}/api${fullPath}`, { signal: controller.signal })).then(async response => {
      if (!response.ok) throw new Error(`stream failed: ${response.status}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      (async () => {
        try {
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let index;
            while ((index = buffer.indexOf('\n\n')) !== -1) {
              const chunk = buffer.slice(0, index);
              buffer = buffer.slice(index + 2);
              const dataLine = chunk.split('\n').find(line => line.startsWith('data: '));
              if (!dataLine) continue;
              const payload = JSON.parse(dataLine.slice(6));
              events.push(payload);
              waiters.slice().forEach(waiter => {
                if (waiter.match(payload)) {
                  waiters.splice(waiters.indexOf(waiter), 1);
                  waiter.resolve(payload);
                }
              });
            }
          }
        } catch { /* stream kapatıldı */ }
      })();
      return response.status;
    });

    return {
      ready,
      events,
      next(match, timeoutMs = 3000) {
        const existing = events.find(match);
        if (existing) return Promise.resolve(existing);
        return new Promise((resolve, reject) => {
          const waiter = { match, resolve };
          waiters.push(waiter);
          setTimeout(() => {
            const idx = waiters.indexOf(waiter);
            if (idx !== -1) {
              waiters.splice(idx, 1);
              reject(new Error('Timed out waiting for stream event'));
            }
          }, timeoutMs);
        });
      },
      close() { controller.abort(); }
    };
  }

  async function close() {
    await new Promise(resolve => {
      server.closeAllConnections?.();
      server.close(() => resolve());
    });
    await db.close();
  }

  return { db, api, baseUrl, registerUser, openStream, streamTicket, close };
}

// Çevrimiçi maç için kurallara uygun bir oyun durumu (game/stateRules.js).
export function onlineState({ money = [1_000_000, 1_000_000], owned = [[], []], stadiums = [{}, {}], pos = [0, 0], currentPlayer = 0, turnCount = 1, names = ['Host', 'Guest'] } = {}) {
  return {
    players: money.map((value, i) => ({ name: names[i], money: value, pos: pos[i], ownedProps: owned[i], stadiums: stadiums[i] })),
    currentPlayer,
    turnCount,
    gameTime: 1800,
    gameLog: []
  };
}

// "Süre doldu" bitişlerini test edebilmek için maçın başlangıç zamanını geriye alır.
export async function ageSession(db, sessionId, minutes = 31) {
  await db.query(`UPDATE game_sessions SET created_at = now() - ($2 || ' minutes')::interval WHERE id = $1`, [sessionId, String(minutes)]);
}
