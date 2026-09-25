'use client';
import { useState, useEffect } from 'react';
import apiService from '../../../services/ApiService.js';
import tr from '../../locales/tr.json';
import en from '../../locales/en.json';
import '../../../css/components/auth.css';
import { trackEvent } from '../../../services/analytics.js';

// Yalnızca site içi göreli yollara yönlendir (açık yönlendirme / open redirect koruması).
function safeNextPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/auth')) return null;
  return value;
}

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,24}$/;

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
  const [passwordStrengthScore, setPasswordStrengthScore] = useState(0);
  const [language, setLanguage] = useState('Türkçe');

  const checkPasswordStrength = (pwd) => {
    setPassword(pwd);
    if (!pwd) {
      setPasswordStrengthScore(0);
      return;
    }

    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    setPasswordStrengthScore(score === 0 ? 1 : score);
  };

  const [mounted, setMounted] = useState(false);

  const [nextPath, setNextPath] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = safeNextPath(params.get('next'));
    setNextPath(next);
    if (apiService.isLoggedIn()) {
      // Giriş yapmış kullanıcı giriş sayfasına geri dönmesin (history'de yer açmadan).
      window.location.replace(next || '/');
      return;
    }
    const savedLang = localStorage.getItem('ft26_language') || 'Türkçe';
    setLanguage(savedLang);

    // URL'den resetToken query parametresini oku
    // E-postadaki şifre sıfırlama linkinden gelince direkt form açılır
    const tokenFromUrl = params.get('resetToken');
    if (tokenFromUrl) {
      setResetToken(tokenFromUrl);
      setResetStep(2);
      setActiveTab('reset');
    }

    setMounted(true);
  }, []);

  const t = language === 'English' ? en : tr;

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError(t.auth_fill_all);
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await apiService.login(username.trim(), password);
      if (res && res.token) {
        trackEvent('login');
        // replace: geri tuşu kullanıcıyı tekrar giriş formuna döndürmez.
        window.location.replace(nextPath ? `/starter?next=${encodeURIComponent(nextPath)}` : '/starter');
      } else {
        setError(res?.error || (language === 'English' ? 'Failed to log in. Please check your credentials.' : 'Giriş yapılamadı. Bilgilerinizi kontrol edin.'));
      }
    } catch (err) {
      setError(language === 'English' ? 'A server error occurred.' : 'Bir sunucu hatası oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!username || !email || !password) {
      setError(t.auth_fill_all);
      return;
    }
    const isEn = language === 'English';
    if (!USERNAME_PATTERN.test(username.trim())) {
      setError(isEn ? 'Username must be 3-24 characters: letters, numbers and _ only.' : 'Kullanıcı adı 3-24 karakter olmalı; yalnızca harf, rakam ve _ içerebilir.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError(isEn ? 'Please enter a valid email address.' : 'Geçerli bir e-posta adresi girin.');
      return;
    }
    if (password.length < 8) {
      setError(isEn ? 'Password must be at least 8 characters.' : 'Şifre en az 8 karakter olmalıdır.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await apiService.register(username.trim(), email.trim(), password);
      if (res && res.token) {
        trackEvent('sign_up');
        window.location.replace(nextPath ? `/starter?next=${encodeURIComponent(nextPath)}` : '/starter');
      } else {
        setError(res?.error || (language === 'English' ? 'Registration failed.' : 'Kayıt işlemi başarısız.'));
      }
    } catch (err) {
      setError(language === 'English' ? 'A server error occurred.' : 'Bir sunucu hatası oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!username || !email) {
      setError(t.auth_forgot_fill);
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await apiService.forgotPassword(username, email);
      if (res && res.resetToken) {
        // Dev modu: Token doğrudan döner, şifre sıfırlama formuna geç
        setResetToken(res.resetToken);
        setResetStep(2);
      } else if (res && res.emailSent) {
        // Prod modu: E-posta gönderildi, kullanıcıya bilgi ver
        setSuccessMessage(
          language === 'English'
            ? 'A password reset link has been sent to your email. Please check your inbox.'
            : 'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi. Lütfen mail kutunuzu kontrol edin.'
        );
      } else {
        setError(res?.error || (language === 'English' ? 'Verification failed.' : 'Doğrulama başarısız.'));
      }
    } catch (err) {
      setError(language === 'English' ? 'A server error occurred.' : 'Bir sunucu hatası oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword) {
      setError(t.auth_reset_fill);
      return;
    }
    if (newPassword.length < 8) {
      setError(language === 'English' ? 'Password must be at least 8 characters.' : 'Şifre en az 8 karakter olmalıdır.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await apiService.resetPassword(resetToken, newPassword);
      if (res && res.success) {
        setSuccessMessage(t.auth_reset_success);
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
        setError(res?.error || (language === 'English' ? 'Failed to update password.' : 'Şifre güncellenemedi.'));
      }
    } catch (err) {
      setError(language === 'English' ? 'A server error occurred.' : 'Bir sunucu hatası oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page page-fade-in">
      {/* Arka Plan Efekti */}
      <div className="auth-overlay"></div>

      <div className="auth-container">
        <div className="auth-logo">
          <a href="/" aria-label="Ana menüye dön"><img src="/assets/logo.webp" alt="Football Tour Simulator FT26" width="80" height="80" style={{ maxHeight: '80px', width: 'auto', margin: '0 auto', display: 'block' }} /></a>
          <h1 className="sr-only">{activeTab === 'register' ? t.auth_register : activeTab === 'reset' ? 'Şifremi Unuttum' : t.auth_login}</h1>
        </div>

        <div className="auth-tabs">
          {activeTab === 'reset' ? (
            <div className="auth-tab active" style={{ flex: 1, pointerEvents: 'none' }}>
              ŞİFREMİ UNUTTUM
            </div>
          ) : (
            <>
              <button
                type="button"
                aria-pressed={activeTab === 'login'}
                className={`auth-tab ${activeTab === 'login' ? 'active' : ''}`}
                onClick={() => { setActiveTab('login'); setError(''); setSuccessMessage(''); setPassword(''); setPasswordStrengthScore(0); }}
              >
                {t.auth_login}
              </button>
              <button
                type="button"
                aria-pressed={activeTab === 'register'}
                className={`auth-tab ${activeTab === 'register' ? 'active' : ''}`}
                onClick={() => { setActiveTab('register'); setError(''); setSuccessMessage(''); setPassword(''); setPasswordStrengthScore(0); }}
              >
                {t.auth_register}
              </button>
            </>
          )}
        </div>

        {error && (
          <div id="auth-error" role="alert" style={{
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
          <div role="status" style={{
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
        <form className={`auth-form ${activeTab === 'login' ? 'active' : ''}`} onSubmit={handleLogin} noValidate>
          <div className="input-group">
            <input
              type="text"
              className="auth-input"
              placeholder={t.auth_username}
              aria-label={t.auth_username}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={24}
              aria-invalid={!!error}
              aria-describedby={error ? 'auth-error' : undefined}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="input-group">
            <input
              type="password"
              className="auth-input"
              placeholder={t.auth_password}
              aria-label={t.auth_password}
              autoComplete="current-password"
              maxLength={128}
              aria-invalid={!!error}
              aria-describedby={error ? 'auth-error' : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
          <button type="button" className="forgot-password-link" style={{ width: '100%', textAlign: 'right', marginBottom: '10px', background: 'none', border: 'none', padding: '8px 0', font: 'inherit', cursor: 'pointer' }} onClick={() => { setActiveTab('reset'); setResetStep(1); setError(''); setSuccessMessage(''); }}>
            {t.auth_forgot_link}
          </button>
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? t.auth_logging_in : t.auth_login}
          </button>
        </form>

        {/* Kayıt Formu */}
        <form className={`auth-form ${activeTab === 'register' ? 'active' : ''}`} onSubmit={handleRegister} noValidate>
          <div className="input-group">
            <input
              type="text"
              className="auth-input"
              placeholder={t.auth_username}
              aria-label={t.auth_username}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={24}
              aria-invalid={!!error}
              aria-describedby={error ? 'auth-error' : undefined}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="input-group">
            <input
              type="email"
              inputMode="email"
              className="auth-input"
              placeholder={t.auth_email}
              aria-label={t.auth_email}
              autoComplete="email"
              autoCapitalize="none"
              maxLength={320}
              aria-invalid={!!error}
              aria-describedby={error ? 'auth-error' : undefined}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="input-group">
            <input
              type="password"
              className="auth-input"
              placeholder={t.auth_password}
              aria-label={t.auth_password}
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              aria-invalid={!!error}
              aria-describedby={error ? 'auth-error' : 'password-strength-text'}
              value={password}
              onChange={(e) => checkPasswordStrength(e.target.value)}
              disabled={loading}
            />
            {password && (() => {
              let strengthText = '';
              let strengthColor = '';
              let strengthWidth = '0%';

              if (passwordStrengthScore === 1) {
                strengthText = t.auth_pwd_very_weak;
                strengthColor = '#ff5252';
                strengthWidth = '25%';
              } else if (passwordStrengthScore === 2) {
                strengthText = t.auth_pwd_weak;
                strengthColor = '#ff7043';
                strengthWidth = '40%';
              } else if (passwordStrengthScore === 3) {
                strengthText = t.auth_pwd_medium;
                strengthColor = '#f5d061';
                strengthWidth = '60%';
              } else if (passwordStrengthScore === 4) {
                strengthText = t.auth_pwd_strong;
                strengthColor = '#29b6f6';
                strengthWidth = '80%';
              } else if (passwordStrengthScore >= 5) {
                strengthText = t.auth_pwd_very_strong;
                strengthColor = '#2ecc71';
                strengthWidth = '100%';
              } else {
                strengthText = t.auth_pwd_very_weak;
                strengthColor = '#ff5252';
                strengthWidth = '25%';
              }

              return (
                <>
                  <div className="password-strength">
                    <div className="strength-bar" style={{ width: strengthWidth, backgroundColor: strengthColor }}></div>
                  </div>
                  <div className="strength-text" id="password-strength-text" aria-live="polite" style={{ color: strengthColor }}>
                    {t.auth_pwd_strength}{strengthText}
                  </div>
                </>
              );
            })()}
          </div>
          <button type="submit" className="auth-btn btn-register" disabled={loading}>
            {loading ? t.auth_registering : t.auth_register}
          </button>
        </form>

        {/* Şifre Sıfırlama Formu */}
        {activeTab === 'reset' && (
          <div className="auth-form active">
            {resetStep === 1 ? (
              <form onSubmit={handleForgotPassword} noValidate style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '13px', textAlign: 'center', marginBottom: '10px', lineHeight: '1.5' }}>
                  {t.auth_forgot_desc}
                </div>
                <div className="input-group">
                  <input
                    type="text"
                    className="auth-input"
                    placeholder={t.auth_username}
                    aria-label={t.auth_username}
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={24}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="input-group">
                  <input
                    type="email"
                    inputMode="email"
                    className="auth-input"
                    placeholder={t.auth_email}
                    aria-label={t.auth_email}
                    autoComplete="email"
                    autoCapitalize="none"
                    maxLength={320}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <button type="submit" className="auth-btn" disabled={loading}>
                  {loading ? t.auth_verifying : (language === 'English' ? 'CONTINUE' : 'DEVAM ET')}
                </button>
                <button type="button" className="forgot-password-link" style={{ textAlign: 'center', marginTop: '10px', display: 'block', width: '100%', background: 'none', border: 'none', padding: '8px 0', font: 'inherit', cursor: 'pointer' }} onClick={() => { setActiveTab('login'); setError(''); }}>
                  {t.auth_back_to_login}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} noValidate style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ color: '#2ecc71', fontSize: '13px', textAlign: 'center', marginBottom: '10px', lineHeight: '1.5' }}>
                  {t.auth_forgot_success}
                </div>
                <div className="input-group">
                  <input
                    type="password"
                    className="auth-input"
                    placeholder={t.auth_new_password}
                    aria-label={t.auth_new_password}
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <button type="submit" className="auth-btn" disabled={loading}>
                  {loading ? t.auth_resetting : t.auth_confirm}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

