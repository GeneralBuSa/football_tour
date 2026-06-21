'use client';
import { useEffect, useState } from 'react';
import apiService from '../../../services/ApiService.js';
import tr from '../../locales/tr.json';
import en from '../../locales/en.json';

export default function Page() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ total_earnings: 2000, wins: 0 });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState('Türkçe');

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // 1. Client-side durumları hemen yükle (Dil ve giriş durumu)
    const logged = apiService.isLoggedIn();
    setIsLoggedIn(logged);

    const savedLang = localStorage.getItem('ft26_language') || 'Türkçe';
    setLanguage(savedLang);
    
    if (logged) {
      const u = apiService.getUser();
      setUser(u);
    }
    setMounted(true);

    // 2. game.js dinamik modülünü ve ek verileri arka planda yükle
    import('../../../js/game.js').then(async () => {
      if (logged) {
        const u = apiService.getUser();
        apiService.getStats(u.id).then(res => {
          if (res && !res.error) setStats(res);
        }).catch(console.error);

        apiService.getGameHistory(u.id).then(res => {
          if (Array.isArray(res)) {
            setHistory(res);
          }
        }).catch(console.error);
      }
      setLoading(false);
    }).catch(console.error);
  }, []);

  const t = language === 'English' ? en : tr;

  return (
    <div style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.15s ease-in-out' }}>
      {/* Arka Plan Videosu */}
      <div className="main-menu-container" style={{position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', zIndex: '-1'}}>
        <video autoPlay loop muted playsInline id="bg-video" className="menu-video-bg">
          <source src="assets/bg-video.mp4?v=2" type="video/mp4" />
        </video>
        <div className="menu-overlay"></div>
      </div>

      {/* Üst Navigasyon Barı */}
      <div className="menu-top-nav" style={{position: 'fixed', top: '0', left: '0', width: '100%', zIndex: '10'}}>
        <div className="top-nav-left">
          <div className="menu-logo" onClick={() => {window.location.href='/'}} style={{cursor: 'pointer'}}>
            <img src="/assets/logo.png" alt="FT26 Logo" className="logo-img" />
          </div>
        </div>
        <div className="top-nav-center">
          <div className="nav-icons-group left">
            <div className="nav-item-icon" title={t.nav_home} onClick={() => {window.location.href='/'}}>🏠</div>
            <div className="nav-item-icon active" title={t.nav_history} onClick={() => {window.location.href='/history'}}>📜</div>
            <div className="nav-item-icon" title={t.nav_profile} onClick={() => {window.location.href='/profile'}}>👤</div>
          </div>
          <button className="btn-play-tactical" onClick={() => {window.location.href='/?play=true'}}>{t.play}</button>
          <div className="nav-icons-group right">
            <div className="nav-item-icon" title={t.nav_achievements} onClick={() => {window.location.href='/achievements'}}>🏆</div>
            <div className="nav-item-icon" title={t.nav_store} onClick={() => {window.location.href='/store'}}>🛒</div>
            <div className="nav-item-icon" title={t.nav_settings} onClick={() => {window.location.href='/settings'}}>⚙️</div>
          </div>
        </div>
        <div className="top-nav-right">
          <div className="user-stats">
            <div className="stat-item" title={t.earnings}>
              <span style={{display: "flex", alignItems: "center", justifyContent: "center", height: "100%"}}>🪙</span>
              <span style={{display: "flex", alignItems: "center", position: "relative", top: "0.5px"}}>
                ₺{(stats.total_earnings || 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="history-page-container" style={{marginTop: '80px', padding: '20px'}}>
        <div className="menu-dynamic-screen">
          <div className="dynamic-screen-header" style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
            <button className="btn-mode-back" onClick={() => {window.location.href='/'}} style={{margin: '0', padding: '6px 12px', fontSize: '12px'}}>← {t.back}</button>
            <span>📜 {t.history_title.toUpperCase()}</span>
          </div>
          <div className="dynamic-screen-body" style={{marginTop: '20px'}}>
            {loading ? (
              <div style={{color: '#fff', textAlign: 'center', padding: '40px'}}>{t.loading}</div>
            ) : !isLoggedIn ? (
              <div style={{color: '#aaa', textAlign: 'center', padding: '40px'}}>{t.history_login_required}</div>
            ) : (
              <div className="history-list" id="history-container" style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                padding: '10px'
              }}>
                {history.length === 0 ? (
                  <div style={{color: '#aaa', textAlign: 'center', padding: '20px'}}>{t.history_empty}</div>
                ) : (
                  history.map((game, idx) => {
                    const players = game.result_data?.players || [];
                    const winner = [...players].sort((a, b) => b.money - a.money)[0];
                    const playDate = new Date(game.played_at).toLocaleString(language === 'English' ? 'en-US' : 'tr-TR');

                    return (
                      <div key={game.id || idx} className="history-card" style={{
                        background: 'rgba(20, 24, 33, 0.85)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '10px',
                        padding: '20px',
                        color: '#fff',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                      }}>
                        <div style={{display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px', marginBottom: '12px'}}>
                          <span style={{color: '#29b6f6', fontWeight: 'bold'}}>🎮 {t.history_match_no.replace('{no}', history.length - idx)}</span>
                          <span style={{fontSize: '12px', color: '#aaa'}}>{playDate}</span>
                        </div>
                        <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                          {players.map((p, pIdx) => {
                            const isWinner = winner && winner.name === p.name;
                            return (
                              <div key={pIdx} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px'}}>
                                <span style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                  <span>{p.avatar || '👤'}</span>
                                  <span style={{fontWeight: isWinner ? 'bold' : 'normal', color: isWinner ? '#2ecc71' : '#fff'}}>
                                    {p.name} {isWinner ? '🏆' : ''}
                                  </span>
                                </span>
                                <span style={{fontWeight: 'bold', color: isWinner ? '#2ecc71' : '#aaa'}}>
                                  ₺{p.money.toLocaleString()}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
