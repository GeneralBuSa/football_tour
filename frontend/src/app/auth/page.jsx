'use client';
import { useState, useEffect } from 'react';
import apiService from '../../../services/ApiService.js';
import tr from '../../locales/tr.json';
import en from '../../locales/en.json';
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

  useEffect(() => {
    if (apiService.isLoggedIn()) {
      window.location.href = '/';
    }
    const savedLang = localStorage.getItem('ft26_language') || 'Türkçe';
    setLanguage(savedLang);
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
      const res = await apiService.login(username, password);
      if (res && res.token) {
        window.location.href = '/';
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

    try {
      setLoading(true);
      setError('');
      const res = await apiService.register(username, email, password);
      if (res && res.token) {
        window.location.href = '/';
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
        setResetToken(res.resetToken);
        setResetStep(2);
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
    <div className="auth-page" style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.15s ease-in-out' }}>
      {/* Arka Plan Efekti */}
      <div className="auth-overlay"></div>

      <div className="auth-container">
        <div className="auth-logo">
          <img src="/assets/logo.png" alt="FT26 Logo" style={{ maxHeight: '80px', margin: '0 auto', display: 'block' }} />
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
                onClick={() => { setActiveTab('login'); setError(''); setSuccessMessage(''); setPassword(''); setPasswordStrengthScore(0); }}
              >
                {t.auth_login}
              </div>
              <div 
                className={`auth-tab ${activeTab === 'register' ? 'active' : ''}`}
                onClick={() => { setActiveTab('register'); setError(''); setSuccessMessage(''); setPassword(''); setPasswordStrengthScore(0); }}
              >
                {t.auth_register}
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
              placeholder={t.auth_username}
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="forgot-password-link" style={{ width: '100%', textAlign: 'right', marginBottom: '10px' }} onClick={() => { setActiveTab('reset'); setResetStep(1); setError(''); setSuccessMessage(''); }}>
            {t.auth_forgot_link}
          </div>
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? t.auth_logging_in : t.auth_login}
          </button>
        </form>

        {/* Kayıt Formu */}
        <form className={`auth-form ${activeTab === 'register' ? 'active' : ''}`} onSubmit={handleRegister}>
          <div className="input-group">
            <input 
              type="text" 
              className="auth-input" 
              placeholder={t.auth_username}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="input-group">
            <input 
              type="email" 
              className="auth-input" 
              placeholder={t.auth_email}
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
                  <div className="strength-text" style={{ color: strengthColor }}>
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
              <form onSubmit={handleForgotPassword} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '13px', textAlign: 'center', marginBottom: '10px', lineHeight: '1.5' }}>
                  {t.auth_forgot_desc}
                </div>
                <div className="input-group">
                  <input 
                    type="text" 
                    className="auth-input" 
                    placeholder={t.auth_username}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="input-group">
                  <input 
                    type="email" 
                    className="auth-input" 
                    placeholder={t.auth_email}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <button type="submit" className="auth-btn" disabled={loading}>
                  {loading ? t.auth_verifying : (language === 'English' ? 'CONTINUE' : 'DEVAM ET')}
                </button>
                <div className="forgot-password-link" style={{ textAlign: 'center', marginTop: '10px', display: 'block', width: '100%' }} onClick={() => { setActiveTab('login'); setError(''); }}>
                  {t.auth_back_to_login}
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ color: '#2ecc71', fontSize: '13px', textAlign: 'center', marginBottom: '10px', lineHeight: '1.5' }}>
                  {t.auth_forgot_success}
                </div>
                <div className="input-group">
                  <input 
                    type="password" 
                    className="auth-input" 
                    placeholder={t.auth_new_password}
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
    </div>
  );
}
