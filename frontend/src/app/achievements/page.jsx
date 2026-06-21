'use client';
import { useEffect, useState } from 'react';
import apiService from '../../../services/ApiService.js';
import gameService from '../../../services/GameService.js';
import tr from '../../locales/tr.json';
import en from '../../locales/en.json';

export default function Page() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ total_earnings: 2000, wins: 0 });
  const [achievements, setAchievements] = useState([]);
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
      // GameService başlatılıyor
      await gameService.init();
      
      if (logged) {
        const u = apiService.getUser();
        apiService.getStats(u.id).then(res => {
          if (res && !res.error) setStats(res);
        }).catch(console.error);
      }

      loadAchievements();
    }).catch(console.error);
  }, []);

  const loadAchievements = () => {
    try {
      setLoading(true);
      const allAch = gameService.achievement.getAll();
      setAchievements(allAch);
    } catch (e) {
      console.error("Başarımlar yüklenirken hata:", e);
    } finally {
      setLoading(false);
    }
  };

  const t = language === 'English' ? en : tr;

  return (
    <div style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.15s ease-in-out' }}>
      {/* Arka Plan Videosu */}
      <div className="main-menu-container" style={{position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', zIndex: '-1'}}>
        <video autoPlay loop muted playsInline id="bg-video" className="menu-video-bg">
          <source src="../assets/bg-video.mp4?v=2" type="video/mp4" />
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
            <div className="nav-item-icon" title={t.nav_history} onClick={() => {window.location.href='/history'}}>📜</div>
            <div className="nav-item-icon" title={t.nav_profile} onClick={() => {window.location.href='/profile'}}>👤</div>
          </div>
          <button className="btn-play-tactical" onClick={() => {window.location.href='/?play=true'}}>{t.play}</button>
          <div className="nav-icons-group right">
            <div className="nav-item-icon active" title={t.nav_achievements} onClick={() => {window.location.href='/achievements'}}>🏆</div>
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

      <div className="achievements-page-container" style={{marginTop: '80px', padding: '20px'}}>
        <div className="menu-dynamic-screen">
          <div className="dynamic-screen-header" style={{position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
            <button className="btn-mode-back" onClick={() => {window.location.href='/'}} style={{position: 'absolute', left: '0', margin: '0', padding: '6px 12px', fontSize: '12px'}}>← {t.back}</button>
            <span id="ach-header">{t.achievements_header}</span>
          </div>
          <div className="dynamic-screen-body" style={{marginTop: '20px'}}>
            {loading ? (
              <div style={{color: '#fff', textAlign: 'center', padding: '40px'}}>{t.loading}</div>
            ) : (
              <div className="achievements-list" id="ach-container" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '20px',
                padding: '10px'
              }}>
                {achievements.map(ach => {
                  const achName = t[`ach_${ach.id}_name`] || ach.name;
                  const achDesc = t[`ach_${ach.id}_desc`] || ach.desc;
                  const unlockDate = ach.unlockedAt ? new Date(ach.unlockedAt).toLocaleDateString(language === 'English' ? 'en-US' : 'tr-TR') : '';

                  return (
                    <div key={ach.id} className="achievement-card" style={{
                      background: ach.unlocked ? 'rgba(46, 204, 113, 0.15)' : 'rgba(20, 24, 33, 0.85)',
                      border: ach.unlocked ? '1px solid #2ecc71' : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '10px',
                      padding: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      color: '#fff',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                      transition: 'transform 0.2s'
                    }}>
                      <div style={{ fontSize: '36px', opacity: ach.unlocked ? 1 : 0.4 }}>
                        {ach.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ 
                          fontSize: '16px', 
                          fontWeight: 'bold', 
                          margin: '0 0 4px 0',
                          color: ach.unlocked ? '#2ecc71' : '#fff' 
                        }}>
                          {achName}
                        </h3>
                        <p style={{ fontSize: '12px', color: '#ccc', margin: 0 }}>{achDesc}</p>
                        {ach.unlocked && (
                          <span style={{ 
                            fontSize: '10px', 
                            color: '#2ecc71', 
                            display: 'block', 
                            marginTop: '6px',
                            fontWeight: '600'
                          }}>
                            {t.achievements_unlocked.replace('{date}', unlockDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
