import { EventEmitter } from 'events';

// Tek instance içi canlı olay yolu (SSE). Çoklu instance dağıtımında bunun yerine
// Redis/Supabase Realtime gibi ortak bir yayın kanalı kullanılmalıdır.
const sessionBus = new EventEmitter();
const userBus = new EventEmitter();
sessionBus.setMaxListeners(0);
userBus.setMaxListeners(0);

const userConnections = new Map();

export function publishToSession(sessionId, payload) {
  sessionBus.emit(sessionId, { ...payload, emitted_at: new Date().toISOString() });
}

export function subscribeToSession(sessionId, listener) {
  sessionBus.on(sessionId, listener);
  return () => sessionBus.off(sessionId, listener);
}

export function publishToUser(userId, payload) {
  if (!userId) return;
  userBus.emit(userId, { ...payload, emitted_at: new Date().toISOString() });
}

export function subscribeToUser(userId, listener) {
  userBus.on(userId, listener);
  userConnections.set(userId, (userConnections.get(userId) || 0) + 1);
  return () => {
    userBus.off(userId, listener);
    const remaining = (userConnections.get(userId) || 1) - 1;
    if (remaining <= 0) userConnections.delete(userId);
    else userConnections.set(userId, remaining);
  };
}

// Kullanıcının açık bir bildirim akışı (SSE) varsa çevrimiçi kabul edilir.
export function isUserOnline(userId) {
  return userConnections.has(userId);
}

// Server-Sent Events yanıtını hazırlar ve periyodik heartbeat gönderir.
export function openEventStream(req, res, onClose) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders?.();

  const send = payload => {
    res.write(`event: message\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };
  const heartbeat = setInterval(() => send({ type: 'heartbeat' }), 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    onClose?.();
  });

  return send;
}
