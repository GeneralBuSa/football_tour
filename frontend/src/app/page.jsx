'use client';
import { useEffect, useState } from 'react';
import apiService from '../../services/ApiService.js';
import '../../css/style.css';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ total_earnings: 2000, wins: 0 });
  const [friends, setFriends] = useState([]);
  const [loadingClass, setLoadingClass] = useState('loading-transition-overlay');

  useEffect(() => {
    // Sayfa açılışında yükleme ekranını 100ms sonra hızlıca kaldır
    const fadeTimer = setTimeout(() => {
      setLoadingClass('loading-transition-overlay fade-out');
    }, 100);

    // Global sayfa geçiş tetikleyicisi (hızlı geçiş için 100ms)
    window.triggerPageTransition = (callback) => {
      setLoadingClass('loading-transition-overlay');
      setTimeout(callback, 100);
    };

    // Dinamik olarak game.js yüklenir ve window objesine fonksiyonlar bağlanır
    import('../../js/game.js').then(() => {
      const logged = apiService.isLoggedIn();
      setIsLoggedIn(logged);
      if (logged) {
        const u = apiService.getUser();
        setUser(u);
        apiService.getStats(u.id).then(res => {
          if (res && !res.error) setStats(res);
        }).catch(console.error);

        // Arkadaşları çek
        apiService.getFriends().then(res => {
          if (Array.isArray(res)) setFriends(res);
        }).catch(console.error);
      }
    }).catch(console.error);

    return () => clearTimeout(fadeTimer);
  }, []);

  const handleLogout = () => {
    apiService.logout();
    window.location.reload();
  };

  return (
    <>
      <div className={loadingClass}>
        <div className="loading-content">
          <img src="assets/logo.png" alt="FT26" className="loading-logo" />
          <div className="loading-bar-container">
            <div className="loading-bar-progress"></div>
          </div>
          <div className="loading-text">FT26 YÜKLENİYOR...</div>
        </div>
      </div>

      <h2 className="sr-only">Football Tour Simulator — 3D İzometrik Masa Oyunu</h2>

  {/* ANA MENÜ / KARŞILAMA EKRANI (VALORANT TARZI) */}
  <div id="main-menu" className="main-menu-container">
    <video autoPlay loop muted playsInline id="bg-video" className="menu-video-bg">
      <source src="assets/bg-video.mp4?v=2" type="video/mp4" />
    </video>
    <div className="menu-overlay"></div>

    {/* Üst Navigasyon Barı */}
    <div className="menu-top-nav">
      <div className="top-nav-left">
        <div className="menu-logo">
          <img src="assets/logo.png" alt="FT26 Logo" className="logo-img" />
        </div>
      </div>
      <div className="top-nav-center">
        <div className="nav-icons-group left">
          <div className="nav-item-icon" title="Ana Sayfa" onClick={() => {window.showHome()}}>🏠</div>
          <div className="nav-item-icon" title="Savaş Geçmişi" onClick={() => {window.showMatchHistory()}}>📜</div>
        </div>
        <button className="btn-play-tactical" onClick={() => {window.showGameModeSelection()}}>OYNA</button>
        <div className="nav-icons-group right">
          <div className="nav-item-icon" title="Başarımlar" onClick={() => {window.showAchievements()}}>🏆</div>
          <div className="nav-item-icon" title="Mağaza" onClick={() => {window.showStore()}}>🛒</div>
        </div>
      </div>
      <div className="top-nav-right">
        {isLoggedIn ? (
          <div className="user-stats" style={{ gap: '10px' }}>
            <div className="stat-item" title="Kullanıcı Adı" style={{ fontSize: '12px', fontWeight: '600', color: '#29b6f6' }}>
              👤 {user?.username}
            </div>
            <div className="stat-item" title="Oyuna Giriş Parası">
              <span style={{display: "flex", alignItems: "center", justifyContent: "center", height: "100%"}}>🪙</span>
              <span style={{display: "flex", alignItems: "center", position: "relative", top: "0.5px"}}>₺{(stats.total_earnings || 0).toLocaleString()}</span>
            </div>
            <div className="stat-item" title="Kazanılan Maçlar">
              <span style={{display: "flex", alignItems: "center", justifyContent: "center", height: "100%"}}>🏆</span>
              <span style={{display: "flex", alignItems: "center", position: "relative", top: "0.5px"}}>{stats.wins || 0} Galibiyet</span>
            </div>
            <button className="btn-mode-back" onClick={handleLogout} style={{
              margin: '0', 
              padding: '6px 12px', 
              fontSize: '11px', 
              background: 'linear-gradient(to bottom, #ef5350, #d32f2f)', 
              boxShadow: '0 2px 0 #b71c1c'
            }}>
              ÇIKIŞ
            </button>
            <div className="stat-item-btn" title="Ayarlar" onClick={() => {window.openSettings()}}>
              <span style={{display: "flex", alignItems: "center", justifyContent: "center"}}>⚙️</span>
            </div>
          </div>
        ) : (
          <button className="btn-play-tactical" onClick={() => {window.location.href='/auth'}} style={{ padding: '8px 16px', fontSize: '13px' }}>
            GİRİŞ YAP
          </button>
        )}
      </div>
    </div>

    {/* Sol Duyuru Kartları */}
    <div className="menu-left-cards" id="menu-left-cards">
      <div className="news-cards-track">
        <div className="news-card big-card">
          <div className="news-img" style={{backgroundImage: "url('assets/messi.png')"}}></div>
          <div className="news-content-overlay">
            <div className="news-tag">HAFTANIN MAÇI</div>
            <h2 className="news-title">EFSANELER DÜELLOSU</h2>
            <p className="news-desc">Messi vs Ronaldo | Dev derbi bu akşam 20:00'da.</p>
          </div>
        </div>
        <div className="news-card small-card">
          <div className="news-img" style={{backgroundImage: "url('assets/haaland.png')"}}></div>
          <div className="news-content-overlay">
            <h3 className="news-title-small">YAMA NOTLARI (1.02)</h3>
            <p className="news-desc-small">3D Stadyum performansı ve denge ayarlamaları.</p>
          </div>
        </div>
        {/* Kesintisiz döngü için kartların kopyası */}
        <div className="news-card big-card">
          <div className="news-img" style={{backgroundImage: "url('assets/messi.png')"}}></div>
          <div className="news-content-overlay">
            <div className="news-tag">HAFTANIN MAÇI</div>
            <h2 className="news-title">EFSANELER DÜELLOSU</h2>
            <p className="news-desc">Messi vs Ronaldo | Dev derbi bu akşam 20:00'da.</p>
          </div>
        </div>
        <div className="news-card small-card">
          <div className="news-img" style={{backgroundImage: "url('assets/haaland.png')"}}></div>
          <div className="news-content-overlay">
            <h3 className="news-title-small">YAMA NOTLARI (1.02)</h3>
            <p className="news-desc-small">3D Stadyum performansı ve denge ayarlamaları.</p>
          </div>
        </div>
      </div>
    </div>

    {/* Dinamik Ekran Alanı (Profil, Battle Pass, Mağaza için) */}
    <div id="dynamic-screen-container" className="menu-dynamic-screen" style={{display: 'none'}}></div>

    {/* Oyun Modu Seçim Ekranı */}
    <div id="game-mode-screen" className="game-mode-container" style={{display: 'none'}}>
      <div className="mode-screen-header">
        <button className="btn-mode-back" onClick={() => {window.hideGameModeSelection()}}>← GERİ</button>
        <h1 className="mode-screen-title">OYUN MODU SEÇİN</h1>
      </div>
      <div className="mode-cards-wrapper">
        {/* Derecesiz Kartı */}
        <div className="mode-card" onClick={() => {window.playLocalGame()}}>
          <div className="mode-card-glow"></div>
          <div className="mode-card-content">
            <span className="mode-tag">STANDART</span>
            <h2 className="mode-title">DERECESİZ</h2>
            <p className="mode-desc">Yerel olarak arkadaşlarınızla veya botlarla oynayın. Eğlencenin tadını çıkarın.</p>
            <div className="mode-action-btn">OYNA</div>
          </div>
        </div>

        {/* Özel Oyun Kartı */}
        <div className="mode-card" onClick={() => {window.showOnlineLobby()}}>
          <div className="mode-card-glow"></div>
          <div className="mode-card-content">
            <span className="mode-tag custom">LOBİ</span>
            <h2 className="mode-title">ÖZEL OYUN</h2>
            <p className="mode-desc">Kuralları kendiniz belirleyin. Arkadaşlarınızı davet edin ve kendi turnuvanızı kurun.
            </p>
            <div className="mode-action-btn">OYNA</div>
          </div>
        </div>
      </div>
    </div>

    {/* Sağ Sosyal Panel (VALORANT TARZI) */}
    <div id="social-panel" className="menu-right-social">
      {/* Açma/Kapama Butonu */}
      <div className="social-toggle-btn" onClick={() => {window.toggleSocialPanel()}}>
        <span id="social-toggle-arrow" className="toggle-arrow-icon">&lt;</span>
      </div>

      {/* Sekme Seçici */}
      <div className="social-tabs">
        <div className="social-tab active" onClick={(e) => {window.switchSocialTab('lobby', e.currentTarget)}} title="Grup Üyeleri">
          <span className="tab-icon">📋</span>
        </div>
        <div className="social-tab" onClick={(e) => {window.switchSocialTab('friends', e.currentTarget)}} title="Arkadaşlar">
          <span className="tab-icon">👥</span>
        </div>
      </div>

      {/* Daraltılmış Haldeki Hızlı İkonlar (Collapsed View) */}
      <div className="social-collapsed-content">
        {isLoggedIn ? (
          <>
            <div className="collapsed-avatar" style={{backgroundColor: '#29b6f6'}} title={`${user?.username} (Siz)`}>🐐</div>
            <div className="collapsed-divider"></div>
            {friends.filter(f => f.status === 'accepted').slice(0, 4).map((f, fIdx) => (
              <div key={fIdx} className="collapsed-avatar offline" title={`${f.username} (Çevrimdışı)`}>
                {f.username[0]?.toUpperCase()}
              </div>
            ))}
          </>
        ) : (
          <div className="collapsed-avatar" style={{backgroundColor: '#aaa'}} title="Giriş Yapılmadı">👤</div>
        )}
      </div>

      {/* Genişletilmiş İçerik Alanı (Expanded View) */}
      <div className="social-expanded-content">
        {/* 1. GRUP SEKME İÇERİĞİ */}
        <div id="social-lobby-content" className="social-tab-content active">
          <div className="lobby-header">
            <span>GRUP ÜYELERİ</span>
            <span className="lobby-count">{isLoggedIn ? '1/4' : '0/4'}</span>
          </div>
          <div className="lobby-players">
            {isLoggedIn ? (
              <>
                <div className="lobby-player-row active">
                  <div className="player-avatar-mini" style={{backgroundColor: '#29b6f6'}}>🐐</div>
                  <div className="player-info-mini">
                    <div className="player-name-mini">{user?.username}</div>
                    <div className="player-status-mini">Grup Lideri</div>
                  </div>
                </div>
                {[1, 2, 3].map(i => (
                  <div key={i} className="lobby-player-row empty">
                    <div className="player-avatar-mini">+</div>
                    <div className="player-info-mini">
                      <div className="player-name-mini">Boş Yuva</div>
                      <div className="player-status-mini">Davet Et</div>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div style={{ padding: '20px 10px', fontSize: '13px', color: '#aaa', textAlign: 'center' }}>
                Grup üyelerini görmek için lütfen giriş yapın.
              </div>
            )}
          </div>
        </div>

        {/* 2. ARKADAŞLAR SEKME İÇERİĞİ */}
        <div id="social-friends-content" className="social-tab-content">
          <div className="friends-search">
            <input type="text" placeholder="İSİM#ETİKET" className="search-input-field" />
          </div>

          <div className="friends-list-wrapper">
            {/* Çevrimiçi Arkadaş */}
            <div className="friend-row online">
              <div className="friend-avatar" style={{backgroundImage: "url('assets/messi.png')"}}>
                <span className="online-indicator"></span>
              </div>
              <div className="friend-info">
                <div className="friend-name">GeneralBAL</div>
                <div className="friend-status">Çevrimiçi</div>
              </div>
            </div>

            {/* Çevrimdışı Akordeon Başlığı */}
            <div className="offline-accordion-header" onClick={() => {window.toggleOfflineAccordion()}}>
              <span className="accordion-title">ÇEVRİMDIŞI (9)</span>
              <span id="accordion-arrow" className="accordion-arrow">▼</span>
            </div>

            {/* Çevrimdışı Arkadaşlar Listesi */}
            <div id="offline-friends-list" className="offline-friends-list open">
              <div className="friend-row offline">
                <div className="friend-avatar">G</div>
                <div className="friend-info">
                  <div className="friend-name">Gangant</div>
                  <div className="friend-status">Çevrimdışı</div>
                </div>
                <span className="chat-bubble-icon">💬</span>
              </div>
              <div className="friend-row offline">
                <div className="friend-avatar">A</div>
                <div className="friend-info">
                  <div className="friend-name">Atakum Sahil</div>
                  <div className="friend-status">Çevrimdışı</div>
                </div>
                <span className="chat-bubble-icon">💬</span>
              </div>
              <div className="friend-row offline">
                <div className="friend-avatar">F</div>
                <div className="friend-info">
                  <div className="friend-name">fatihjojo55</div>
                  <div className="friend-status">Çevrimdışı</div>
                </div>
                <span className="chat-bubble-icon">💬</span>
              </div>
              <div className="friend-row offline">
                <div className="friend-avatar">F</div>
                <div className="friend-info">
                  <div className="friend-name">FATİHOCAM</div>
                  <div className="friend-status">Çevrimdışı</div>
                </div>
                <span className="chat-bubble-icon">💬</span>
              </div>
              <div className="friend-row offline">
                <div className="friend-avatar">H</div>
                <div className="friend-info">
                  <div className="friend-name">husnucoban</div>
                  <div className="friend-status">Çevrimdışı</div>
                </div>
                <span className="chat-bubble-icon">💬</span>
              </div>
              <div className="friend-row offline">
                <div className="friend-avatar">M</div>
                <div className="friend-info">
                  <div className="friend-name">Majste</div>
                  <div className="friend-status">Çevrimdışı</div>
                </div>
                <span className="chat-bubble-icon">💬</span>
              </div>
              <div className="friend-row offline">
                <div className="friend-avatar">M</div>
                <div className="friend-info">
                  <div className="friend-name">melankoli tepesi</div>
                  <div className="friend-status">Çevrimdışı</div>
                </div>
                <span className="chat-bubble-icon">💬</span>
              </div>
              <div className="friend-row offline">
                <div className="friend-avatar">M</div>
                <div className="friend-info">
                  <div className="friend-name">Messisel</div>
                  <div className="friend-status">Çevrimdışı</div>
                </div>
                <span className="chat-bubble-icon">💬</span>
              </div>
              <div className="friend-row offline">
                <div className="friend-avatar">S</div>
                <div className="friend-info">
                  <div className="friend-name">SIUUU</div>
                  <div className="friend-status">Çevrimdışı</div>
                </div>
                <span className="chat-bubble-icon">💬</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button className="btn-lobby-exit" onClick={() => {window.closeApp()}}>OYUNDAN ÇIK</button>
    </div>



    {/* Sol Alt Grup Sohbeti */}
    <div className="menu-left-chat">
      <div className="chat-prefix">Grup:</div>
      <input type="text" className="chat-input" placeholder="Mesaj yazmak için tıklayın..." disabled />
    </div>
  </div>

  <div className="game-wrap" id="app" style={{display: 'none'}}>

    {/* ÜST BAR (Sistem/Ayarlar Butonlu) */}
    <div className="topbar">
      <span className="game-title">⚽ Football Tour Simulator 3D</span>
      <div className="topbar-mid">
        <span className="turn-badge" id="turn-badge">TUR 1</span>
        <span className="phase-label" id="phase-label">Zar Bekleniyor...</span>
      </div>
    </div>

    {/* İZOMETRİK TAHTA ALANI */}
    <div className="board-wrap">
      <div className="board-3d-container" id="board-3d-container">
        <div className="board-grid" id="board-grid"></div>
        <canvas id="three-canvas"></canvas>
      </div>
    </div>

    {/* YAN PANEL (Şehirler / Olaylar) */}
    <div className="side-panel" id="side-panel">
      <div className="side-panel-toggle" onClick={() => {document.getElementById('side-panel').classList.toggle('open')}}>📋 Menü
      </div>
      <div className="panel-tabs">
        <div className="ptab active" onClick={(e) => {window.switchTab('props',e.currentTarget)}}>Şehirler</div>
        <div className="ptab" onClick={(e) => {window.switchTab('log',e.currentTarget)}}>Olaylar</div>
      </div>
      <div className="panel-body" id="panel-body"></div>
    </div>

    {/* OYUNCU HUD BİLGİLERİ (SOL VE SAĞ ALT) */}
    <div className="hud-players" id="hud-players"></div>

    {/* ALT ORTA KONTROLLER (Zar At ve Sırayı Geç) */}
    <div className="hud-center-controls">
      <button className="btn-skip-tutorial" id="btn-roll" onClick={() => {window.rollDice()}}>
        <span>🎲 ZAR AT</span>
        <span style={{fontSize: '10px'}}>&gt;&gt;</span>
      </button>
      <button className="btn-skip-tutorial" id="btn-end" onClick={() => {window.endTurn()}}
        style={{display: 'none', background: 'linear-gradient(to bottom, #ef5350, #d32f2f)', boxShadow: '0 5px 0 #b71c1c'}}>
        <span>Sırayı Geç</span>
      </button>
    </div>

    {/* SAĞ AKSİYON BUTONLARI */}
    <div className="hud-right-actions">
      <button className="btn-round-action" onClick={() => {window.toggleTheme()}} title="Tema Değiştir" id="btn-theme">🌙</button>
      <button className="btn-round-action" onClick={() => {window.openSettings()}} title="Ayarlar">⚙️</button>
      <button className="btn-round-action" onClick={() => {window.toggleFullscreen()}} title="Tam Ekran">🔍</button>
    </div>

  </div>

  {/* AYARLAR MODALI */}
  <div className="modal-backdrop" id="settings-modal" style={{display: 'none'}}>
    <div className="modal">
      <div className="modal-head">
        <div className="modal-city">⚙️ SİSTEM AYARLARI</div>
        <div className="modal-league" id="steam-status">Steam: Çevrimdışı Mod</div>
      </div>
      <div className="modal-body">
        <button className="mbtn mbtn-upgrade" onClick={() => {window.saveGame()}}
          style={{width: '100%', marginBottom: '8px', padding: '10px'}}>💾 Oyunu Kaydet</button>
        <button className="mbtn mbtn-buy" onClick={() => {window.loadGame()}} style={{width: '100%', marginBottom: '8px', padding: '10px'}}>📂
          Oyunu Yükle</button>
        <button className="mbtn mbtn-pass" onClick={() => {window.toggleFullscreen()}}
          style={{width: '100%', marginBottom: '8px', padding: '10px'}}>🖥️ Tam Ekran Geçiş</button>
        <button className="mbtn mbtn-pass" onClick={() => {window.confirmExitToMenu()}}
          style={{width: '100%', background: '#e74c3c', color: '#fff', padding: '10px'}}>❌ Oyundan Çık</button>
      </div>
      <div className="modal-btns">
        <button className="mbtn mbtn-pass" onClick={() => {window.closeModal('settings-modal')}} style={{width: '100%'}}>Kapat</button>
      </div>
    </div>
  </div>

  

    </>
  );
}
