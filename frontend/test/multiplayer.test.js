// Canlı oyun senkronizasyonu (MultiplayerService) birim testleri.
import './setup/dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { MultiplayerService } from '../services/MultiplayerService.js';

function fakeApi({ userId = 'me', session = null } = {}) {
  const calls = [];
  return {
    calls,
    token: 'token',
    getUser: () => ({ id: userId }),
    getMultiplayerSession: async () => session,
    updateMultiplayerState: async (sessionId, state, eventType, version) => {
      calls.push({ sessionId, state, eventType, version });
      return { updated_at: `2026-01-01T00:00:0${calls.length}.000000+00:00` };
    }
  };
}

function createService(options) {
  const api = fakeApi(options);
  const service = new MultiplayerService({ api, apiBase: 'http://api.test' });
  return { api, service };
}

test('opponent moves of any event type are applied (dice_roll, end_turn, buy_city...)', async () => {
  const { service } = createService();
  const applied = [];
  await service.start('s1', state => applied.push(state), 0);

  for (const type of ['dice_roll', 'end_turn', 'buy_city', 'upgrade_stadium', 'open_lootbox', 'state_update']) {
    service.handleEvent({ type, user_id: 'opponent', state_data: { move: type }, version: `v-${type}` });
  }
  assert.deepEqual(applied.map(s => s.move), ['dice_roll', 'end_turn', 'buy_city', 'upgrade_stadium', 'open_lootbox', 'state_update']);
});

test('own echoed moves are not re-applied but still advance the version', async () => {
  const { service } = createService({ userId: 'me' });
  const applied = [];
  await service.start('s1', state => applied.push(state), 0);
  service.handleEvent({ type: 'dice_roll', user_id: 'me', state_data: { x: 1 }, version: '2026-01-01T00:00:05.000000+00:00' });
  assert.equal(applied.length, 0);
  assert.equal(service.version, '2026-01-01T00:00:05.000000+00:00');
});

test('older versions never overwrite a newer one', async () => {
  const { service } = createService();
  await service.start('s1', () => {}, 0);
  service.handleEvent({ type: 'end_turn', user_id: 'o', state_data: {}, version: '2026-01-01T00:00:09.000000+00:00' });
  service.handleEvent({ type: 'end_turn', user_id: 'o', state_data: {}, version: '2026-01-01T00:00:03.000000+00:00' });
  assert.equal(service.version, '2026-01-01T00:00:09.000000+00:00');
});

test('heartbeat / connected events are ignored', async () => {
  const { service } = createService();
  const applied = [];
  await service.start('s1', state => applied.push(state), 0);
  service.handleEvent({ type: 'heartbeat' });
  service.handleEvent({ type: 'connected', session_id: 's1' });
  assert.equal(applied.length, 0);
});

test('cancelled and opponent-finished sessions notify onClosed exactly once', async () => {
  const { service } = createService({ userId: 'me' });
  const closed = [];
  await service.start('s1', () => {}, 0, { onClosed: details => closed.push(details) });
  service.handleEvent({ type: 'finished', user_id: 'me', state_data: {} });
  assert.equal(closed.length, 0, 'kendi bitirdiğimiz maç bildirimi tekrar tetiklememeli');
  service.handleEvent({ type: 'finished', user_id: 'opponent', state_data: { a: 1 }, result_data: { reason: 'forfeit' } });
  service.handleEvent({ type: 'cancelled' });
  assert.equal(closed.length, 1);
  assert.equal(closed[0].reason, 'finished');
  assert.equal(closed[0].result_data.reason, 'forfeit');
});

test('turn control: locked after prepare(), only local player index may move', async () => {
  const { service } = createService();
  assert.equal(service.canControlTurn(0), true, 'çevrimdışı oyunda her zaman oynanabilir');
  service.prepare('s1');
  assert.equal(service.canControlTurn(0), false, 'rol belli olana kadar kilitli');
  assert.equal(service.canControlTurn(1), false);
  await service.start('s1', () => {}, 1);
  assert.equal(service.canControlTurn(0), false);
  assert.equal(service.canControlTurn(1), true);
  service.stop();
  assert.equal(service.canControlTurn(0), true);
});

test('syncState sends moves sequentially, each carrying the previous response version', async () => {
  const { service, api } = createService();
  await service.start('s1', () => {}, 0);
  let resolveFirst;
  const gate = new Promise(resolve => { resolveFirst = resolve; });
  const original = api.updateMultiplayerState;
  let count = 0;
  api.updateMultiplayerState = async (...args) => {
    count += 1;
    if (count === 1) await gate;
    return original(...args);
  };

  const first = service.syncState({ n: 1 }, 'dice_roll');
  const second = service.syncState({ n: 2 }, 'end_turn');
  await new Promise(r => setTimeout(r, 10));
  assert.equal(api.calls.length, 0, 'ikinci istek birincinin cevabını beklemeli');
  resolveFirst();
  await Promise.all([first, second]);

  assert.equal(api.calls.length, 2);
  assert.equal(api.calls[0].version, null);
  assert.equal(api.calls[1].version, '2026-01-01T00:00:01.000000+00:00');
  assert.equal(api.calls[1].eventType, 'end_turn');
});

test('a stale write (409) triggers a resync with the server state', async () => {
  const serverState = { players: [], currentPlayer: 1 };
  const { service, api } = createService({ session: { status: 'active', state_data: serverState, updated_at: 'v-server' } });
  const applied = [];
  await service.start('s1', state => applied.push(state), 0);
  applied.length = 0;
  api.updateMultiplayerState = async () => ({ error: 'Stale state update ignored', db_version: 'v-server', status: 409 });

  await service.syncState({ currentPlayer: 0 }, 'end_turn');
  assert.deepEqual(applied, [serverState]);
  assert.equal(service.version, 'v-server');
});

test('syncState is skipped while applying remote state or without a session', async () => {
  const { service, api } = createService();
  assert.deepEqual(await service.syncState({}), { skipped: true });
  await service.start('s1', () => {}, 0);
  service.setApplyingRemoteState(true);
  assert.deepEqual(await service.syncState({}), { skipped: true });
  assert.equal(api.calls.length, 0);
});

test('resync on start reports sessions that were already cancelled', async () => {
  const { service } = createService({ session: { status: 'cancelled', state_data: {} } });
  const closed = [];
  await service.start('s1', () => {}, 0, { onClosed: d => closed.push(d) });
  await service.resync();
  assert.equal(closed.length, 1);
  assert.equal(closed[0].reason, 'cancelled');
});
