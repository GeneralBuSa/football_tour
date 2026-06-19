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
  const [resetStep, setResetStep] = useState(1);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, text: '', color: '', width: '0%' });

  const checkPasswordStrength = (pwd) => {
    setPassword(pwd);
    if (!pwd) {
      setPasswordStrength({ score: 0, text: '', color: '', width: '0%' });
      return;
    }

    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    let text = 'Çok Zayıf';
    let color = '#ff5252';
    let width = '25%';

    if (score === 2) {
      text = 'Zayıf';
      color = '#ff7043';
      width = '40%';
    } else if (score === 3) {
      text = 'Orta';
      color = '#f5d061';
      width = '60%';
    } else if (score === 4) {
      text = 'Güçlü';
      color = '#29b6f6';
      width = '80%';
    } else if (score >= 5) {
      text = 'Çok Güçlü';
      color = '#2ecc71';
      width = '100%';
    }

    setPasswordStrength({ score, text, color, width });
  };

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

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!username || !email) {
      setError('Lütfen kullanıcı adı ve e-postanızı girin.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await apiService.forgotPassword(username, email);
      if (res && res.resetToken) {
        setResetToken(res.resetToken);
        setResetStep(2);
      } else {
        setError(res?.error || 'Doğrulama başarısız.');
      }
    } catch (err) {
      setError('Bir sunucu hatası oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword) {
      setError('Lütfen yeni şifrenizi girin.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await apiService.resetPassword(resetToken, newPassword);
      if (res && res.success) {
        setSuccessMessage('Şifreniz başarıyla güncellendi! Giriş yapabilirsiniz.');
        setTimeout(() => {
          setActiveTab('login');
          setUsername('');
          setEmail('');
          setPassword('');
          setNewPassword('');
          setResetToken('');
          setResetStep(1);
          setSuccessMessage('');
        }, 2000);
      } else {
        setError(res?.error || 'Şifre güncellenemedi.');
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
          {activeTab === 'reset' ? (
            <div className="auth-tab active" style={{ flex: 1, pointerEvents: 'none' }}>
              ŞİFREMİ UNUTTUM
            </div>
          ) : (
            <>
              <div 
                className={`auth-tab ${activeTab === 'login' ? 'active' : ''}`}
                onClick={() => { setActiveTab('login'); setError(''); setSuccessMessage(''); setPassword(''); setPasswordStrength({ score: 0, text: '', color: '', width: '0%' }); }}
              >
                GİRİŞ YAP
              </div>
              <div 
                className={`auth-tab ${activeTab === 'register' ? 'active' : ''}`}
                onClick={() => { setActiveTab('register'); setError(''); setSuccessMessage(''); setPassword(''); setPasswordStrength({ score: 0, text: '', color: '', width: '0%' }); }}
              >
                KAYIT OL
              </div>
            </>
          )}
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

        {successMessage && (
          <div style={{
            color: '#2ecc71',
            fontSize: '13px',
            marginBottom: '16px',
            textAlign: 'center',
            background: 'rgba(46, 204, 113, 0.1)',
            padding: '8px 12px',
            borderRadius: '6px',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            ✅ {successMessage}
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
          <div className="forgot-password-link" style={{ width: '100%', textAlign: 'right', marginBottom: '10px' }} onClick={() => { setActiveTab('reset'); setResetStep(1); setError(''); setSuccessMessage(''); }}>
            Şifremi Unuttum
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
              onChange={(e) => checkPasswordStrength(e.target.value)}
              disabled={loading}
            />
            {password && (
              <>
                <div className="password-strength">
                  <div className="strength-bar" style={{ width: passwordStrength.width, backgroundColor: passwordStrength.color }}></div>
                </div>
                <div className="strength-text" style={{ color: passwordStrength.color }}>
                  Şifre Gücü: {passwordStrength.text}
                </div>
              </>
            )}
          </div>
          <button type="submit" className="auth-btn btn-register" disabled={loading}>
            {loading ? 'KAYIT YAPILIYOR...' : 'KAYIT OL'}
          </button>
        </form>

        {/* Şifre Sıfırlama Formu */}
        {activeTab === 'reset' && (
          <div className="auth-form active">
            {resetStep === 1 ? (
              <form onSubmit={handleForgotPassword} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '13px', textAlign: 'center', marginBottom: '10px', lineHeight: '1.5' }}>
                  Kullanıcı adınızı ve kayıtlı e-posta adresinizi girerek şifrenizi sıfırlayabilirsiniz.
                </div>
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
                <button type="submit" className="auth-btn" disabled={loading}>
                  {loading ? 'DOĞRULANIYOR...' : 'DEVAM ET'}
                </button>
                <div className="forgot-password-link" style={{ textAlign: 'center', marginTop: '10px', display: 'block', width: '100%' }} onClick={() => { setActiveTab('login'); setError(''); }}>
                  Giriş Ekranına Dön
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ color: '#2ecc71', fontSize: '13px', textAlign: 'center', marginBottom: '10px', lineHeight: '1.5' }}>
                  Doğrulama başarılı! Lütfen yeni şifrenizi belirleyin.
                </div>
                <div className="input-group">
                  <input 
                    type="password" 
                    className="auth-input" 
                    placeholder="Yeni Şifre"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <button type="submit" className="auth-btn" disabled={loading}>
                  {loading ? 'ŞİFRE GÜNCELLENİYOR...' : 'ŞİFREYİ GÜNCELLE'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
