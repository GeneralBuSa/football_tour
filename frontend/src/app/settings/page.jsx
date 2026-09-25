'use client';
import { useEffect, useState } from 'react';
import useSession from '../shared/useSession.js';
import PageShell from '../shared/PageShell.jsx';
import apiService from '../../../services/ApiService.js';
import tr from '../../locales/tr.json';
import en from '../../locales/en.json';

// Not: Sesli sohbet, ses/müzik ve avatar/emoji/ping/zoom ayarları hiçbir özelliğe bağlı
// değildi; kaldırıldı. Promosyon kodu artık sunucu tarafında doğrulanan gerçek bir akıştır
// (backend/routes/promo.js, redeem_promo_code RPC).

const cardStyle = {
  background: 'linear-gradient(145deg, rgba(20, 24, 33, 0.9) 0%, rgba(10, 12, 17, 0.95) 100%)',
  border: '1px solid rgba(41, 182, 246, 0.3)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
  borderRadius: '16px',
  padding: '24px',
  display: 'flex',
  flexDirection: 'column',
  gap: '24px'
};

const headingStyle = {
  fontSize: '15px', fontWeight: '800', marginBottom: '14px', color: '#00e5ff',
  borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px', letterSpacing: '0.5px'
};

const selectStyle = {
  background: 'rgba(0,0,0,0.5)',
  border: '1px solid rgba(41, 182, 246, 0.3)',
  color: '#fff',
  padding: '10px 14px',
  borderRadius: '8px',
  fontSize: '13px',
  minWidth: '180px',
  minHeight: '44px',
  cursor: 'pointer'
};

const footerButton = (color, rgb) => ({
  margin: '0',
  padding: '12px',
  minHeight: '44px',
  fontSize: '12px',
  fontWeight: '700',
  borderRadius: '10px',
  background: `linear-gradient(145deg, rgba(${rgb}, 0.15) 0%, rgba(${rgb}, 0.25) 100%)`,
  border: `1px solid ${color}`,
  color,
  cursor: 'pointer',
  textAlign: 'center',
  textDecoration: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
});

const CHARACTER_NAMES = { architect: 'The Architect', king: 'The King', viking: 'The Viking', rocket: 'The Rocket', wizard: 'The Wizard' };

function PromoCodeSection({ language, onBalance }) {
  const isEn = language === 'English';
  const [code, setCode] = useState('');
  const [status, setStatus] = useState({ type: '', text: '' });
  const [redeeming, setRedeeming] = useState(false);

  const handleRedeem = async (e) => {
    e.preventDefault();
    if (redeeming) return;
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z0-9-]{4,32}$/.test(normalized)) {
      setStatus({ type: 'error', text: isEn ? 'Codes are 4-32 characters: letters, numbers and dashes.' : 'Kod 4-32 karakter olmalı; harf, rakam ve tire içerebilir.' });
      return;
    }
    setRedeeming(true);
    setStatus({ type: '', text: '' });
    const res = await apiService.redeemPromoCode(normalized);
    setRedeeming(false);
    if (res?.error) {
      setStatus({ type: 'error', text: res.status === 0 ? (isEn ? 'Could not reach the server. Try again.' : 'Sunucuya ulaşılamadı. Tekrar dene.') : res.error });
      return;
    }
    const parts = [];
    if (res.coins > 0) parts.push(isEn ? `+${res.coins} coins` : `+${res.coins} coin`);
    if (res.character_key) {
      const name = CHARACTER_NAMES[res.character_key] || res.character_key;
      parts.push(res.character_already_owned
        ? (isEn ? `${name} (already owned)` : `${name} (zaten sende vardı)`)
        : (isEn ? `${name} unlocked` : `${name} karakteri açıldı`));
    }
    setStatus({ type: 'success', text: `🎁 ${res.code}: ${parts.join(' · ')}` });
    if (typeof res.balance === 'number') onBalance?.(res.balance);
    setCode('');
  };

  return (
    <form onSubmit={handleRedeem} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label htmlFor="promo-code-input" style={{ fontSize: '12px', color: '#8892b0', fontWeight: 'bold' }}>
        🎁 {isEn ? 'Promo code' : 'Promosyon kodu'}
      </label>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          id="promo-code-input"
          type="text"
          value={code}
          maxLength={32}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder={isEn ? 'e.g. WELCOME-2026' : 'Örn: HOSGELDIN-2026'}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); if (status.text) setStatus({ type: '', text: '' }); }}
          aria-invalid={status.type === 'error'}
          aria-describedby="promo-status"
          style={{ ...selectStyle, flex: 1, minWidth: 0, cursor: 'text', letterSpacing: '1px', fontWeight: 700 }}
        />
        <button type="submit" disabled={redeeming || !code.trim()} aria-busy={redeeming} style={{
          minHeight: '44px', padding: '0 16px', borderRadius: '8px', border: 'none', fontWeight: 800,
          background: 'linear-gradient(135deg, #ffb74d 0%, #f57c00 100%)', color: '#000', cursor: redeeming ? 'wait' : 'pointer'
        }}>
          {redeeming ? '…' : (isEn ? 'Redeem' : 'Kullan')}
        </button>
      </div>
      <div id="promo-status" role={status.type === 'error' ? 'alert' : 'status'} aria-live="polite"
        style={{ minHeight: '16px', fontSize: '12px', color: status.type === 'error' ? '#ff8a80' : '#69f0ae' }}>
        {status.text}
      </div>
    </form>
  );
}

function DeleteAccountSection({ language }) {
  const isEn = language === 'English';
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e) => {
    e.preventDefault();
    if (deleting) return;
    if (!password) {
      setError(isEn ? 'Enter your password to confirm.' : 'Onaylamak için şifreni gir.');
      return;
    }
    if (!confirmed) {
      setError(isEn ? 'Please confirm that you understand this cannot be undone.' : 'Bu işlemin geri alınamayacağını onaylamalısın.');
      return;
    }
    setDeleting(true);
    setError('');
    const res = await apiService.deleteAccount(password);
    setDeleting(false);
    if (res?.error) {
      setError(res.status === 0
        ? (isEn ? 'Could not reach the server. Check your connection and try again.' : 'Sunucuya ulaşılamadı. Bağlantını kontrol edip tekrar dene.')
        : res.error);
      return;
    }
    apiService.logout();
    window.location.replace('/?accountDeleted=1');
  };

  if (!open) {
    return (
      <button type="button" className="mbtn" onClick={() => setOpen(true)} style={{ width: '100%', minHeight: '44px', background: 'transparent', border: '1px solid #ff5252', color: '#ff8a80', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
        {isEn ? 'Delete account' : 'Hesabı Sil'}
      </button>
    );
  }

  return (
    <form onSubmit={handleDelete} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '10px', border: '1px solid rgba(255, 82, 82, 0.4)', borderRadius: '10px', padding: '14px', background: 'rgba(255, 82, 82, 0.06)' }}>
      <strong style={{ color: '#ff8a80' }}>{isEn ? 'Delete account permanently' : 'Hesabı kalıcı olarak sil'}</strong>
      <p style={{ fontSize: '12px', color: '#cbd5e1', margin: 0, lineHeight: 1.5 }}>
        {isEn
          ? 'Your profile, stats, coins, purchases, friends, messages and saves will be deleted. This cannot be undone.'
          : 'Profilin, istatistiklerin, coin bakiyen, satın aldıkların, arkadaşların, mesajların ve kayıtların silinir. Bu işlem geri alınamaz.'}
      </p>
      <label htmlFor="delete-password" style={{ fontSize: '12px', color: '#8892b0' }}>{isEn ? 'Current password' : 'Mevcut şifren'}</label>
      <input
        id="delete-password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => { setPassword(e.target.value); setError(''); }}
        aria-invalid={!!error}
        aria-describedby={error ? 'delete-error' : undefined}
        style={{ ...selectStyle, cursor: 'text' }}
      />
      <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px', color: '#cbd5e1', minHeight: '32px' }}>
        <input type="checkbox" checked={confirmed} onChange={(e) => { setConfirmed(e.target.checked); setError(''); }} style={{ width: '18px', height: '18px' }} />
        {isEn ? 'I understand this is permanent.' : 'Bunun kalıcı olduğunu anlıyorum.'}
      </label>
      {error && <div id="delete-error" role="alert" style={{ color: '#ff8a80', fontSize: '12px' }}>{error}</div>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="button" onClick={() => { setOpen(false); setPassword(''); setConfirmed(false); setError(''); }} style={{ flex: 1, minHeight: '44px', borderRadius: '8px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: '#ddd', fontWeight: 'bold', cursor: 'pointer' }}>
          {isEn ? 'Cancel' : 'Vazgeç'}
        </button>
        <button type="submit" disabled={deleting} aria-busy={deleting} style={{ flex: 1, minHeight: '44px', borderRadius: '8px', background: 'linear-gradient(135deg, #ff5252, #d50000)', border: 'none', color: '#fff', fontWeight: '800', cursor: deleting ? 'wait' : 'pointer' }}>
          {deleting ? (isEn ? 'Deleting…' : 'Siliniyor…') : (isEn ? 'Delete my account' : 'Hesabımı sil')}
        </button>
      </div>
    </form>
  );
}

export default function SettingsPage() {
  const { isLoggedIn, stats, setStats, language: sessionLang } = useSession();

  const [fpsLimit, setFpsLimit] = useState(60);
  const [vSync, setVSync] = useState('Kapat');
  const [language, setLanguage] = useState('Türkçe');
  const [showCreditsModal, setShowCreditsModal] = useState(false);

  useEffect(() => {
    if (sessionLang) setLanguage(sessionLang);
  }, [sessionLang]);

  useEffect(() => {
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem('ft26_settings') || '{}') || {};
    } catch {
      saved = {};
    }
    if (saved.fpsLimit !== undefined) setFpsLimit(saved.fpsLimit);
    if (saved.vSync !== undefined) setVSync(saved.vSync);
    window.ft26_settings = saved;
  }, []);

  const updateSetting = (key, val, setter) => {
    setter(val);
    let current = {};
    try {
      current = JSON.parse(localStorage.getItem('ft26_settings') || '{}') || {};
    } catch {
      current = {};
    }
    current[key] = val;
    try {
      localStorage.setItem('ft26_settings', JSON.stringify(current));
    } catch { /* depolama kapalı: ayar yalnızca bu oturumda geçerli */ }
    window.ft26_settings = current;
  };

  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    try {
      localStorage.setItem('ft26_language', newLang);
    } catch { /* yok say */ }
    document.documentElement.lang = newLang === 'English' ? 'en' : 'tr';
  };

  const handleLogout = () => {
    apiService.logout();
    window.location.replace('/');
  };

  const t = language === 'English' ? en : tr;
  const isEn = language === 'English';

  return (
    <PageShell activePage="settings" stats={stats} t={t} language={language}>
      <div className="settings-page-container" style={{display: 'flex', justifyContent: 'center'}}>
        <div className="menu-dynamic-screen" style={{width: '100%', maxWidth: '1150px'}}>
          <div className="dynamic-screen-header" style={{display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '2px solid rgba(41, 182, 246, 0.3)'}}>
            <a className="btn-mode-back" href="/" style={{margin: '0', padding: '10px 14px', fontSize: '12px', background: 'linear-gradient(135deg, rgba(41, 182, 246, 0.2), rgba(2, 136, 209, 0.3))', border: '1px solid #29b6f6', color: '#29b6f6', borderRadius: '8px', fontWeight: 'bold', textDecoration: 'none'}}>{t.back}</a>
            <h1 style={{ textShadow: '0 0 10px rgba(41, 182, 246, 0.4)', fontSize: 'inherit', margin: 0 }}>{t.settings}</h1>
          </div>
          <div className="dynamic-screen-body" style={{marginTop: '20px'}}>
            <div className="settings-grid" style={{ color: '#fff' }}>
              {/* Sol: Genel ve video */}
              <div style={cardStyle}>
                <section>
                  <h2 style={headingStyle}>{t.general_language}</h2>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', gap: '12px', flexWrap: 'wrap'}}>
                    <label htmlFor="language-select" style={{color: '#8892b0'}}>{t.ui_lang}</label>
                    <select id="language-select" value={language} onChange={(e) => handleLanguageChange(e.target.value)} style={selectStyle}>
                      <option value="Türkçe">Türkçe</option>
                      <option value="English">English</option>
                    </select>
                  </div>
                </section>

                <section>
                  <h2 style={headingStyle}>{t.video_screen}</h2>
                  <div style={{display: 'flex', flexDirection: 'column', gap: '14px'}}>
                    <button
                      type="button"
                      onClick={() => { window.toggleFullscreen?.(); }}
                      style={{
                        width: '100%', padding: '12px', minHeight: '44px', borderRadius: '10px', fontSize: '13px',
                        background: 'linear-gradient(135deg, #00e5ff 0%, #0288d1 100%)', color: '#000', border: 'none',
                        fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0, 229, 255, 0.3)'
                      }}
                    >
                      {t.fullscreen_btn}
                    </button>

                    <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
                      <legend style={{fontSize: '12px', color: '#8892b0', marginBottom: '6px', fontWeight: 'bold'}}>{t.fps_limit}</legend>
                      <div style={{display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '8px'}}>
                        {[30, 60, 120].map(f => (
                          <button key={f} type="button" aria-pressed={fpsLimit === f} onClick={() => updateSetting('fpsLimit', f, setFpsLimit)} style={{flex: 1, padding: '8px', minHeight: '40px', background: fpsLimit === f ? '#00e5ff' : 'transparent', color: fpsLimit === f ? '#000' : '#cbd5e1', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer'}}>{f} FPS</button>
                        ))}
                      </div>
                    </fieldset>

                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', gap: '12px', flexWrap: 'wrap'}}>
                      <label htmlFor="vsync-select" style={{color: '#8892b0'}}>{t.vsync}</label>
                      <select id="vsync-select" value={vSync} onChange={(e) => updateSetting('vSync', e.target.value, setVSync)} style={selectStyle}>
                        <option value="Kapat">{isEn ? 'Off' : 'Kapat'}</option>
                        <option value="Aç">{isEn ? 'On' : 'Aç'}</option>
                        <option value="1/2">1/2</option>
                      </select>
                    </div>
                  </div>
                </section>
              </div>

              {/* Sağ: Hesap */}
              <div style={cardStyle}>
                <section>
                  <h2 style={headingStyle}>{t.account_options}</h2>
                  {isLoggedIn ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <PromoCodeSection language={language} onBalance={balance => setStats(prev => ({ ...prev, total_earnings: balance }))} />
                      <button type="button" className="mbtn" onClick={handleLogout} style={{
                        width: '100%', minHeight: '44px', background: 'linear-gradient(135deg, #ff5252, #ff1744)', color: '#fff',
                        padding: '12px', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer',
                        boxShadow: '0 4px 15px rgba(255, 23, 68, 0.3)'
                      }}>
                        {t.logout_btn}
                      </button>
                      <DeleteAccountSection language={language} />
                    </div>
                  ) : (
                    <div style={{ fontSize: '13px', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <p style={{ margin: 0 }}>{isEn ? 'Log in to manage your account.' : 'Hesabını yönetmek için giriş yap.'}</p>
                      <a className="mbtn mbtn-buy" href="/auth?next=/settings" style={{ textAlign: 'center', textDecoration: 'none', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t.login_btn || 'Giriş Yap'}</a>
                    </div>
                  )}
                </section>
              </div>
            </div>

            {/* Alt Bilgi & Destek Bağlantıları */}
            <nav className="settings-footer-grid" aria-label={isEn ? 'Help and legal' : 'Yardım ve yasal'}>
              <a href="/privacy" style={footerButton('#2ecc71', '46, 204, 113')}>{t.privacy_policy}</a>
              <a href="/terms" style={footerButton('#29b6f6', '41, 182, 246')}>{t.terms_of_service}</a>
              <a href="/rules" style={footerButton('#ffb74d', '255, 183, 77')}>{t.rules}</a>
              <button type="button" onClick={() => setShowCreditsModal(true)} style={footerButton('#e1bee7', '156, 39, 176')}>
                {t.credits || 'Emeği Geçenler'}
              </button>
            </nav>
          </div>
        </div>
      </div>

      {showCreditsModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="credits-title" onKeyDown={(e) => { if (e.key === 'Escape') setShowCreditsModal(false); }}>
          <div className="modal" style={{ maxWidth: '420px', background: 'linear-gradient(145deg, #141821 0%, #0d1017 100%)', border: '1px solid #ba68c8', borderRadius: '16px', padding: '24px', color: '#fff' }}>
            <h2 id="credits-title" style={{ fontSize: '18px', fontWeight: '800', color: '#ba68c8', marginBottom: '14px', textAlign: 'center' }}>⭐ {isEn ? 'GAME CREDITS' : 'EMEĞİ GEÇENLER'}</h2>
            <div style={{ fontSize: '13px', lineHeight: '1.8', color: '#e5e2e1', textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontWeight: '800', color: '#00e5ff', fontSize: '15px' }}>FOOTBALL TOUR SIMULATOR — 3D</div>
              <p><strong>{isEn ? 'Built with' : 'Kullanılan teknolojiler'}:</strong> Next.js, React, Three.js, Express, Supabase</p>
              <p style={{ fontSize: '11px', color: '#8892b0' }}>{isEn ? 'Open-source project, MIT licensed.' : 'MIT lisanslı açık kaynak proje.'}</p>
            </div>
            <button
              type="button"
              autoFocus
              onClick={() => setShowCreditsModal(false)}
              style={{ width: '100%', padding: '10px', minHeight: '44px', borderRadius: '8px', background: 'linear-gradient(135deg, #ba68c8, #7b1fa2)', border: 'none', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}
            >
              {isEn ? 'Close' : 'Kapat'}
            </button>
          </div>
        </div>
      )}
    </PageShell>
  );
}
