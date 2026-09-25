// Veritabanı seviyesinde canlı eşleştirme fonksiyonlarının birim testleri.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { applySchema, createTestDatabase } from './support/testEnv.js';

let db;
let counter = 0;

async function createUser(prefix = 'p') {
  counter += 1;
  const username = `${prefix}_user_${counter}`;
  const { rows } = await db.query(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username',
    [username, `${username}@example.com`, 'hash']
  );
  return rows[0];
}

const call = async (fn, ...args) => {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(', ');
  return (await db.query(`SELECT * FROM ${fn}(${placeholders})`, args)).rows;
};

async function clearQueue() {
  await db.query('DELETE FROM lobby_queue');
}

before(async () => { db = await createTestDatabase(); });
after(async () => { await db.close(); });

test('schema.sql is idempotent and can be applied twice', async () => {
  await applySchema(db);
  const { rows } = await db.query("SELECT count(*)::int AS n FROM store_items WHERE sku LIKE 'player_%'");
  assert.equal(rows[0].n, 5);
});

test('first player waits, second player gets matched into a shared session', async () => {
  await clearQueue();
  const alice = await createUser();
  const bob = await createUser();

  const [first] = await call('matchmake_player', alice.id);
  assert.equal(first.status, 'searching');
  assert.equal(first.session_id, null);

  const [second] = await call('matchmake_player', bob.id);
  assert.equal(second.status, 'matched');
  assert.equal(second.matched_username, alice.username);
  assert.ok(second.session_id);

  const [poll] = await call('poll_matchmaking', alice.id);
  assert.equal(poll.status, 'matched');
  assert.equal(poll.matched_username, bob.username);
  assert.equal(poll.session_id, second.session_id);

  const { rows: players } = await db.query(
    'SELECT user_id, role FROM game_session_players WHERE session_id = $1 ORDER BY role DESC', [second.session_id]
  );
  assert.deepEqual(players.map(p => [p.user_id, p.role]), [[alice.id, 'host'], [bob.id, 'guest']]);
});

test('polling retries matchmaking so two searching players always find each other', async () => {
  await clearQueue();
  const a = await createUser();
  const b = await createUser();
  // Eşzamanlı kuyruğa girişi taklit et: ikisi de 'searching' durumunda kalmış.
  await db.query(
    "INSERT INTO lobby_queue (user_id, status) VALUES ($1, 'searching'), ($2, 'searching')", [a.id, b.id]
  );
  const [poll] = await call('poll_matchmaking', b.id);
  assert.equal(poll.status, 'matched');
  assert.equal(poll.matched_username, a.username);
});

test('stale queue entries (closed browser) are never matched', async () => {
  await clearQueue();
  const ghost = await createUser();
  const player = await createUser();
  await db.query(
    "INSERT INTO lobby_queue (user_id, status, last_seen) VALUES ($1, 'searching', now() - interval '5 minutes')", [ghost.id]
  );
  const [result] = await call('matchmake_player', player.id);
  assert.equal(result.status, 'searching');
});

test('a matched player cannot be matched a second time by a third player', async () => {
  await clearQueue();
  const a = await createUser();
  const b = await createUser();
  const c = await createUser();
  await call('matchmake_player', a.id);
  await call('matchmake_player', b.id);
  const [third] = await call('matchmake_player', c.id);
  assert.equal(third.status, 'searching');
});

test('poll returns idle when user is not in the queue', async () => {
  await clearQueue();
  const lonely = await createUser();
  const [poll] = await call('poll_matchmaking', lonely.id);
  assert.equal(poll.status, 'idle');
});

test('leaving after a match cancels the untouched session and notifies via poll', async () => {
  await clearQueue();
  const a = await createUser();
  const b = await createUser();
  await call('matchmake_player', a.id);
  const [match] = await call('matchmake_player', b.id);

  const { rows: [{ leave_matchmaking: cancelled }] } = await db.query('SELECT leave_matchmaking($1)', [b.id]);
  assert.equal(cancelled, match.session_id);

  const [poll] = await call('poll_matchmaking', a.id);
  assert.equal(poll.status, 'cancelled');

  // Tekrar kuyruğa girebilmeli
  const [again] = await call('matchmake_player', a.id);
  assert.equal(again.status, 'searching');
});

test('leaving a session that already has game state does not cancel it', async () => {
  await clearQueue();
  const a = await createUser();
  const b = await createUser();
  await call('matchmake_player', a.id);
  const [match] = await call('matchmake_player', b.id);
  await db.query(`UPDATE game_sessions SET state_data = '{"currentPlayer":1}' WHERE id = $1`, [match.session_id]);
  const { rows: [{ leave_matchmaking: cancelled }] } = await db.query('SELECT leave_matchmaking($1)', [b.id]);
  assert.equal(cancelled, null);
});

test('private room: guest joins host with the room code', async () => {
  await clearQueue();
  const host = await createUser('host');
  const guest = await createUser('guest');
  await db.query("INSERT INTO lobby_queue (user_id, status, room_code) VALUES ($1, 'waiting_private', 'K7PX2M')", [host.id]);

  // Kullanıcı adını bilmek yetmez: kod yoksa veya yanlışsa katılınamaz.
  await assert.rejects(call('join_private_session', guest.id, host.username, null), /ROOM_CODE_INVALID/);
  await assert.rejects(call('join_private_session', guest.id, host.username, 'AAAAAA'), /ROOM_CODE_INVALID/);

  const [joined] = await call('join_private_session', guest.id, host.username, ' k7px2m ');
  assert.equal(joined.status, 'matched');
  assert.equal(joined.matched_username, host.username);

  const [hostPoll] = await call('poll_matchmaking', host.id);
  assert.equal(hostPoll.status, 'matched');
  assert.equal(hostPoll.matched_username, guest.username);
  assert.equal(hostPoll.session_id, joined.session_id);
});

test('private room: a friend invited after the room was opened can join without the code', async () => {
  await clearQueue();
  const host = await createUser('host');
  const friend = await createUser('friend');
  await db.query("INSERT INTO lobby_queue (user_id, status, room_code, created_at) VALUES ($1, 'waiting_private', 'Q2W3E4', now() - interval '1 minute')", [host.id]);

  // Oda kurulmadan önceki eski bir davet geçerli değildir.
  await db.query("INSERT INTO direct_messages (sender_id, recipient_id, kind, body, created_at) VALUES ($1, $2, 'game_invite', 'eski', now() - interval '1 hour')", [host.id, friend.id]);
  await assert.rejects(call('join_private_session', friend.id, host.username, null), /ROOM_CODE_INVALID/);

  await db.query("INSERT INTO direct_messages (sender_id, recipient_id, kind, body) VALUES ($1, $2, 'game_invite', 'gel')", [host.id, friend.id]);
  const [joined] = await call('join_private_session', friend.id, host.username, null);
  assert.equal(joined.status, 'matched');
});

test('private room errors: unknown host, own room, full or stale room', async () => {
  await clearQueue();
  const host = await createUser('host');
  const guest = await createUser('guest');
  const lateGuest = await createUser('late');

  await assert.rejects(call('join_private_session', guest.id, 'nobody_here', 'ROOM01'), /HOST_NOT_FOUND/);
  await db.query("INSERT INTO lobby_queue (user_id, status, room_code) VALUES ($1, 'waiting_private', 'ROOM01')", [host.id]);
  await assert.rejects(call('join_private_session', host.id, host.username, 'ROOM01'), /CANNOT_JOIN_OWN_ROOM/);
  await call('join_private_session', guest.id, host.username, 'ROOM01');
  await assert.rejects(call('join_private_session', lateGuest.id, host.username, 'ROOM01'), /PRIVATE_ROOM_UNAVAILABLE/);

  const staleHost = await createUser('stale');
  await db.query(
    "INSERT INTO lobby_queue (user_id, status, last_seen, room_code) VALUES ($1, 'waiting_private', now() - interval '1 hour', 'STALE1')", [staleHost.id]
  );
  await assert.rejects(call('join_private_session', lateGuest.id, staleHost.username, 'STALE1'), /PRIVATE_ROOM_UNAVAILABLE/);
});

test('apply_session_result updates games, wins and xp for both participants', async () => {
  await clearQueue();
  const a = await createUser();
  const b = await createUser();
  await call('matchmake_player', a.id);
  const [match] = await call('matchmake_player', b.id);

  await db.query('SELECT apply_session_result($1, $2, $3)', [match.session_id, b.id, 12]);
  const { rows } = await db.query(
    'SELECT user_id, games_played, wins, xp, total_turns FROM stats WHERE user_id = ANY($1::uuid[])', [[a.id, b.id]]
  );
  const byUser = Object.fromEntries(rows.map(r => [r.user_id, r]));
  assert.deepEqual(
    [byUser[a.id].games_played, byUser[a.id].wins, byUser[a.id].xp, byUser[a.id].total_turns], [1, 0, 500, 12]
  );
  assert.deepEqual(
    [byUser[b.id].games_played, byUser[b.id].wins, byUser[b.id].xp, byUser[b.id].total_turns], [1, 1, 1000, 12]
  );
});

test('get_conversation returns the latest messages between two users in chronological order', async () => {
  const a = await createUser();
  const b = await createUser();
  const c = await createUser();
  for (let i = 1; i <= 5; i++) {
    await db.query(
      "INSERT INTO direct_messages (sender_id, recipient_id, body, created_at) VALUES ($1, $2, $3, now() + ($4 || ' seconds')::interval)",
      [i % 2 ? a.id : b.id, i % 2 ? b.id : a.id, `m${i}`, String(i)]
    );
  }
  await db.query("INSERT INTO direct_messages (sender_id, recipient_id, body) VALUES ($1, $2, 'other')", [c.id, a.id]);

  const rows = await call('get_conversation', a.id, b.id, 3);
  assert.deepEqual(rows.map(r => r.body), ['m3', 'm4', 'm5']);
});

test('economy functions: purchase, starter claim and idempotent coin credit', async () => {
  const user = await createUser();
  const { rows: [item] } = await db.query("SELECT id, price FROM store_items WHERE sku = 'player_wizard'");

  const [purchase] = await call('purchase_store_item', user.id, item.id);
  assert.equal(Number(purchase.out_balance), 2000 - Number(item.price));
  await assert.rejects(call('purchase_store_item', user.id, item.id), /ITEM_ALREADY_PURCHASED/);

  const [starter] = await call('claim_starter_character', user.id, 'viking');
  assert.equal(starter.character_key, 'viking');
  await assert.rejects(call('claim_starter_character', user.id, 'rocket'), /STARTER_ALREADY_CLAIMED/);

  const credit = async () => (await db.query(
    "SELECT credit_coin_purchase('cs_test_1', $1, 'coins_100', 100, 150) AS balance", [user.id]
  )).rows[0].balance;
  const firstBalance = Number(await credit());
  const secondBalance = Number(await credit());
  assert.equal(firstBalance, 2000 - Number(item.price) + 100);
  assert.equal(secondBalance, firstBalance, 'aynı Stripe oturumu ikinci kez coin yüklememeli');
});
