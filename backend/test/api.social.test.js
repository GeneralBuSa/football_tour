// Arkadaşlık (ekle / kabul / reddet / çıkar) ve arkadaşa mesaj gönderme testleri.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './support/testEnv.js';

let env;
before(async () => { env = await startTestServer(); });
after(async () => { await env.close(); });

async function makeFriends() {
  const a = await env.registerUser('ali');
  const b = await env.registerUser('bea');
  const request = await env.api('POST', '/friends/add', { token: a.token, body: { friend_username: b.username } });
  assert.equal(request.status, 200);
  const accept = await env.api('POST', '/friends/accept', { token: b.token, body: { friend_id: a.id } });
  assert.equal(accept.status, 200);
  return { a, b };
}

const friendsOf = async user => (await env.api('GET', `/friends/${user.id}`, { token: user.token })).body;

test('send friend request, see it as pending on both sides, accept it', async () => {
  const a = await env.registerUser('ali');
  const b = await env.registerUser('bea');

  const request = await env.api('POST', '/friends/add', { token: a.token, body: { friend_username: b.username } });
  assert.equal(request.status, 200);
  assert.equal(request.body.status, 'pending');

  const [outgoing] = await friendsOf(a);
  assert.deepEqual([outgoing.username, outgoing.status, outgoing.is_sender], [b.username, 'pending', true]);
  const [incoming] = await friendsOf(b);
  assert.deepEqual([incoming.username, incoming.status, incoming.is_sender, incoming.friend_id], [a.username, 'pending', false, a.id]);

  const accept = await env.api('POST', '/friends/accept', { token: b.token, body: { friend_id: a.id } });
  assert.equal(accept.status, 200);
  assert.equal((await friendsOf(a))[0].status, 'accepted');
  assert.equal((await friendsOf(b))[0].status, 'accepted');
});

test('add friend validation: unknown user, self, duplicates and bad input', async () => {
  const a = await env.registerUser('ali');
  const b = await env.registerUser('bea');
  assert.equal((await env.api('POST', '/friends/add', { token: a.token, body: { friend_username: 'ghost_user_x' } })).status, 404);
  assert.equal((await env.api('POST', '/friends/add', { token: a.token, body: { friend_username: a.username } })).status, 400);
  assert.equal((await env.api('POST', '/friends/add', { token: a.token, body: { friend_username: '<script>' } })).status, 400);
  assert.equal((await env.api('POST', '/friends/add', { token: a.token, body: {} })).status, 400);
  assert.equal((await env.api('POST', '/friends/add', { body: { friend_username: b.username } })).status, 401);

  await env.api('POST', '/friends/add', { token: a.token, body: { friend_username: b.username } });
  const duplicate = await env.api('POST', '/friends/add', { token: a.token, body: { friend_username: b.username } });
  assert.equal(duplicate.status, 409);
});

test('mutual requests are auto-accepted instead of creating duplicate rows', async () => {
  const a = await env.registerUser('ali');
  const b = await env.registerUser('bea');
  await env.api('POST', '/friends/add', { token: a.token, body: { friend_username: b.username } });
  const reverse = await env.api('POST', '/friends/add', { token: b.token, body: { friend_username: a.username } });
  assert.equal(reverse.status, 200);
  assert.equal(reverse.body.auto_accepted, true);
  const list = await friendsOf(a);
  assert.equal(list.length, 1);
  assert.equal(list[0].status, 'accepted');

  const again = await env.api('POST', '/friends/add', { token: a.token, body: { friend_username: b.username } });
  assert.equal(again.status, 409);
});

test('accepting a non-existent request returns 404, only the recipient can accept', async () => {
  const a = await env.registerUser('ali');
  const b = await env.registerUser('bea');
  await env.api('POST', '/friends/add', { token: a.token, body: { friend_username: b.username } });
  // Gönderen kendi isteğini kabul edemez
  assert.equal((await env.api('POST', '/friends/accept', { token: a.token, body: { friend_id: b.id } })).status, 404);
  assert.equal((await env.api('POST', '/friends/accept', { token: b.token, body: { friend_id: 'not-a-uuid' } })).status, 400);
});

test('reject an incoming request removes it for both users', async () => {
  const a = await env.registerUser('ali');
  const b = await env.registerUser('bea');
  await env.api('POST', '/friends/add', { token: a.token, body: { friend_username: b.username } });
  const reject = await env.api('POST', '/friends/reject', { token: b.token, body: { friend_id: a.id } });
  assert.equal(reject.status, 200);
  assert.equal((await friendsOf(a)).length, 0);
  assert.equal((await friendsOf(b)).length, 0);
  assert.equal((await env.api('POST', '/friends/reject', { token: b.token, body: { friend_id: a.id } })).status, 404);
});

test('cancel an outgoing request and remove an accepted friend', async () => {
  const a = await env.registerUser('ali');
  const b = await env.registerUser('bea');
  await env.api('POST', '/friends/add', { token: a.token, body: { friend_username: b.username } });
  // Alıcı gelen isteği DELETE ile değil reject ile kapatmalı
  assert.equal((await env.api('DELETE', `/friends/${a.id}`, { token: b.token })).status, 400);
  assert.equal((await env.api('DELETE', `/friends/${b.id}`, { token: a.token })).status, 200);
  assert.equal((await friendsOf(b)).length, 0);

  const { a: x, b: y } = await makeFriends();
  const removed = await env.api('DELETE', `/friends/${x.id}`, { token: y.token });
  assert.equal(removed.status, 200);
  assert.equal((await friendsOf(x)).length, 0);
  assert.equal((await env.api('DELETE', `/friends/${x.id}`, { token: y.token })).status, 404);
});

test('friends list of another user is forbidden', async () => {
  const a = await env.registerUser('ali');
  const b = await env.registerUser('bea');
  assert.equal((await env.api('GET', `/friends/${b.id}`, { token: a.token })).status, 403);
});

test('friends can exchange messages; history is ordered and unread counts clear on read', async () => {
  const { a, b } = await makeFriends();
  const first = await env.api('POST', '/messages', { token: a.token, body: { friend_id: b.id, body: '  Selam!  ' } });
  assert.equal(first.status, 201);
  assert.equal(first.body.body, 'Selam!');
  assert.equal(first.body.sender_username, a.username);
  await env.api('POST', '/messages', { token: b.token, body: { friend_id: a.id, body: 'Aleyküm selam' } });
  await env.api('POST', '/messages', { token: a.token, body: { friend_id: b.id, body: 'Maç yapalım mı?' } });

  const unread = await env.api('GET', '/messages/unread', { token: b.token });
  assert.equal(unread.body.counts[a.id], 2);

  const history = await env.api('GET', `/messages/${a.id}`, { token: b.token });
  assert.equal(history.status, 200);
  assert.deepEqual(history.body.map(m => m.body), ['Selam!', 'Aleyküm selam', 'Maç yapalım mı?']);

  const afterRead = await env.api('GET', '/messages/unread', { token: b.token });
  assert.equal(afterRead.body.counts[a.id], undefined);
});

test('messages are delivered live over the user stream and presence is reported', async () => {
  const { a, b } = await makeFriends();
  const stream = env.openStream(`/messages/stream`, b.token);
  await stream.ready;
  await stream.next(e => e.type === 'connected');

  const list = await friendsOf(a);
  assert.equal(list[0].online, true, 'b akışa bağlıyken çevrimiçi görünmeli');

  await env.api('POST', '/messages', { token: a.token, body: { friend_id: b.id, body: 'canlı mesaj' } });
  const event = await stream.next(e => e.type === 'message' && e.message.body === 'canlı mesaj');
  assert.equal(event.message.sender_id, a.id);
  assert.equal(event.message.recipient_id, b.id);

  const removal = env.api('DELETE', `/friends/${a.id}`, { token: b.token });
  await removal;
  await stream.next(e => e.type === 'friends_changed' && e.action === 'removed');
  stream.close();
});

test('messaging is restricted to accepted friends and validates the body', async () => {
  const a = await env.registerUser('ali');
  const b = await env.registerUser('bea');
  assert.equal((await env.api('POST', '/messages', { token: a.token, body: { friend_id: b.id, body: 'hey' } })).status, 403);
  assert.equal((await env.api('GET', `/messages/${b.id}`, { token: a.token })).status, 403);

  await env.api('POST', '/friends/add', { token: a.token, body: { friend_username: b.username } });
  // Bekleyen istek varken de mesaj atılamaz
  assert.equal((await env.api('POST', '/messages', { token: a.token, body: { friend_id: b.id, body: 'hey' } })).status, 403);
  await env.api('POST', '/friends/accept', { token: b.token, body: { friend_id: a.id } });

  assert.equal((await env.api('POST', '/messages', { token: a.token, body: { friend_id: b.id, body: '   ' } })).status, 400);
  assert.equal((await env.api('POST', '/messages', { token: a.token, body: { friend_id: b.id, body: 'x'.repeat(501) } })).status, 400);
  assert.equal((await env.api('POST', '/messages', { token: a.token, body: { friend_id: 'abc', body: 'hey' } })).status, 400);
  assert.equal((await env.api('POST', '/messages', { body: { friend_id: b.id, body: 'hey' } })).status, 401);
  const stream = await fetch(`${env.baseUrl}/api/messages/stream?ticket=bad`);
  assert.equal(stream.status, 401);
  const sessionToken = await fetch(`${env.baseUrl}/api/messages/stream?ticket=${a.token}`);
  assert.equal(sessionToken.status, 401, "oturum token'ı akış bileti yerine geçmemeli");
});

test('game invite requires an open private room and reaches the friend', async () => {
  const { a, b } = await makeFriends();
  const noRoom = await env.api('POST', '/messages/invite', { token: a.token, body: { friend_id: b.id } });
  assert.equal(noRoom.status, 409);

  await env.api('POST', '/lobby/create-private', { token: a.token, body: {} });
  const invite = await env.api('POST', '/messages/invite', { token: a.token, body: { friend_id: b.id } });
  assert.equal(invite.status, 201);
  assert.equal(invite.body.kind, 'game_invite');

  const joined = await env.api('POST', '/lobby/join-private', { token: b.token, body: { host_username: a.username } });
  assert.equal(joined.body.status, 'matched');
});

test('per-user message rate limit blocks spam', async () => {
  const { a, b } = await makeFriends();
  let lastStatus = 0;
  for (let i = 0; i < 31; i++) {
    lastStatus = (await env.api('POST', '/messages', { token: a.token, body: { friend_id: b.id, body: `spam ${i}` } })).status;
  }
  assert.equal(lastStatus, 429);
});
