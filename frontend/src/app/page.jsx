'use client';
import { useEffect, useState, useRef } from 'react';
import apiService from '../../services/ApiService.js';
import '../../css/style.css';
import tr from '../locales/tr.json';
import en from '../locales/en.json';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [friends, setFriends] = useState([]);
  const [stats, setStats] = useState({ total_earnings: 0, highest_money: 0, total_properties: 0, wins: 0, total_turns: 0, xp: 0 });
  const [language, setLanguage] = useState('Türkçe');
  const [mounted, setMounted] = useState(false);
  const [loadingClass, setLoadingClass] = useState('loading-transition-overlay');
  const [gameReady, setGameReady] = useState(false);
  const [invitedFriends, setInvitedFriends] = useState([]);
  const [friendSearchInput, setFriendSearchInput] = useState('');
  const [friendAddLoading, setFriendAddLoading] = useState(false);

  // Sol Alt Canlı Sohbet State'leri (Referans Görsel Birebir Tasarımı)
  const [chatMessages, setChatMessages] = useState([
    { id: 1, sender: 'Sistem', channel: 'Grup', text: 'Lobiye bağlandınız. Keyifli oyunlar!', time: '14:30' },
    { id: 2, sender: 'GeneralBAL', channel: 'Grup', text: 'Selamlar herkese, maça hazır mısınız?', time: '14:32' }
  ]);
  const [chatChannel, setChatChannel] = useState('Grup'); // 'Grup' veya 'Kime'
  const [chatTarget, setChatTarget] = useState('');
  const [chatTargetInput, setChatTargetInput] = useState('');
  const [chatText, setChatText] = useState('');
  const [showChatLog, setShowChatLog] = useState(false);
  const chatLogRef = useRef(null);

  const availableFriends = ['GeneralBAL', 'Gangant', 'Atakum Sahil', 'fatihjojo55', 'FATİHOCAM', 'husnucoban', 'Majste', 'melankoli tepesi', 'Messisel', 'SIUUU'];
  const allFriendsList = [...new Set([...availableFriends, ...friends.map(f => f.username)])];

  const matchingFriends = chatTargetInput.trim() 
    ? allFriendsList.filter(f => f.toLowerCase().startsWith(chatTargetInput.toLowerCase()))
    : allFriendsList;

  const handleSendChatMessage = (e) => {
    if (e) e.preventDefault();
    if (!chatText.trim()) return;

    if (chatChannel === 'Kime') {
      if (!chatTarget) {
        alert('Lütfen mesaj gönderilecek arkadaşınızı seçin!');
        return;
      }
    }

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const senderName = user?.username || 'Siz';

    const newMessage = {
      id: Date.now(),
      sender: senderName,
      channel: chatChannel,
      target: chatChannel === 'Kime' ? chatTarget : null,
      text: chatText.trim(),
      time: timeStr
    };

    setChatMessages(prev => [...prev, newMessage]);
    setChatText('');
    setShowChatLog(true);

    setTimeout(() => {
      if (chatLogRef.current) {
        chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
      }
    }, 50);
  };

  const openPrivateChat = (friendName) => {
    if (!allFriendsList.includes(friendName)) {
      alert(`"${friendName}" ile özel sohbet başlatabilmek için öncelikle arkadaş eklemelisiniz!`);
      return;
    }
    setChatChannel('Kime');
    setChatTarget(friendName);
    setChatTargetInput('');
    setShowChatLog(true);
  };

  const handleAddFriend = async () => {
    const username = friendSearchInput.trim();
    if (!username) {
      alert('Lütfen eklenecek kullanıcı adını girin!');
      return;
    }

    if (!isLoggedIn) {
      alert('Arkadaş eklemek için lütfen önce giriş yapın!');
      return;
    }

    try {
      setFriendAddLoading(true);
      const res = await apiService.addFriend(username);
      if (res && res.error) {
        alert(`Arkadaş ekleme hatası: ${res.error}`);
      } else {
        alert(`"${username}" kullanıcısına arkadaşlık isteği gönderildi! 📩`);
        setFriendSearchInput('');
      }
    } catch (e) {
      alert(`"${username}" adlı kullanıcı bulunamadı veya istek gönderilemedi.`);
    } finally {
      setFriendAddLoading(false);
    }
  };

  const sendGameInvite = (friendName) => {
    if (invitedFriends.includes(friendName)) {
      alert(`${friendName} kullanıcısına zaten davet gönderildi!`);
      return;
    }
    if (invitedFriends.length >= 3) {
      alert('Grup dolu (maksimum 4 kişi)!');
      return;
    }
    setInvitedFriends(prev => [...prev, friendName]);
    alert(`${friendName} kullanıcısına oyun daveti gönderildi! 📩`);

    setTimeout(() => {
      const lobbyTabBtn = document.querySelectorAll('.social-tab')[0];
      if (window.switchSocialTab && lobbyTabBtn) {
        window.switchSocialTab('lobby', lobbyTabBtn);
      }
    }, 400);
  };

  useEffect(() => {
    // 1. Client-side durumları hemen yükle (Dil ve giriş durumu)
    const logged = apiService.isLoggedIn();
    setIsLoggedIn(logged);

    const savedLang = localStorage.getItem('ft26_language');
    if (savedLang) setLanguage(savedLang);

    if (logged) {
      const u = apiService.getUser();
      setUser(u);
    }

    const fadeTimer = setTimeout(() => {
      setLoadingClass('loading-transition-overlay fade-out');
    }, 100);

    window.triggerPageTransition = (callback) => {
      setLoadingClass('loading-transition-overlay');
      setTimeout(callback, 100);
    };

    // 2. game.js dinamik modülünü ve ek verileri arka planda yükle
    import('../../js/game.js').then(async () => {
      if (logged) {
        const u = apiService.getUser();
        try {
          const meRes = await apiService.getMe();
          if (meRes && !meRes.error) {
            setUser(meRes);
          }
        } catch (e) {
          console.error(e);
        }
        apiService.getStats(u.id).then(res => {
          if (res && !res.error) setStats(res);
        }).catch(console.error);

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

  const t = language === 'English' ? en : tr;

  return (
    <>
      <div className={loadingClass}>
        <div className="loading-content">
          <img src="assets/logo.png" alt="FT26" className="loading-logo" />
          <div className="loading-bar-container">
            <div className="loading-bar-progress"></div>
          </div>
          <div className="loading-text">{t.loading}</div>
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
          <div className="nav-item-icon" title="Profil" onClick={() => {window.location.href='/profile'}}>👤</div>
        </div>
        <button className="btn-play-tactical" onClick={() => {window.showGameModeSelection()}}>{t.play}</button>
        <div className="nav-icons-group right">
          <div className="nav-item-icon" title="Başarımlar" onClick={() => {window.showAchievements()}}>🏆</div>
          <div className="nav-item-icon" title="Mağaza" onClick={() => {window.showStore()}}>🛒</div>
          <div className="nav-item-icon" title="Ayarlar" onClick={() => {window.location.href='/settings'}}>⚙️</div>
        </div>
      </div>
      <div className="top-nav-right">
        {isLoggedIn ? (
          <div className="user-stats" style={{ gap: '10px' }}>
            <div className="stat-item" title={t.earnings}>
              <span style={{display: "flex", alignItems: "center", justifyContent: "center", height: "100%"}}>🪙</span>
              <span style={{display: "flex", alignItems: "center", position: "relative", top: "0.5px"}}>₺{(stats.total_earnings || 0).toLocaleString()}</span>
            </div>
          </div>
        ) : (
          <button className="btn-login-oval" onClick={() => {window.location.href='/auth'}}>
            {t.login_btn}
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
            <div className="news-tag">{t.weekly_match}</div>
            <h2 className="news-title">{t.legend_duel}</h2>
            <p className="news-desc">{t.match_desc}</p>
          </div>
        </div>
        <div className="news-card small-card">
          <div className="news-img" style={{backgroundImage: "url('assets/haaland.png')"}}></div>
          <div className="news-content-overlay">
            <h3 className="news-title-small">{t.patch_notes}</h3>
            <p className="news-desc-small">{t.patch_desc}</p>
          </div>
        </div>
        {/* Kesintisiz döngü için kartların kopyası */}
        <div className="news-card big-card">
          <div className="news-img" style={{backgroundImage: "url('assets/messi.png')"}}></div>
          <div className="news-content-overlay">
            <div className="news-tag">{t.weekly_match}</div>
            <h2 className="news-title">{t.legend_duel}</h2>
            <p className="news-desc">{t.match_desc}</p>
          </div>
        </div>
        <div className="news-card small-card">
          <div className="news-img" style={{backgroundImage: "url('assets/haaland.png')"}}></div>
          <div className="news-content-overlay">
            <h3 className="news-title-small">{t.patch_notes}</h3>
            <p className="news-desc-small">{t.patch_desc}</p>
          </div>
        </div>
      </div>
    </div>

    {/* Dinamik Ekran Alanı (Profil, Battle Pass, Mağaza için) */}
    <div id="dynamic-screen-container" className="menu-dynamic-screen" style={{display: 'none'}}></div>

    {/* Oyun Modu Seçim Ekranı */}
    <div id="game-mode-screen" className="game-mode-container" style={{display: 'none'}}>
      <div className="mode-screen-header">
        <button className="btn-mode-back" onClick={() => {window.hideGameModeSelection()}}>← {t.back}</button>
        <h1 className="mode-screen-title">{t.select_mode}</h1>
      </div>
      <div className="mode-cards-wrapper">
        {/* Hızlı Eşleşme Kartı */}
        <div className="mode-card" onClick={() => {window.showOnlineLobby()}}>
          <div className="mode-card-glow"></div>
          <div className="mode-card-content">
            <span className="mode-tag">ÇEVRİMİÇİ</span>
            <h2 className="mode-title">{t.fast_match}</h2>
            <p className="mode-desc">{t.fast_match_desc}</p>
            <div className="mode-action-btn">{t.queue_btn}</div>
          </div>
        </div>

        {/* Özel Oyun Kartı */}
        <div className="mode-card" onClick={() => {window.showPrivateRoomSelection()}}>
          <div className="mode-card-glow"></div>
          <div className="mode-card-content">
            <span className="mode-tag custom">ÖZEL ODA</span>
            <h2 className="mode-title">{t.private_game}</h2>
            <p className="mode-desc">{t.private_game_desc}</p>
            <div className="mode-action-btn">{t.room_manage}</div>
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
            <div className="collapsed-avatar" style={{
              backgroundColor: '#29b6f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }} title={`${user?.username} (Siz)`}>
              {user?.avatar && (user.avatar.startsWith('/') || user.avatar.startsWith('data:') || user.avatar.startsWith('http')) ? (
                <img src={user.avatar} alt="pp" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
              ) : (
                user?.avatar || '🐐'
              )}
            </div>
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
                  <div className="player-avatar-mini" style={{
                    backgroundColor: '#29b6f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden'
                  }}>
                    {user?.avatar && (user.avatar.startsWith('/') || user.avatar.startsWith('data:') || user.avatar.startsWith('http')) ? (
                      <img src={user.avatar} alt="pp" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                    ) : (
                      user?.avatar || '🐐'
                    )}
                  </div>
                  <div className="player-info-mini">
                    <div className="player-name-mini">{user?.username}</div>
                    <div className="player-status-mini">Grup Lideri</div>
                  </div>
                </div>
                {[0, 1, 2].map((idx) => {
                  const invitedName = invitedFriends[idx];
                  if (invitedName) {
                    return (
                      <div key={idx} className="lobby-player-row active" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div className="player-avatar-mini" style={{ backgroundColor: '#ffb74d', color: '#000', fontWeight: 'bold' }}>
                            {invitedName[0]?.toUpperCase()}
                          </div>
                          <div className="player-info-mini">
                            <div className="player-name-mini">{invitedName}</div>
                            <div className="player-status-mini" style={{ color: '#ffb74d', fontWeight: 'bold' }}>Davet Edildi ⏳</div>
                          </div>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setInvitedFriends(prev => prev.filter(n => n !== invitedName));
                          }}
                          style={{ background: 'transparent', border: 'none', color: '#ff5252', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
                          title="Daveti İptal Et"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div 
                      key={idx} 
                      className="lobby-player-row empty"
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        const panel = document.getElementById('social-panel');
                        if (panel && panel.classList.contains('collapsed')) {
                          if (window.toggleSocialPanel) window.toggleSocialPanel();
                        }
                        const friendsTabBtn = document.querySelectorAll('.social-tab')[1];
                        if (window.switchSocialTab && friendsTabBtn) {
                          window.switchSocialTab('friends', friendsTabBtn);
                        }
                      }}
                    >
                      <div className="player-avatar-mini">+</div>
                      <div className="player-info-mini">
                        <div className="player-name-mini">Boş Yuva</div>
                        <div className="player-status-mini">Davet Et</div>
                      </div>
                    </div>
                  );
                })}
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
          <div className="friends-search" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input 
              type="text" 
              placeholder="Kullanıcı adı girin..." 
              className="search-input-field" 
              value={friendSearchInput}
              onChange={(e) => setFriendSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddFriend(); }}
              style={{ flex: 1 }}
            />
            <button 
              onClick={handleAddFriend}
              disabled={friendAddLoading}
              style={{
                background: 'linear-gradient(135deg, #00e5ff, #0288d1)',
                border: 'none',
                color: '#000',
                padding: '8px 12px',
                borderRadius: '6px',
                fontWeight: '800',
                fontSize: '12px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {friendAddLoading ? '...' : '+ Ekle'}
            </button>
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
              <button 
                onClick={() => sendGameInvite('GeneralBAL')}
                style={{
                  background: invitedFriends.includes('GeneralBAL') ? 'rgba(255, 183, 77, 0.2)' : 'linear-gradient(135deg, #00e5ff, #0288d1)',
                  border: invitedFriends.includes('GeneralBAL') ? '1px solid #ffb74d' : 'none',
                  color: invitedFriends.includes('GeneralBAL') ? '#ffb74d' : '#000',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  marginLeft: 'auto'
                }}
              >
                {invitedFriends.includes('GeneralBAL') ? 'Davet Edildi' : 'Davet Et'}
              </button>
            </div>

            {/* Çevrimdışı Akordeon Başlığı */}
            <div className="offline-accordion-header" onClick={() => {window.toggleOfflineAccordion()}}>
              <span className="accordion-title">ÇEVRİMDIŞI (9)</span>
              <span id="accordion-arrow" className="accordion-arrow">▼</span>
            </div>

            {/* Çevrimdışı Arkadaşlar Listesi */}
            <div id="offline-friends-list" className="offline-friends-list open">
              {['Gangant', 'Atakum Sahil', 'fatihjojo55', 'FATİHOCAM', 'husnucoban', 'Majste', 'melankoli tepesi', 'Messisel', 'SIUUU'].map((fname, fIndex) => (
                <div key={fIndex} className="friend-row offline">
                  <div className="friend-avatar">{fname[0].toUpperCase()}</div>
                  <div className="friend-info">
                    <div className="friend-name">{fname}</div>
                    <div className="friend-status">Çevrimdışı</div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginLeft: 'auto' }}>
                    <button 
                      onClick={() => sendGameInvite(fname)}
                      style={{
                        background: invitedFriends.includes(fname) ? 'rgba(255, 183, 77, 0.2)' : 'rgba(41, 182, 246, 0.15)',
                        border: invitedFriends.includes(fname) ? '1px solid #ffb74d' : '1px solid rgba(41, 182, 246, 0.3)',
                        color: invitedFriends.includes(fname) ? '#ffb74d' : '#00e5ff',
                        padding: '4px 8px',
                        borderRadius: '10px',
                        fontSize: '10px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      {invitedFriends.includes(fname) ? 'Davet Edildi' : 'Davet Et'}
                    </button>
                    <span 
                      onClick={(e) => { e.stopPropagation(); openPrivateChat(fname); }}
                      style={{ cursor: 'pointer', fontSize: '13px', padding: '2px 4px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }} 
                      title={`${fname} ile Özel Sohbet Başlat`}
                    >
                      💬
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <button className="btn-lobby-exit" onClick={() => {window.closeApp()}}>OYUNDAN ÇIK</button>
    </div>

    {/* Sol Alt Canlı Sohbet Barı (360px Genişlik & Sol Üst Kartlarla Hizalı 20px) */}
    <div className="menu-left-chat" style={{
      position: 'absolute',
      left: '20px',
      bottom: '30px',
      zIndex: 100,
      width: '360px',
      maxWidth: '88%',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      background: 'transparent',
      border: 'none',
      boxShadow: 'none',
      padding: 0
    }}>
      {/* Sohbet Geçmişi */}
      {showChatLog && (
        <div style={{
          background: 'rgba(9, 11, 14, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '6px 6px 0 0',
          padding: '8px 10px',
          maxHeight: '125px',
          width: '100%',
          boxSizing: 'border-box',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          boxShadow: '0 -6px 20px rgba(0,0,0,0.6)'
        }} ref={chatLogRef}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '3px', marginBottom: '2px' }}>
            <span style={{ fontSize: '10px', fontWeight: '800', color: chatChannel === 'Kime' ? '#e573a7' : '#00e5ff' }}>
              💬 {chatChannel === 'Grup' ? 'GRUP SOHBETİ' : `ÖZEL: ${chatTarget || 'Alıcı Seçin'}`}
            </span>
            <button onClick={() => setShowChatLog(false)} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '11px' }}>✕</button>
          </div>

          {chatMessages
            .filter(m => chatChannel === 'Grup' ? m.channel === 'Grup' : (m.channel === 'Kime' && (m.target === chatTarget || m.sender === chatTarget)))
            .map(msg => (
              <div key={msg.id} style={{ fontSize: '11px', lineHeight: '1.3' }}>
                <span style={{ fontSize: '9px', color: '#666', marginRight: '4px' }}>[{msg.time}]</span>
                <span style={{ fontWeight: '800', color: msg.sender === 'Sistem' ? '#ffb74d' : (msg.sender === (user?.username || 'Siz') ? '#e573a7' : '#00e5ff'), marginRight: '4px' }}>
                  {msg.sender}:
                </span>
                <span style={{ color: '#eee' }}>{msg.text}</span>
              </div>
            ))}
        </div>
      )}

      {/* Referans Görsel Chat Input Barı */}
      <div style={{ position: 'relative', width: '100%', boxSizing: 'border-box' }}>
        {/* Autocomplete Popup */}
        {chatChannel === 'Kime' && !chatTarget && matchingFriends.length > 0 && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: '0',
            marginBottom: '2px',
            display: 'flex',
            flexDirection: 'column',
            width: '120px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
            zIndex: 110
          }}>
            {matchingFriends.slice(0, 3).map((fName, idx) => (
              <div 
                key={fName}
                onClick={() => {
                  setChatTarget(fName);
                  setChatTargetInput('');
                }}
                style={{
                  background: idx === 0 ? '#d4719e' : '#71717a',
                  color: '#ffffff',
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: '600',
                  fontFamily: "'Outfit', sans-serif",
                  cursor: 'pointer'
                }}
              >
                {fName}
              </div>
            ))}
          </div>
        )}

        <form 
          onSubmit={handleSendChatMessage}
          style={{
            background: 'rgba(9, 11, 14, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            padding: '0 8px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          {/* Prefix Text */}
          {chatChannel === 'Grup' ? (
            <span 
              onClick={() => { setChatChannel('Kime'); setChatTarget(''); }}
              style={{ color: '#00e5ff', fontWeight: '700', fontSize: '13px', marginRight: '6px', cursor: 'pointer', userSelect: 'none' }}
              title="Kanal Değiştir (Grup / Kime)"
            >
              Grup:
            </span>
          ) : chatTarget ? (
            <span 
              onClick={() => { setChatTarget(''); setChatTargetInput(''); }}
              style={{ background: '#d4719e', color: '#fff', padding: '2px 6px', borderRadius: '2px', fontWeight: '700', fontSize: '12px', marginRight: '8px', cursor: 'pointer' }}
              title="Alıcıyı Değiştir"
            >
              {chatTarget}
            </span>
          ) : (
            <span 
              onClick={() => setChatChannel('Grup')}
              style={{ color: '#e573a7', fontWeight: '700', fontSize: '13px', marginRight: '6px', cursor: 'pointer', userSelect: 'none' }}
              title="Grup Moduna Geç"
            >
              Kime:
            </span>
          )}

          {/* Input Field */}
          {chatChannel === 'Kime' && !chatTarget ? (
            <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <input 
                type="text"
                value={chatTargetInput}
                onChange={(e) => setChatTargetInput(e.target.value)}
                onFocus={() => setShowChatLog(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Tab' || e.key === 'Enter') {
                    e.preventDefault();
                    if (matchingFriends.length > 0) {
                      setChatTarget(matchingFriends[0]);
                      setChatTargetInput('');
                    }
                  }
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontFamily: "'Outfit', sans-serif",
                  width: `${Math.max(20, chatTargetInput.length * 9)}px`
                }}
                autoFocus
              />
              <span style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '11px', marginLeft: '10px', userSelect: 'none', pointerEvents: 'none' }}>
                Tamamlamak için: [TAB]
              </span>
            </div>
          ) : (
            <input 
              type="text"
              placeholder="Mesaj yazmak için tıklayın..."
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              onFocus={() => setShowChatLog(true)}
              onKeyDown={(e) => {
                if (e.key === 'Tab') {
                  e.preventDefault();
                  if (chatChannel === 'Grup') {
                    setChatChannel('Kime');
                  } else {
                    setChatChannel('Grup');
                  }
                }
              }}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#ffffff',
                fontSize: '13px',
                fontFamily: "'Outfit', sans-serif"
              }}
            />
          )}
        </form>
      </div>
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
    <div className="modal" style={{
      background: 'rgba(20, 24, 33, 0.95)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(41, 182, 246, 0.2)',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(41, 182, 246, 0.1)',
      borderRadius: '12px',
      padding: '24px',
      width: '360px',
      maxWidth: '90%'
    }}>
      <div className="modal-head" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '12px', marginBottom: '20px' }}>
        <div className="modal-city" style={{ fontSize: '20px', fontWeight: 'bold', color: '#29b6f6', letterSpacing: '1px' }}>⚙️ SİSTEM AYARLARI</div>
        <div className="modal-league" id="steam-status" style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>Steam: Çevrimdışı Mod</div>
      </div>
      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '12px', color: '#888', fontWeight: '600', marginBottom: '4px', letterSpacing: '0.5px' }}>OYUN DURUMU</div>
        <button className="mbtn mbtn-upgrade" onClick={() => {window.saveGame()}}
          style={{ width: '100%', padding: '12px', margin: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>💾 Oyunu Kaydet</button>
        <button className="mbtn mbtn-buy" onClick={() => {window.loadGame()}} 
          style={{ width: '100%', padding: '12px', margin: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>📂 Oyunu Yükle</button>
        
        <div style={{ fontSize: '12px', color: '#888', fontWeight: '600', marginTop: '10px', marginBottom: '4px', letterSpacing: '0.5px' }}>EKRAN & UYGULAMA</div>
        <button className="mbtn mbtn-pass" onClick={() => {window.toggleFullscreen()}}
          style={{ width: '100%', padding: '12px', margin: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>🖥️ Tam Ekran Geçiş</button>
        <button className="mbtn mbtn-pass" onClick={() => {window.confirmExitToMenu()}}
          style={{ width: '100%', background: 'rgba(231, 76, 60, 0.15)', border: '1px solid #e74c3c', color: '#e74c3c', padding: '12px', margin: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>❌ Oyundan Çık</button>
        
        {isLoggedIn && (
          <>
            <div style={{ fontSize: '12px', color: '#888', fontWeight: '600', marginTop: '10px', marginBottom: '4px', letterSpacing: '0.5px' }}>HESAP YÖNETİMİ</div>
            <button className="mbtn" onClick={handleLogout} style={{
              width: '100%', 
              background: 'linear-gradient(135deg, #ff5252, #ff1744)',
              color: '#fff', 
              padding: '12px', 
              margin: '0', 
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(255, 23, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}>
              🚪 Hesaptan Çıkış Yap
            </button>
          </>
        )}
      </div>
      <div className="modal-btns" style={{ marginTop: '20px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '16px' }}>
        <button className="mbtn mbtn-pass" onClick={() => {window.closeModal('settings-modal')}} style={{ width: '100%', padding: '10px', margin: '0' }}>Kapat</button>
      </div>
    </div>
  </div>

  

    </>
  );
}
