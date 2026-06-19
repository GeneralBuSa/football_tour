'use client';
import { useEffect, useState } from 'react';
import apiService from '../../../services/ApiService.js';
import gameService from '../../../services/GameService.js';

export default function Page() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [stats, setStats] = useState({ total_earnings: 2000, wins: 0 });
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import('../../../js/game.js').then(async () => {
      const logged = apiService.isLoggedIn();
      setIsLoggedIn(logged);
      
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

  return (
    <>
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
            <span className="logo-main">FT26</span>
          </div>
        </div>
        <div className="top-nav-center">
          <div className="nav-icons-group left">
            <div className="nav-item-icon" title="Ana Sayfa" onClick={() => {window.location.href='/'}}>🏠</div>
            <div className="nav-item-icon" title="Savaş Geçmişi" onClick={() => {window.location.href='/history'}}>📜</div>
          </div>
          <button className="btn-play-tactical" onClick={() => {window.location.href='/?play=true'}}>OYNA</button>
          <div className="nav-icons-group right">
            <div className="nav-item-icon active" title="Başarımlar" onClick={() => {window.location.href='/achievements'}}>🏆</div>
            <div className="nav-item-icon" title="Mağaza" onClick={() => {window.location.href='/store'}}>🛒</div>
          </div>
        </div>
        <div className="top-nav-right">
          <div className="user-stats">
            <div className="stat-item" title="Oyuna Giriş Parası">
              <span style={{display: "flex", alignItems: "center", justifyContent: "center", height: "100%"}}>🪙</span>
              <span style={{display: "flex", alignItems: "center", position: "relative", top: "0.5px"}}>
                ₺{(stats.total_earnings || 0).toLocaleString()}
              </span>
            </div>
            <div className="stat-item" title="Kazanılan Maçlar">
              <span style={{display: "flex", alignItems: "center", justifyContent: "center", height: "100%"}}>🏆</span>
              <span style={{display: "flex", alignItems: "center", position: "relative", top: "0.5px"}}>
                {stats.wins || 0} Galibiyet
              </span>
            </div>
            <div className="stat-item-btn" title="Ayarlar" onClick={() => {window.openSettings()}}>
              <span style={{display: "flex", alignItems: "center", justifyContent: "center"}}>⚙️</span>
            </div>
          </div>
        </div>
      </div>

      <div className="achievements-page-container" style={{marginTop: '80px', padding: '20px'}}>
        <div className="menu-dynamic-screen">
          <div className="dynamic-screen-header" style={{position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
            <button className="btn-mode-back" onClick={() => {window.location.href='/'}} style={{position: 'absolute', left: '0', margin: '0', padding: '6px 12px', fontSize: '12px'}}>← GERİ</button>
            <span id="ach-header">🏆 KULÜP BAŞARIMLARI</span>
          </div>
          <div className="dynamic-screen-body" style={{marginTop: '20px'}}>
            {loading ? (
              <div style={{color: '#fff', textAlign: 'center', padding: '40px'}}>Yükleniyor...</div>
            ) : (
              <div className="achievements-list" id="ach-container" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '20px',
                padding: '10px'
              }}>
                {achievements.map(ach => (
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
                        {ach.name}
                      </h3>
                      <p style={{ fontSize: '12px', color: '#ccc', margin: 0 }}>{ach.desc}</p>
                      {ach.unlocked && (
                        <span style={{ 
                          fontSize: '10px', 
                          color: '#2ecc71', 
                          display: 'block', 
                          marginTop: '6px',
                          fontWeight: '600'
                        }}>
                          🔓 AÇILDI ({new Date(ach.unlockedAt).toLocaleDateString('tr-TR')})
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
