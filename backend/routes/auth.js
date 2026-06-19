import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../db.js';

const router = express.Router();

// Middleware to extract token and get user
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid token' });
    req.user = decoded;
    next();
  });
};

// Register
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'Missing fields' });

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

    const token = jwt.sign({ id: data.id, username: data.username }, process.env.JWT_SECRET || 'secret');
    
    // Create initial stats for the user
    await supabase.from('stats').insert([{ user_id: data.id }]);

    res.json({ token, user: { id: data.id, username: data.username, email: data.email } });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
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

    const token = jwt.sign({ id: data.id, username: data.username }, process.env.JWT_SECRET || 'secret');
    res.json({ token, user: { id: data.id, username: data.username, email: data.email } });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get Me
router.get('/me', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, email, created_at')
      .eq('id', req.user.id)
      .single();

    if (error) return res.status(404).json({ error: 'User not found' });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Forgot Password (Verify Username & Email)
router.post('/forgot-password', async (req, res) => {
  const { username, email } = req.body;
  if (!username || !email) return res.status(400).json({ error: 'Eksik bilgi girdiniz.' });

  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, email')
      .eq('username', username)
      .eq('email', email)
      .maybeSingle();

    if (error || !data) {
      return res.status(400).json({ error: 'Kullanıcı adı ve e-posta eşleşmedi!' });
    }

    // 15 dakikalık geçici şifre sıfırlama token'ı oluştur
    const resetToken = jwt.sign(
      { id: data.id, purpose: 'password-reset' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '15m' }
    );

    res.json({ success: true, resetToken });
  } catch (e) {
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// Reset Password (Verify Token & Update Password)
router.post('/reset-password', async (req, res) => {
  const { resetToken, newPassword } = req.body;
  if (!resetToken || !newPassword) return res.status(400).json({ error: 'Eksik bilgi girdiniz.' });

  try {
    // Token doğrula
    const decoded = jwt.verify(resetToken, process.env.JWT_SECRET || 'secret');
    if (decoded.purpose !== 'password-reset') {
      return res.status(400).json({ error: 'Geçersiz şifre sıfırlama talebi.' });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    const { error } = await supabase
      .from('users')
      .update({ password_hash })
      .eq('id', decoded.id);

    if (error) return res.status(400).json({ error: 'Şifre güncellenemedi.' });

    res.json({ success: true, message: 'Şifreniz başarıyla güncellendi!' });
  } catch (e) {
    res.status(400).json({ error: 'Şifre sıfırlama süresi dolmuş veya geçersiz token.' });
  }
});

export default router;
