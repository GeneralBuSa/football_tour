'use client';
import { useEffect, useState } from 'react';
import apiService from '../../../services/ApiService.js';
import tr from '../../locales/tr.json';
import en from '../../locales/en.json';

export default function BattlePassPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ total_earnings: 2000, wins: 0, xp: 0 });
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState('Türkçe');

  // Battle Pass ödül tanımları (10 Seviye)
  const LEVELS = [
    { level: 1, xpRequired: 0, rewardName: 'Başlangıç Paket Coini', rewardIcon: '🪙', rewardDesc: '+500 Coin' },
    { level: 2, xpRequired: 1000, rewardName: 'Standart Sürpriz Kutu', rewardIcon: '📦', rewardDesc: '1x Kutu' },
    { level: 3, xpRequired: 2500, rewardName: 'Bronz Taraftar Rozeti', rewardIcon: '🏅', rewardDesc: 'Profil Rozeti' },
    { level: 4, xpRequired: 4500, rewardName: 'Gümüş Krampon Efekti', rewardIcon: '⚡', rewardDesc: 'Görsel Efekt' },
    { level: 5, xpRequired: 7000, rewardName: 'Altın Kutu Paketi', rewardIcon: '🎁', rewardDesc: '1x Altın Kutu' },
    { level: 6, xpRequired: 10000, rewardName: 'Efsanevi Stadyum Görünümü', rewardIcon: '🏟️', rewardDesc: 'Kozmetik Tema' },
    { level: 7, xpRequired: 14000, rewardName: 'Altın Piyon Seçeneği', rewardIcon: '♟️', rewardDesc: 'Özel Piyon' },
    { level: 8, xpRequired: 19000, rewardName: 'Elmas Zar Kaplaması', rewardIcon: '🎲', rewardDesc: 'Özel Zar' },
    { level: 9, xpRequired: 25000, rewardName: 'Zengin Kulüp Unvanı', rewardIcon: '👑', rewardDesc: 'Sohbet Unvanı' },
    { level: 10, xpRequired: 32000, rewardName: 'FT26 Kurucu Kupası', rewardIcon: '🏆', rewardDesc: 'VIP Profil Çerçevesi' }
  ];

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
          if (res && !res.error) {
            setStats({
              total_earnings: res.total_earnings || 2000,
              wins: res.wins || 0,
              xp: res.xp || 0
            });
          }
        }).catch(console.error);
      }
      setLoading(false);
    }).catch(console.error);
  }, []);

  // Mevcut seviyeyi hesapla
  const currentXp = stats.xp || 0;
  let currentLevel = 1;
  let nextLevelXp = LEVELS[1].xpRequired;

  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (currentXp >= LEVELS[i].xpRequired) {
      currentLevel = LEVELS[i].level;
      nextLevelXp = i < LEVELS.length - 1 ? LEVELS[i + 1].xpRequired : LEVELS[i].xpRequired;
      break;
    }
  }

  // İlerleme yüzdesi
  const prevLevelXp = LEVELS[currentLevel - 1]?.xpRequired || 0;
  const xpInCurrentLevel = currentXp - prevLevelXp;
  const xpNeededForNext = nextLevelXp - prevLevelXp;
  const progressPercent = xpNeededForNext > 0 ? Math.min(100, (xpInCurrentLevel / xpNeededForNext) * 100) : 100;

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
            <div className="stat-item" title={t.current_xp || (language === 'English' ? 'Current XP' : 'Mevcut XP')}>
              <span style={{display: "flex", alignItems: "center", justifyContent: "center", height: "100%"}}>⚡</span>
              <span style={{display: "flex", alignItems: "center", position: "relative", top: "0.5px"}}>
                {t.xp_display.replace('{xp}', currentXp).replace('{level}', currentLevel)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="battlepass-page-container" style={{marginTop: '80px', padding: '20px'}}>
        <div className="menu-dynamic-screen">
          <div className="dynamic-screen-header" style={{position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
            <button className="btn-mode-back" onClick={() => {window.location.href='/'}} style={{position: 'absolute', left: '0', margin: '0', padding: '6px 12px', fontSize: '12px'}}>← {t.back}</button>
            <span id="bp-header">{t.bp_header}</span>
          </div>

          <div className="dynamic-screen-body" style={{marginTop: '20px'}}>
            {loading ? (
              <div style={{color: '#fff', textAlign: 'center', padding: '40px'}}>{t.loading}</div>
            ) : !isLoggedIn ? (
              <div style={{color: '#aaa', textAlign: 'center', padding: '40px'}}>{t.bp_login_required}</div>
            ) : (
              <div style={{display: 'flex', flexDirection: 'column', gap: '24px'}}>
                {/* Seviye İlerleme Kartı */}
                <div className="bp-progress-card" style={{
                  background: 'rgba(20, 24, 33, 0.85)',
                  border: '1px solid rgba(41, 182, 246, 0.3)',
                  borderRadius: '12px',
                  padding: '24px',
                  color: '#fff',
                  boxShadow: '0 4px 25px rgba(41, 182, 246, 0.15)'
                }}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
                    <div>
                      <span style={{fontSize: '24px', fontWeight: 'bold', color: '#29b6f6'}}>{t.level_display.replace('{level}', currentLevel).toUpperCase()}</span>
                      <span style={{fontSize: '14px', color: '#aaa', marginLeft: '12px'}}>{t.bp_total_xp.replace('{xp}', currentXp)}</span>
                    </div>
                    {currentLevel < 10 ? (
                      <span style={{fontSize: '13px', color: '#aaa'}}>{t.bp_next_level.replace('{xp}', nextLevelXp).replace('{remaining}', nextLevelXp - currentXp)}</span>
                    ) : (
                      <span style={{fontSize: '13px', color: '#2ecc71', fontWeight: 'bold'}}>{t.bp_max_level}</span>
                    )}
                  </div>
                  {/* Progress Bar */}
                  <div style={{
                    width: '100%',
                    height: '10px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '5px',
                    overflow: 'hidden',
                    marginBottom: '8px'
                  }}>
                    <div style={{
                      width: `${progressPercent}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #29b6f6, #0288d1)',
                      boxShadow: '0 0 10px rgba(41, 182, 246, 0.5)',
                      borderRadius: '5px',
                      transition: 'width 0.4s ease'
                    }}></div>
                  </div>
                </div>

                {/* Ödüller Yolu (Level List) */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  maxHeight: '450px',
                  overflowY: 'auto',
                  paddingRight: '6px'
                }}>
                  {LEVELS.map(lvl => {
                    const isUnlocked = currentXp >= lvl.xpRequired;
                    const rewardName = t[`bp_lvl_${lvl.level}_name`] || lvl.rewardName;
                    const rewardDesc = t[`bp_lvl_${lvl.level}_desc`] || lvl.rewardDesc;

                    return (
                      <div key={lvl.level} className="bp-level-row" style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: isUnlocked ? 'rgba(46, 204, 113, 0.1)' : 'rgba(20, 24, 33, 0.7)',
                        border: isUnlocked ? '1px solid rgba(46, 204, 113, 0.3)' : '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '8px',
                        padding: '16px',
                        color: '#fff',
                        transition: 'all 0.2s'
                      }}>
                        <div style={{display: 'flex', alignItems: 'center', gap: '20px'}}>
                          <div style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '50%',
                            background: isUnlocked ? '#2ecc71' : 'rgba(255,255,255,0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold',
                            fontSize: '16px',
                            color: isUnlocked ? '#000' : '#888'
                          }}>
                            {lvl.level}
                          </div>
                          <div>
                            <h4 style={{margin: '0 0 4px 0', fontSize: '15px', fontWeight: 'bold', color: isUnlocked ? '#2ecc71' : '#fff'}}>
                              {rewardName}
                            </h4>
                            <span style={{fontSize: '12px', color: '#aaa'}}>{rewardDesc}</span>
                          </div>
                        </div>

                        <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
                          <div style={{fontSize: '28px'}}>{lvl.rewardIcon}</div>
                          <div style={{
                            fontSize: '11px',
                            fontWeight: '600',
                            background: isUnlocked ? 'rgba(46,204,113,0.2)' : 'rgba(255,255,255,0.05)',
                            color: isUnlocked ? '#2ecc71' : '#aaa',
                            padding: '4px 10px',
                            borderRadius: '12px'
                          }}>
                            {isUnlocked ? t.bp_reward_unlocked : t.bp_level_xp.replace('{xp}', lvl.xpRequired)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
