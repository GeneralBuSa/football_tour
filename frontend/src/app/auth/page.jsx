'use client';
import { useState, useEffect } from 'react';
import apiService from '../../../services/ApiService.js';
import '../../../css/components/auth.css';

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (apiService.isLoggedIn()) {
      window.location.href = '/';
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Lütfen tüm alanları doldurun.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await apiService.login(username, password);
      if (res && res.token) {
        window.location.href = '/';
      } else {
        setError(res?.error || 'Giriş yapılamadı. Bilgilerinizi kontrol edin.');
      }
    } catch (err) {
      setError('Bir sunucu hatası oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!username || !email || !password) {
      setError('Lütfen tüm alanları doldurun.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await apiService.register(username, email, password);
      if (res && res.token) {
        window.location.href = '/';
      } else {
        setError(res?.error || 'Kayıt işlemi başarısız.');
      }
    } catch (err) {
      setError('Bir sunucu hatası oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Arka Plan Efekti */}
      <div className="auth-overlay"></div>

      <div className="auth-container">
        <div className="auth-logo">
          <span className="logo-main">FT26</span>
        </div>

        <div className="auth-tabs">
          <div 
            className={`auth-tab ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => { setActiveTab('login'); setError(''); }}
          >
            GİRİŞ YAP
          </div>
          <div 
            className={`auth-tab ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => { setActiveTab('register'); setError(''); }}
          >
            KAYIT OL
          </div>
        </div>

        {error && (
          <div style={{
            color: '#ff5252',
            fontSize: '13px',
            marginBottom: '16px',
            textAlign: 'center',
            background: 'rgba(255, 82, 82, 0.1)',
            padding: '8px 12px',
            borderRadius: '6px',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Giriş Formu */}
        <form className={`auth-form ${activeTab === 'login' ? 'active' : ''}`} onSubmit={handleLogin}>
          <div className="input-group">
            <input 
              type="text" 
              className="auth-input" 
              placeholder="Kullanıcı Adı"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="input-group">
            <input 
              type="password" 
              className="auth-input" 
              placeholder="Şifre"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'GİRİŞ YAPILIYOR...' : 'GİRİŞ YAP'}
          </button>
        </form>

        {/* Kayıt Formu */}
        <form className={`auth-form ${activeTab === 'register' ? 'active' : ''}`} onSubmit={handleRegister}>
          <div className="input-group">
            <input 
              type="text" 
              className="auth-input" 
              placeholder="Kullanıcı Adı"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="input-group">
            <input 
              type="email" 
              className="auth-input" 
              placeholder="E-posta Adresi"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="input-group">
            <input 
              type="password" 
              className="auth-input" 
              placeholder="Şifre"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
          <button type="submit" className="auth-btn btn-register" disabled={loading}>
            {loading ? 'KAYIT YAPILIYOR...' : 'KAYIT OL'}
          </button>
        </form>
      </div>
    </div>
  );
}
