import express from 'express';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { supabase } from '../db.js';
import { createAuthMiddleware, requireEnv } from '../middleware/auth.js';
import { isEmailConfigured, sendPasswordResetEmail } from '../services/email.js';
import { createRateLimiter, validateObjectBody } from '../middleware/security.js';

const router = express.Router();
const authenticate = createAuthMiddleware();
const jwtSecret = requireEnv('JWT_SECRET');
const resetAttempts = new Map();
const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });
const forgotPasswordLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });

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

function hashResetToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

// Register
router.post('/register', validateObjectBody, async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
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

    if (error) return res.status(400).json({ error: error.message });

    const token = jwt.sign({ id: data.id, username: data.username }, jwtSecret, { expiresIn: '7d' });
    
    // Create initial stats for the user
    await supabase.from('stats').insert([{ user_id: data.id, total_earnings: 2000 }]);

    res.json({ token, user: { id: data.id, username: data.username, email: data.email, avatar: data.avatar } });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', validateObjectBody, loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !data) return res.status(400).json({ error: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, data.password_hash);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: data.id, username: data.username }, jwtSecret, { expiresIn: '7d' });
    res.json({ token, user: { id: data.id, username: data.username, email: data.email, avatar: data.avatar } });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get Me
router.get('/me', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, email, avatar, created_at')
      .eq('id', req.user.id)
      .single();

    if (error) return res.status(404).json({ error: 'User not found' });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update Avatar
router.put('/avatar', authenticate, validateObjectBody, async (req, res) => {
  const { avatar } = req.body;
  if (typeof avatar !== 'string' || avatar.length > 2_000) {
    return res.status(400).json({ error: 'Avatar gereklidir' });
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .update({ avatar })
      .eq('id', req.user.id)
      .select('id, username, email, avatar')
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Forgot Password (Verify Username & Email)
router.post('/forgot-password', validateObjectBody, forgotPasswordLimiter, async (req, res) => {
  const { username, email } = req.body;
  if (!username || !email) return res.status(400).json({ error: 'Eksik bilgi girdiniz.' });
  const rateKey = `${username}:${email}:${req.ip}`;
  if (isResetRateLimited(rateKey)) {
    return res.status(429).json({ error: 'Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.' });
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, email')
      .eq('username', username)
      .eq('email', email)
      .maybeSingle();

    if (error || !data) {
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

    res.json({ success: true, resetToken, devResetToken: true });
  } catch (e) {
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// Reset Password (Verify Token & Update Password)
router.post('/reset-password', validateObjectBody, async (req, res) => {
  const { resetToken, newPassword } = req.body;
  if (!resetToken || !newPassword) return res.status(400).json({ error: 'Eksik bilgi girdiniz.' });
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
    const { error } = await supabase
      .from('users')
      .update({ password_hash })
      .eq('id', claimedToken.user_id);

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


