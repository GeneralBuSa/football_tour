import express from 'express';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { supabase } from '../db.js';
import {
  createAuthMiddleware, invalidateTokenVersion, requireEnv, signSessionToken, signStreamTicket
} from '../middleware/auth.js';
import { isEmailConfigured, sendPasswordResetEmail } from '../services/email.js';
import { createRateLimiter, validateObjectBody } from '../middleware/security.js';
import { sendDbError } from '../middleware/errors.js';

const router = express.Router();
const authenticate = createAuthMiddleware();
const jwtSecret = requireEnv('JWT_SECRET');
const resetAttempts = new Map();
const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });
// Her yeni hesap başlangıç coin'i ve ücretsiz karakter aldığı için toplu hesap açmaya karşı
// IP başına saatlik sınır (paylaşılan ağlar için makul; REGISTER_RATE_LIMIT ile ayarlanır).
const registerLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: Number(process.env.REGISTER_RATE_LIMIT) || 20 });
const forgotPasswordLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });
const deleteAccountLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5, key: req => `delete:${req.user.id}` });

function isStrongEnoughPassword(password) {
  return typeof password === 'string' && password.length >= 8 && password.length <= 128;
}

function isValidUsername(username) {
  return typeof username === 'string' && /^[A-Za-z0-9_]{3,24}$/.test(username);
}

function isResetRateLimited(key) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 5;
  const attempts = (resetAttempts.get(key) || []).filter(ts => now - ts < windowMs);
  attempts.push(now);
  resetAttempts.set(key, attempts);
  return attempts.length > maxAttempts;
}

// Avatar: kısa emoji/metin, sitedeki yerel bir görsel ya da profil sayfasının kırpıp
// küçülttüğü bir data URL. Harici http(s) adresleri kabul edilmez: arkadaş listesinde ve
// maçta görüntülendiklerinde diğer oyuncuların IP adreslerini üçüncü taraflara sızdırırlar.
export const MAX_AVATAR_DATA_URL_LENGTH = 32_000;
const AVATAR_DATA_URL_PATTERN = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const AVATAR_LOCAL_PATH_PATTERN = /^\/(?:assets|docs)\/[A-Za-z0-9_./-]{1,120}\.(?:png|jpe?g|webp|svg)$/;

export function isValidAvatar(avatar) {
  if (typeof avatar !== 'string' || !avatar) return false;
  if (avatar.startsWith('data:')) {
    return avatar.length <= MAX_AVATAR_DATA_URL_LENGTH && AVATAR_DATA_URL_PATTERN.test(avatar);
  }
  if (avatar.startsWith('/')) return AVATAR_LOCAL_PATH_PATTERN.test(avatar) && !avatar.includes('..');
  // Emoji/metin: en fazla 16 karakter, URL veya kontrol karakteri içermez.
  return avatar.length <= 16 && !/[\u0000-\u001f<>]/.test(avatar) && !/^[a-z][a-z0-9+.-]*:/i.test(avatar);
}

function hashResetToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

// Register
router.post('/register', validateObjectBody, registerLimiter, async (req, res) => {
  const { username, password } = req.body;
  // E-posta DB'de lower(email) üzerinden unique; kontrolü de aynı biçimde yapıyoruz.
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!username || !email || !password || email.length > 320 || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: 'Valid username, email, and password are required' });
  }
  if (!isValidUsername(username)) {
    return res.status(400).json({ error: 'Kullanıcı adı 3-24 karakter olmalı; yalnızca harf, rakam ve alt çizgi içerebilir.' });
  }
  if (!isStrongEnoughPassword(password)) {
    return res.status(400).json({ error: 'Şifre en az 8 karakter olmalıdır.' });
  }

  try {
    // Kullanıcı adı kontrolü
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({ error: 'Bu kullanıcı adı zaten alınmış!' });
    }

    // E-posta kontrolü
    const { data: existingEmail } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingEmail) {
      return res.status(400).json({ error: 'Bu e-posta adresi zaten kullanımda!' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const { data, error } = await supabase
      .from('users')
      .insert([{ username, email, password_hash }])
      .select()
      .single();

    if (error) return sendDbError(res, error);

    const token = signSessionToken(data, jwtSecret);
    
    res.json({ token, user: { id: data.id, username: data.username, email: data.email, avatar: data.avatar, selected_character: data.selected_character || null } });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', validateObjectBody, loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!isValidUsername(username) || typeof password !== 'string' || password.length > 128) {
    return res.status(400).json({ error: 'Invalid credentials' });
  }
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !data) return res.status(400).json({ error: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, data.password_hash);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    const token = signSessionToken(data, jwtSecret);
    res.json({ token, user: { id: data.id, username: data.username, email: data.email, avatar: data.avatar, selected_character: data.selected_character || null } });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get Me
router.get('/me', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, email, avatar, selected_character, created_at')
      .eq('id', req.user.id)
      .single();

    if (error) return res.status(404).json({ error: 'User not found' });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Canlı bildirim/maç akışı (SSE) için kısa ömürlü bilet. EventSource başlık gönderemez;
// URL'de oturum token'ı yerine yalnızca bu bilet taşınır.
router.post('/stream-ticket', authenticate, (req, res) => {
  res.json({ ticket: signStreamTicket(req.user, jwtSecret), expires_in: 60 });
});

// Update Avatar
router.put('/avatar', authenticate, validateObjectBody, async (req, res) => {
  const { avatar } = req.body;
  if (!isValidAvatar(avatar)) {
    return res.status(400).json({ error: 'Geçersiz avatar. Bir emoji seçin veya en fazla 32 KB boyutunda bir resim yükleyin.' });
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .update({ avatar })
      .eq('id', req.user.id)
      .select('id, username, email, avatar')
      .single();

    if (error) return sendDbError(res, error);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Hesabı kalıcı olarak sil. Şifre ile yeniden doğrulama zorunludur; kullanıcıya bağlı
// tüm tablolar (stats, mesajlar, arkadaşlıklar, kayıtlar, satın almalar...) ON DELETE
// CASCADE ile birlikte silinir.
router.delete('/account', authenticate, deleteAccountLimiter, validateObjectBody, async (req, res) => {
  const { password } = req.body;
  if (typeof password !== 'string' || !password || password.length > 128) {
    return res.status(400).json({ error: 'Hesabı silmek için şifrenizi girin.' });
  }

  const { data: account, error } = await supabase
    .from('users')
    .select('id, password_hash')
    .eq('id', req.user.id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: 'Hesap doğrulanamadı. Lütfen tekrar deneyin.' });
  if (!account) return res.status(404).json({ error: 'Hesap bulunamadı.' });

  const isMatch = await bcrypt.compare(password, account.password_hash);
  if (!isMatch) return res.status(403).json({ error: 'Şifre hatalı.' });

  await supabase.rpc('leave_matchmaking', { p_user_id: req.user.id });
  const { error: deleteError } = await supabase.from('users').delete().eq('id', req.user.id);
  if (deleteError) {
    console.error('[auth/account] delete failed:', deleteError.message);
    return res.status(500).json({ error: 'Hesap silinemedi. Lütfen daha sonra tekrar deneyin.' });
  }
  invalidateTokenVersion(req.user.id);

  res.json({ success: true });
});

// Forgot Password (Verify Username & Email)
router.post('/forgot-password', validateObjectBody, forgotPasswordLimiter, async (req, res) => {
  const { username } = req.body;
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : req.body.email;
  if (!username || !email) return res.status(400).json({ error: 'Eksik bilgi girdiniz.' });
  if (typeof username !== 'string' || typeof email !== 'string' || username.length > 24 || email.length > 320) {
    return res.status(400).json({ error: 'Eksik bilgi girdiniz.' });
  }
  const rateKey = `${username}:${email}:${req.ip}`;
  if (isResetRateLimited(rateKey)) {
    return res.status(429).json({ error: 'Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.' });
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, email')
      .eq('username', username)
      .maybeSingle();

    // ilike kullanılmaz: kullanıcı girdisindeki % ve _ joker karakter gibi davranırdı.
    if (error || !data || String(data.email).toLowerCase() !== email) {
      return res.json({ success: true, emailSent: true });
    }

    const resetToken = randomBytes(32).toString('base64url');
    const tokenHash = hashResetToken(resetToken);
    const { error: tokenError } = await supabase.from('password_reset_tokens').insert([{
      user_id: data.id,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    }]);
    if (tokenError) return res.status(500).json({ error: 'Şifre sıfırlama isteği oluşturulamadı.' });

    if (isEmailConfigured()) {
      await sendPasswordResetEmail({ to: data.email, username: data.username, resetToken });
      return res.json({ success: true, emailSent: true });
    }

    // Token'ı yanıtta döndürmek yalnızca yerel geliştirme içindir ve açıkça etkinleştirilmelidir.
    // Aksi halde e-posta servisi olmayan bir sunucuda, kullanıcı adı + e-postayı bilen herkes
    // başkasının şifresini sıfırlayabilirdi.
    if (process.env.ALLOW_DEV_RESET_TOKEN !== '1' || process.env.NODE_ENV === 'production') {
      await supabase.from('password_reset_tokens').delete().eq('token_hash', tokenHash);
      return res.status(503).json({ error: 'Şifre sıfırlama e-posta servisi yapılandırılmamış.' });
    }

    res.json({ success: true, resetToken, devResetToken: true });
  } catch (e) {
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// Reset Password (Verify Token & Update Password)
router.post('/reset-password', validateObjectBody, async (req, res) => {
  const { resetToken, newPassword } = req.body;
  if (!resetToken || !newPassword || typeof resetToken !== 'string' || resetToken.length > 256) {
    return res.status(400).json({ error: 'Eksik bilgi girdiniz.' });
  }
  if (!isStrongEnoughPassword(newPassword)) {
    return res.status(400).json({ error: 'Yeni şifre en az 8 karakter olmalıdır.' });
  }

  try {
    const tokenHash = hashResetToken(resetToken);
    const now = new Date().toISOString();
    const { data: claimedToken, error: claimError } = await supabase
      .from('password_reset_tokens')
      .update({ used_at: now })
      .eq('token_hash', tokenHash)
      .is('used_at', null)
      .gt('expires_at', now)
      .select('id, user_id')
      .maybeSingle();
    if (claimError || !claimedToken) {
      return res.status(400).json({ error: 'Şifre sıfırlama süresi dolmuş veya geçersiz token.' });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    const { data: account } = await supabase
      .from('users')
      .select('token_version')
      .eq('id', claimedToken.user_id)
      .maybeSingle();
    // Sürüm artırılınca şifre değişmeden önce verilmiş tüm oturumlar (çalınmış olabilecek
    // token'lar dahil) geçersiz olur.
    const { error } = await supabase
      .from('users')
      .update({ password_hash, token_version: (Number(account?.token_version) || 0) + 1 })
      .eq('id', claimedToken.user_id);
    invalidateTokenVersion(claimedToken.user_id);

    if (error) {
      await supabase.from('password_reset_tokens').update({ used_at: null }).eq('id', claimedToken.id);
      return res.status(400).json({ error: 'Şifre güncellenemedi.' });
    }

    res.json({ success: true, message: 'Şifreniz başarıyla güncellendi!' });
  } catch (e) {
    res.status(400).json({ error: 'Şifre sıfırlama süresi dolmuş veya geçersiz token.' });
  }
});

export default router;


