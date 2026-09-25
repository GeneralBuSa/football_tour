import jwt from 'jsonwebtoken';
import { supabase } from '../db.js';

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

// Oturum sürümü: şifre sıfırlandığında users.token_version artırılır ve o ana kadar
// verilmiş tüm oturum token'ları (tv alanı eski kalan) geçersiz olur. Silinen hesabın
// token'ları da kullanıcı bulunamadığı için reddedilir. Her istekte veritabanına
// gitmemek için sonuç kısa süre önbellekte tutulur; değişiklikte önbellek temizlenir.
const TOKEN_VERSION_CACHE_MS = 30_000;
const tokenVersionCache = new Map();

async function getTokenVersion(userId) {
  const cached = tokenVersionCache.get(userId);
  if (cached && Date.now() - cached.at < TOKEN_VERSION_CACHE_MS) return cached.version;

  const { data, error } = await supabase
    .from('users')
    .select('token_version')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const version = data ? Number(data.token_version) || 0 : null;
  tokenVersionCache.set(userId, { version, at: Date.now() });
  if (tokenVersionCache.size > 10_000) tokenVersionCache.delete(tokenVersionCache.keys().next().value);
  return version;
}

export function invalidateTokenVersion(userId) {
  tokenVersionCache.delete(userId);
}

export function signSessionToken(user, jwtSecret) {
  return jwt.sign({ id: user.id, username: user.username, tv: Number(user.token_version) || 0 }, jwtSecret, { expiresIn: '7d' });
}

// Canlı akış (SSE) bileti: EventSource başlık gönderemediği için URL'de taşınır. Uzun
// ömürlü oturum token'ının URL'lere (sunucu/proxy kayıtlarına) düşmemesi için yalnızca
// bu amaca özel, 60 saniyelik bir token kullanılır.
const STREAM_TICKET_TTL_SECONDS = 60;

export function signStreamTicket(user, jwtSecret) {
  return jwt.sign({ id: user.id, username: user.username, purpose: 'stream' }, jwtSecret, { expiresIn: STREAM_TICKET_TTL_SECONDS });
}

export function verifyStreamTicket(ticket, jwtSecret) {
  if (typeof ticket !== 'string' || !ticket) return null;
  try {
    const payload = jwt.verify(ticket, jwtSecret);
    return payload.purpose === 'stream' ? payload : null;
  } catch {
    return null;
  }
}

export function createAuthMiddleware() {
  const jwtSecret = requireEnv('JWT_SECRET');

  return async function authenticate(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Authorization token required' });
    }

    let payload;
    try {
      payload = jwt.verify(token, jwtSecret);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    // Akış biletleri gibi özel amaçlı token'lar API oturumu olarak kullanılamaz.
    if (payload.purpose || typeof payload.id !== 'string') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    try {
      const currentVersion = await getTokenVersion(payload.id);
      if (currentVersion === null || (Number(payload.tv) || 0) !== currentVersion) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
    } catch (error) {
      console.error('[auth] token version check failed:', error.message);
      return res.status(503).json({ error: 'Oturum doğrulanamadı. Lütfen biraz sonra tekrar deneyin.' });
    }

    req.user = payload;
    return next();
  };
}

export function requireSameUser(req, res, next) {
  const requestedUserId = req.params.userId || req.params.user_id || req.body.user_id;
  if (requestedUserId && requestedUserId !== req.user.id) {
    return res.status(403).json({ error: 'You can only access your own account data' });
  }
  return next();
}
