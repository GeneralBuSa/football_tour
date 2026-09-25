'use client';
import { useEffect, useState, useRef } from 'react';
import apiService from '../../services/ApiService.js';
import useSocial from './shared/useSocial.js';
import BackgroundVideo from './shared/BackgroundVideo.jsx';
import SiteFooter from './shared/SiteFooter.jsx';
import { trackEvent } from '../../services/analytics.js';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from './shared/siteConfig.js';
import { MAX_MESSAGE_LENGTH } from '../../services/SocialService.js';
import '../../css/style.css';
// Oyun ekranı stilleri style.css'ten SONRA yüklenmeli (aynı seçicileri geçersiz kılar).
import '../../css/components/game-screen.css';
import tr from '../locales/tr.json';
import en from '../locales/en.json';

const isImageAvatar = value => typeof value === 'string' && /^(\/|data:image\/|https?:\/\/)/.test(value);

function Avatar({ value, fallback, imgStyle }) {
  if (isImageAvatar(value)) {
    return <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', ...imgStyle }} />;
  }
  return <>{value || fallback || '👤'}</>;
}

function formatTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

const smallButton = (background, color = '#000') => ({
  background,
  border: 'none',
  color,
  padding: '4px 10px',
  borderRadius: '12px',
  fontSize: '11px',
  fontWeight: '800',
  cursor: 'pointer',
  minHeight: '28px'
});

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ total_earnings: 0, highest_money: 0, total_properties: 0, wins: 0, total_turns: 0, xp: 0 });
  const [language, setLanguage] = useState('Türkçe');
  const [loadingClass, setLoadingClass] = useState('loading-transition-overlay');
  const [invitedFriends, setInvitedFriends] = useState([]);
  const [friendSearchInput, setFriendSearchInput] = useState('');
  const [friendAddLoading, setFriendAddLoading] = useState(false);
  const [friendFeedback, setFriendFeedback] = useState({ type: '', text: '' });
  const [pendingAction, setPendingAction] = useState('');
  const [homeNotice, setHomeNotice] = useState('');

  // Sol alt canlı sohbet (arkadaşlara özel mesaj)
  const [chatTargetInput, setChatTargetInput] = useState('');
  const [chatText, setChatText] = useState('');
  const [chatError, setChatError] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [showChatLog, setShowChatLog] = useState(false);
  const chatLogRef = useRef(null);

  const social = useSocial({ isLoggedIn, user });
  const acceptedFriends = social.grouped.accepted;
  const activeFriend = acceptedFriends.find(f => f.friend_id === social.activeFriendId) || null;
  const activeMessages = activeFriend ? (social.conversations[activeFriend.friend_id] || []) : [];
  const totalUnread = Object.values(social.unread).reduce((sum, count) => sum + count, 0);

  const matchingFriends = chatTargetInput.trim()
    ? acceptedFriends.filter(f => f.username.toLowerCase().startsWith(chatTargetInput.trim().toLowerCase()))
    : acceptedFriends;

  useEffect(() => {
    if (chatLogRef.current) chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
  }, [activeMessages.length, showChatLog]);

  const selectChatTarget = async (friend) => {
    setChatTargetInput('');
    setChatError('');
    setShowChatLog(true);
    const result = await social.openConversation(friend.friend_id);
    if (!result.ok) setChatError(result.error);
  };

  const handleSendChatMessage = async (e) => {
    if (e) e.preventDefault();
    if (chatSending) return;
    if (!isLoggedIn) {
      setChatError('Mesaj göndermek için giriş yapın.');
      return;
    }
    if (!activeFriend) {
      setChatError('Lütfen mesaj gönderilecek arkadaşınızı seçin.');
      return;
    }
    setChatSending(true);
    const result = await social.sendMessage(activeFriend.friend_id, chatText);
    setChatSending(false);
    if (!result.ok) {
      setChatError(result.error);
      return;
    }
    setChatError('');
    setChatText('');
    setShowChatLog(true);
  };

  const openPrivateChat = (friend) => {
    selectChatTarget(friend);
  };

  const handleAddFriend = async (e) => {
    if (e) e.preventDefault();
    if (friendAddLoading) return;
    if (!isLoggedIn) {
      setFriendFeedback({ type: 'error', text: 'Arkadaş eklemek için lütfen önce giriş yapın.' });
      return;
    }
    const username = friendSearchInput.trim();
    if (!username) {
      setFriendFeedback({ type: 'error', text: 'Lütfen eklenecek kullanıcı adını girin.' });
      return;
    }

    setFriendAddLoading(true);
    const result = await social.addFriend(username);
    setFriendAddLoading(false);
    if (!result.ok) {
      setFriendFeedback({ type: 'error', text: result.error });
      return;
    }
    setFriendFeedback({
      type: 'success',
      text: result.data?.auto_accepted
        ? `${username} artık arkadaşın! 🎉`
        : `${username} kullanıcısına arkadaşlık isteği gönderildi. 📩`
    });
    setFriendSearchInput('');
  };

  const runFriendAction = async (key, action, successText) => {
    setPendingAction(key);
    const result = await action();
    setPendingAction('');
    setFriendFeedback(result.ok ? { type: 'success', text: successText } : { type: 'error', text: result.error });
  };

  const handleRemoveFriend = (friend) => {
    if (!window.confirm(`${friend.username} arkadaş listenden çıkarılsın mı?`)) return;
    runFriendAction(`remove:${friend.friend_id}`, () => social.removeFriend(friend.friend_id), `${friend.username} arkadaş listesinden çıkarıldı.`);
  };

  const sendGameInvite = async (friend) => {
    if (invitedFriends.includes(friend.username)) {
      setFriendFeedback({ type: 'error', text: `${friend.username} kullanıcısına zaten davet gönderildi.` });
      return;
    }
    // Çevrimiçi maçlar 2 kişiliktir: aynı anda tek davet.
    if (invitedFriends.length >= 1) {
      setFriendFeedback({ type: 'error', text: 'Çevrimiçi maçlar 2 kişiliktir. Önce mevcut daveti iptal edin.' });
      return;
    }
    setPendingAction(`invite:${friend.friend_id}`);
    const result = await social.inviteFriend(friend);
    setPendingAction('');
    if (!result.ok) {
      setFriendFeedback({ type: 'error', text: result.error });
      return;
    }
    setInvitedFriends([friend.username]);
    setFriendFeedback({ type: 'success', text: `${friend.username} kullanıcısına oyun daveti gönderildi. 📩` });
  };

  const cancelInvite = async (friendName) => {
    setInvitedFriends(prev => prev.filter(n => n !== friendName));
    if (typeof window.closeLobbyQueue === 'function' && document.getElementById('lobby-modal')) {
      await window.closeLobbyQueue();
    } else {
      await apiService.leaveLobby();
    }
  };

  const acceptInvite = (invite) => {
    social.dismissInvite(invite.id);
    if (typeof window.joinPrivateRoomByHost === 'function') {
      window.joinPrivateRoomByHost(invite.sender_username);
    }
  };

  const inviteSender = (message) => {
    if (message.sender_username) return message.sender_username;
    const friend = social.friends.find(f => f.friend_id === message.sender_id);
    return friend?.username || '';
  };

  useEffect(() => {
    // 1. Client-side durumları hemen yükle (Dil ve giriş durumu)
    const logged = apiService.isLoggedIn();
    setIsLoggedIn(logged);

    const savedLang = localStorage.getItem('ft26_language');
    if (savedLang) setLanguage(savedLang);

    const params = new URLSearchParams(window.location.search);
    if (params.get('accountDeleted') === '1') {
      setHomeNotice(savedLang === 'English' ? 'Your account and its data have been deleted.' : 'Hesabın ve ilişkili verilerin silindi.');
    }

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
          } else if (!apiService.isLoggedIn()) {
            // Token süresi dolmuş: arayüzü misafir moduna al
            setIsLoggedIn(false);
            setUser(null);
            return;
          }
        } catch (e) {
          console.error(e);
        }
        apiService.getStats(u.id).then(res => {
          if (res && !res.error) setStats(res);
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
  const partySize = isLoggedIn ? 1 + invitedFriends.length : 0;

  const navButton = (icon, label, onClick) => (
    <button type="button" className="nav-item-icon" title={label} aria-label={label} onClick={onClick}>{icon}</button>
  );

  return (
    <>
      <div className={loadingClass} aria-hidden="true">
        <div className="loading-content">
          <img src="assets/logo.webp" alt="" className="loading-logo" width="180" height="180" />
          <div className="loading-bar-container">
            <div className="loading-bar-progress"></div>
          </div>
          <div className="loading-text">{t.loading}</div>
        </div>
      </div>

      <h1 className="sr-only">Football Tour Simulator — 3D İzometrik Futbol Strateji Masa Oyunu</h1>

      {/* ANA MENÜ / KARŞILAMA EKRANI (VALORANT TARZI) */}
      <main id="main-menu" className="main-menu-container">
        <BackgroundVideo />
        <div className="menu-overlay"></div>

        {/* Üst Navigasyon Barı */}
        <nav className="menu-top-nav" aria-label="Ana menü">
          <div className="top-nav-left">
            <div className="menu-logo">
              <img src="assets/logo.webp" alt="Football Tour Simulator FT26" className="logo-img" width="120" height="120" />
            </div>
          </div>
          <div className="top-nav-center">
            <div className="nav-icons-group left">
              {navButton('🏠', t.nav_home || 'Ana Sayfa', () => { window.showHome?.(); })}
              {navButton('📜', t.nav_history || 'Maç Geçmişi', () => { window.location.href = '/history'; })}
              {navButton('👤', t.nav_profile || 'Profil', () => { window.location.href = '/profile'; })}
            </div>
            <button className="btn-play-tactical" onClick={() => { trackEvent('play_cta_click', { placement: 'top_nav' }); window.showGameModeSelection?.(); }}>{t.play}</button>
            <div className="nav-icons-group right">
              {navButton('🏆', t.nav_achievements || 'Başarımlar', () => { window.location.href = '/achievements'; })}
              {navButton('🛒', t.nav_store || 'Mağaza', () => { window.location.href = '/store'; })}
              {navButton('⚙️', t.nav_settings || 'Ayarlar', () => { window.location.href = '/settings'; })}
            </div>
          </div>
          <div className="top-nav-right">
            {isLoggedIn ? (
              <div className="user-stats" style={{ gap: '10px' }}>
                <div className="stat-item" title={t.earnings}>
                  <span aria-hidden="true" style={{display: "flex", alignItems: "center", justifyContent: "center", height: "100%"}}>🪙</span>
                  <span style={{display: "flex", alignItems: "center", position: "relative", top: "0.5px"}}>₺{(stats.total_earnings || 0).toLocaleString()}</span>
                </div>
              </div>
            ) : (
              <button className="btn-login-oval" onClick={() => {window.location.href='/auth'}}>
                {t.login_btn}
              </button>
            )}
          </div>
        </nav>

        {/* Mobil sabit CTA: üst bardaki OYNA butonu küçük ekranlarda gizlenir */}
        <div className="mobile-play-cta">
          <button type="button" className="btn-play-tactical" onClick={() => { trackEvent('play_cta_click', { placement: 'mobile_sticky' }); window.showGameModeSelection?.(); }}>
            {t.play}
          </button>
        </div>

        {/* Sol Duyuru Kartları */}
        <div className="menu-left-cards" id="menu-left-cards">
          <div className="news-cards-track">
            <div className="news-card big-card">
              <div className="news-img" style={{backgroundImage: "url('assets/store_stadium_theme.webp')"}}></div>
              <div className="news-content-overlay">
                <div className="news-tag">{t.weekly_match}</div>
                <h2 className="news-title">{t.legend_duel}</h2>
                <p className="news-desc">{t.match_desc}</p>
              </div>
            </div>
            <div className="news-card small-card">
              <div className="news-img" style={{backgroundImage: "url('assets/store_gold_pawn_box.webp')"}}></div>
              <div className="news-content-overlay">
                <h3 className="news-title-small">{t.patch_notes}</h3>
                <p className="news-desc-small">{t.patch_desc}</p>
              </div>
            </div>
            {/* Kesintisiz döngü için kartların kopyası (ekran okuyucudan gizli) */}
            <div className="news-card big-card" aria-hidden="true">
              <div className="news-img" style={{backgroundImage: "url('assets/store_stadium_theme.webp')"}}></div>
              <div className="news-content-overlay">
                <div className="news-tag">{t.weekly_match}</div>
                <div className="news-title">{t.legend_duel}</div>
                <p className="news-desc">{t.match_desc}</p>
              </div>
            </div>
            <div className="news-card small-card" aria-hidden="true">
              <div className="news-img" style={{backgroundImage: "url('assets/store_gold_pawn_box.webp')"}}></div>
              <div className="news-content-overlay">
                <div className="news-title-small">{t.patch_notes}</div>
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
            <h2 className="mode-screen-title">{t.select_mode}</h2>
          </div>
          <div className="mode-cards-wrapper">
            {/* Hızlı Eşleşme Kartı */}
            <button type="button" className="mode-card" onClick={() => {window.showOnlineLobby()}}>
              <div className="mode-card-glow"></div>
              <div className="mode-card-content">
                <span className="mode-tag">ÇEVRİMİÇİ</span>
                <span className="mode-title">{t.fast_match}</span>
                <p className="mode-desc">{t.fast_match_desc}</p>
                <div className="mode-action-btn">{t.queue_btn}</div>
              </div>
            </button>

            {/* Yerel Maç Kartı: hesap gerektirmez, oyunu kayıt olmadan denemeyi sağlar */}
            <button type="button" className="mode-card" onClick={() => { window.playLocalGame?.({ localPlayers: 2 }); }}>
              <div className="mode-card-glow"></div>
              <div className="mode-card-content">
                <span className="mode-tag custom">HESAP GEREKMEZ</span>
                <span className="mode-title">{language === 'English' ? 'LOCAL MATCH' : 'YEREL MAÇ'}</span>
                <p className="mode-desc">{language === 'English'
                  ? 'Two players take turns on the same device. Try the game without signing up.'
                  : 'İki oyuncu aynı cihazda sırayla oynar. Kayıt olmadan oyunu hemen dene.'}</p>
                <div className="mode-action-btn">{language === 'English' ? 'PLAY NOW' : 'HEMEN OYNA'}</div>
              </div>
            </button>

            {/* Özel Oyun Kartı */}
            <button type="button" className="mode-card" onClick={() => {window.showPrivateRoomSelection()}}>
              <div className="mode-card-glow"></div>
              <div className="mode-card-content">
                <span className="mode-tag custom">ÖZEL ODA</span>
                <span className="mode-title">{t.private_game}</span>
                <p className="mode-desc">{t.private_game_desc}</p>
                <div className="mode-action-btn">{t.room_manage}</div>
              </div>
            </button>
          </div>
        </div>

        {homeNotice && (
          <div className="invite-toasts" role="status">
            <div className="invite-toast">
              <span>{homeNotice}</span>
              <button type="button" style={smallButton('rgba(255,255,255,0.1)', '#fff')} onClick={() => setHomeNotice('')}>Kapat</button>
            </div>
          </div>
        )}

        {/* Gelen oyun davetleri */}
        {social.invites.length > 0 && (
          <div className="invite-toasts" role="region" aria-label="Oyun davetleri">
            {social.invites.map(invite => (
              <div key={invite.id} className="invite-toast" role="alert">
                <span>🎮 <strong>{inviteSender(invite)}</strong> seni özel maça davet etti.</span>
                <div className="invite-toast-actions">
                  <button type="button" style={smallButton('linear-gradient(135deg, #2ecc71, #27ae60)', '#fff')} onClick={() => acceptInvite({ ...invite, sender_username: inviteSender(invite) })}>Katıl</button>
                  <button type="button" style={smallButton('rgba(255,255,255,0.1)', '#fff')} onClick={() => social.dismissInvite(invite.id)}>Kapat</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sağ Sosyal Panel (VALORANT TARZI) */}
        <aside id="social-panel" className="menu-right-social collapsed" aria-label="Sosyal panel">
          {/* Açma/Kapama Butonu */}
          <button type="button" className="social-toggle-btn" onClick={() => {window.toggleSocialPanel()}} aria-label="Sosyal paneli aç/kapat" aria-controls="social-panel" aria-expanded="false">
            <span id="social-toggle-arrow" className="toggle-arrow-icon" aria-hidden="true">&gt;</span>
          </button>

          {/* Sekme Seçici */}
          <div className="social-tabs" role="tablist">
            <button type="button" role="tab" aria-selected="true" className="social-tab active" onClick={(e) => {window.switchSocialTab('lobby', e.currentTarget)}} title="Grup Üyeleri" aria-label="Grup Üyeleri">
              <span className="tab-icon" aria-hidden="true">📋</span>
            </button>
            <button type="button" role="tab" aria-selected="false" className="social-tab" onClick={(e) => {window.switchSocialTab('friends', e.currentTarget)}} title="Arkadaşlar" aria-label={`Arkadaşlar${social.grouped.incoming.length + totalUnread ? ` (${social.grouped.incoming.length + totalUnread} yeni)` : ''}`}>
              <span className="tab-icon" aria-hidden="true">👥</span>
              {(social.grouped.incoming.length + totalUnread) > 0 && (
                <span className="social-badge" aria-hidden="true">{social.grouped.incoming.length + totalUnread}</span>
              )}
            </button>
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
                  <Avatar value={user?.avatar} imgStyle={{ borderRadius: 0 }} />
                </div>
                <div className="collapsed-divider"></div>
                {acceptedFriends.slice(0, 4).map(f => (
                  <div key={f.id} className={`collapsed-avatar ${f.online ? 'online' : 'offline'}`} title={`${f.username} (${f.online ? 'Çevrimiçi' : 'Çevrimdışı'})`}>
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
            <div id="social-lobby-content" className="social-tab-content active" role="tabpanel">
              <div className="lobby-header">
                <span>{t.social_party_members || 'GRUP ÜYELERİ'}</span>
                <span className="lobby-count">{partySize}/2</span>
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
                        <Avatar value={user?.avatar} imgStyle={{ borderRadius: 0 }} />
                      </div>
                      <div className="player-info-mini">
                        <div className="player-name-mini">{user?.username}</div>
                        <div className="player-status-mini">{t.social_party_leader || 'Grup Lideri'}</div>
                      </div>
                    </div>
                    {invitedFriends.length > 0 ? invitedFriends.map(invitedName => (
                      <div key={invitedName} className="lobby-player-row active" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div className="player-avatar-mini" style={{ backgroundColor: '#ffb74d', color: '#000', fontWeight: 'bold' }}>
                            {invitedName[0]?.toUpperCase()}
                          </div>
                          <div className="player-info-mini">
                            <div className="player-name-mini">{invitedName}</div>
                            <div className="player-status-mini" style={{ color: '#ffb74d', fontWeight: 'bold' }}>{t.social_invited || 'Davet Edildi ⏳'}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); cancelInvite(invitedName); }}
                          style={{ background: 'transparent', border: 'none', color: '#ff5252', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', minWidth: '28px', minHeight: '28px' }}
                          title={t.social_cancel_invite || 'Daveti İptal Et'}
                          aria-label={`${invitedName} davetini iptal et`}
                        >
                          ✕
                        </button>
                      </div>
                    )) : (
                      <button
                        type="button"
                        className="lobby-player-row empty"
                        style={{ cursor: 'pointer', width: '100%', textAlign: 'left', font: 'inherit', color: 'inherit' }}
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
                        <div className="player-avatar-mini" aria-hidden="true">+</div>
                        <div className="player-info-mini">
                          <div className="player-name-mini">{t.social_empty_slot || 'Boş Yuva'}</div>
                          <div className="player-status-mini">{t.social_invite_btn || 'Davet Et'}</div>
                        </div>
                      </button>
                    )}
                  </>
                ) : (
                  <div style={{ padding: '20px 10px', fontSize: '13px', color: '#aaa', textAlign: 'center' }}>
                    {t.social_login_required || 'Grup üyelerini görmek için lütfen giriş yapın.'}
                  </div>
                )}
              </div>
            </div>

            {/* 2. ARKADAŞLAR SEKME İÇERİĞİ */}
            <div id="social-friends-content" className="social-tab-content" role="tabpanel">
              <form className="friends-search" onSubmit={handleAddFriend} style={{ display: 'flex', gap: '6px', alignItems: 'center' }} noValidate>
                <label htmlFor="friend-add-input" className="sr-only">Arkadaş kullanıcı adı</label>
                <input
                  id="friend-add-input"
                  type="text"
                  autoComplete="off"
                  maxLength={24}
                  placeholder={t.social_add_friend_placeholder || 'Kullanıcı adı girin...'}
                  className="search-input-field"
                  value={friendSearchInput}
                  aria-invalid={friendFeedback.type === 'error'}
                  aria-describedby="friend-feedback"
                  onChange={(e) => { setFriendSearchInput(e.target.value); if (friendFeedback.text) setFriendFeedback({ type: '', text: '' }); }}
                  style={{ flex: 1, minWidth: 0 }}
                />
                <button
                  type="submit"
                  disabled={friendAddLoading}
                  aria-busy={friendAddLoading}
                  style={{
                    background: 'linear-gradient(135deg, #00e5ff, #0288d1)',
                    border: 'none',
                    color: '#000',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontWeight: '800',
                    fontSize: '12px',
                    cursor: friendAddLoading ? 'wait' : 'pointer',
                    whiteSpace: 'nowrap',
                    minHeight: '32px'
                  }}
                >
                  {friendAddLoading ? '...' : (t.social_add_friend_btn || '+ Ekle')}
                </button>
              </form>
              <div
                id="friend-feedback"
                role={friendFeedback.type === 'error' ? 'alert' : 'status'}
                aria-live="polite"
                className={`friend-feedback ${friendFeedback.type}`}
              >
                {friendFeedback.text}
              </div>

              <div className="friends-list-wrapper">
                {social.friendsError && (
                  <div className="friend-section-empty" role="alert">
                    {social.friendsError}{' '}
                    <button type="button" className="link-button" onClick={social.loadFriends}>Tekrar dene</button>
                  </div>
                )}

                {isLoggedIn && social.friendsLoading && social.friends.length === 0 && !social.friendsError && (
                  <div aria-busy="true" aria-label="Arkadaşlar yükleniyor">
                    {[0, 1, 2].map(i => <div key={i} className="friend-row skeleton-row" />)}
                  </div>
                )}

                {social.grouped.incoming.length > 0 && (
                  <>
                    <div className="friend-section-title incoming">GELEN İSTEKLER ({social.grouped.incoming.length})</div>
                    {social.grouped.incoming.map(f => (
                      <div key={f.id} className="friend-row">
                        <div className="friend-avatar"><Avatar value={f.avatar} fallback={f.username?.[0]?.toUpperCase()} /></div>
                        <div className="friend-info">
                          <div className="friend-name">{f.username}</div>
                          <div className="friend-status">Arkadaşlık isteği</div>
                        </div>
                        <div className="friend-actions">
                          <button type="button" disabled={!!pendingAction} style={smallButton('linear-gradient(135deg, #2ecc71, #27ae60)', '#fff')}
                            onClick={() => runFriendAction(`accept:${f.friend_id}`, () => social.acceptFriend(f.friend_id), `${f.username} artık arkadaşın! 🎉`)}>
                            Kabul Et
                          </button>
                          <button type="button" disabled={!!pendingAction} style={smallButton('rgba(255, 82, 82, 0.15)', '#ff5252')} aria-label={`${f.username} isteğini reddet`}
                            onClick={() => runFriendAction(`reject:${f.friend_id}`, () => social.rejectFriend(f.friend_id), 'İstek reddedildi.')}>
                            Reddet
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {social.grouped.outgoing.length > 0 && (
                  <>
                    <div className="friend-section-title">GÖNDERİLEN İSTEKLER ({social.grouped.outgoing.length})</div>
                    {social.grouped.outgoing.map(f => (
                      <div key={f.id} className="friend-row offline">
                        <div className="friend-avatar"><Avatar value={f.avatar} fallback={f.username?.[0]?.toUpperCase()} /></div>
                        <div className="friend-info">
                          <div className="friend-name">{f.username}</div>
                          <div className="friend-status">Yanıt bekleniyor</div>
                        </div>
                        <div className="friend-actions">
                          <button type="button" disabled={!!pendingAction} style={smallButton('rgba(255,255,255,0.08)', '#ddd')}
                            onClick={() => runFriendAction(`cancel:${f.friend_id}`, () => social.removeFriend(f.friend_id), 'İstek geri çekildi.')}>
                            Geri Çek
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                <div className="friend-section-title accepted">ARKADAŞLAR ({acceptedFriends.length})</div>
                {acceptedFriends.length > 0 ? (
                  acceptedFriends.map(friend => {
                    const isInvited = invitedFriends.includes(friend.username);
                    const unreadCount = social.unread[friend.friend_id] || 0;
                    return (
                      <div key={friend.id} className={`friend-row ${friend.online ? 'online' : 'offline'}`}>
                        <div className="friend-avatar">
                          <Avatar value={friend.avatar} fallback={friend.username?.[0]?.toUpperCase()} />
                          {friend.online && <span className="online-indicator" aria-hidden="true"></span>}
                        </div>
                        <div className="friend-info">
                          <div className="friend-name">{friend.username}</div>
                          <div className="friend-status">{friend.online ? 'Çevrimiçi' : 'Çevrimdışı'}</div>
                        </div>
                        <div className="friend-actions">
                          <button
                            type="button"
                            onClick={() => sendGameInvite(friend)}
                            disabled={pendingAction === `invite:${friend.friend_id}`}
                            style={isInvited
                              ? { ...smallButton('rgba(255, 183, 77, 0.2)', '#ffb74d'), border: '1px solid #ffb74d' }
                              : smallButton('linear-gradient(135deg, #00e5ff, #0288d1)')}
                          >
                            {isInvited ? (t.social_invited || 'Davet Edildi') : (t.social_invite_btn || 'Davet Et')}
                          </button>
                          <button
                            type="button"
                            className="icon-button"
                            onClick={(e) => { e.stopPropagation(); openPrivateChat(friend); }}
                            title={`${friend.username} ile sohbet et`}
                            aria-label={`${friend.username} ile sohbet et${unreadCount ? `, ${unreadCount} okunmamış mesaj` : ''}`}
                          >
                            💬
                            {unreadCount > 0 && <span className="social-badge" aria-hidden="true">{unreadCount}</span>}
                          </button>
                          <button
                            type="button"
                            className="icon-button danger"
                            disabled={!!pendingAction}
                            onClick={() => handleRemoveFriend(friend)}
                            title="Arkadaşlıktan çıkar"
                            aria-label={`${friend.username} arkadaşlıktan çıkar`}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="friend-row offline">
                    <div className="friend-avatar" aria-hidden="true">👤</div>
                    <div className="friend-info">
                      <div className="friend-name">{isLoggedIn ? 'Henüz arkadaş yok' : 'Giriş yapılmadı'}</div>
                      <div className="friend-status">{isLoggedIn ? 'Kullanıcı adıyla arkadaş ekleyebilirsin' : 'Arkadaşlarını görmek için giriş yap'}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button className="btn-lobby-exit" onClick={() => {window.closeApp()}}>OYUNDAN ÇIK</button>
        </aside>

        {/* Sol Alt Canlı Sohbet Barı (arkadaşlara özel mesaj) */}
        {isLoggedIn && (
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
            {showChatLog && (
              <div style={{
                background: 'rgba(9, 11, 14, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '6px 6px 0 0',
                padding: '8px 10px',
                maxHeight: '160px',
                width: '100%',
                boxSizing: 'border-box',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                boxShadow: '0 -6px 20px rgba(0,0,0,0.6)'
              }} ref={chatLogRef} role="log" aria-live="polite" aria-label={activeFriend ? `${activeFriend.username} ile sohbet` : 'Sohbet'}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '3px', marginBottom: '2px' }}>
                  <span style={{ fontSize: '10px', fontWeight: '800', color: '#e573a7' }}>
                    💬 {activeFriend ? `ÖZEL: ${activeFriend.username}` : 'ALICI SEÇİN'}
                  </span>
                  <button type="button" onClick={() => setShowChatLog(false)} aria-label="Sohbeti küçült" style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '11px', minWidth: '24px', minHeight: '24px' }}>✕</button>
                </div>

                {!activeFriend && (
                  <div style={{ fontSize: '11px', color: '#888' }}>
                    {acceptedFriends.length ? 'Mesaj göndermek için aşağıya bir arkadaşının adını yaz.' : 'Mesajlaşmak için önce arkadaş ekle.'}
                  </div>
                )}
                {activeFriend && social.conversationLoading && activeMessages.length === 0 && (
                  <div style={{ fontSize: '11px', color: '#888' }} aria-busy="true">Mesajlar yükleniyor...</div>
                )}
                {activeFriend && !social.conversationLoading && activeMessages.length === 0 && (
                  <div style={{ fontSize: '11px', color: '#888' }}>Henüz mesaj yok. İlk mesajı sen gönder!</div>
                )}
                {activeMessages.map(msg => {
                  const mine = msg.sender_id === user?.id;
                  const senderName = mine ? (user?.username || 'Siz') : activeFriend?.username;
                  return (
                    <div key={msg.id} style={{ fontSize: '11px', lineHeight: '1.3', wordBreak: 'break-word' }}>
                      <span style={{ fontSize: '9px', color: '#888', marginRight: '4px' }}>[{formatTime(msg.created_at)}]</span>
                      <span style={{ fontWeight: '800', color: mine ? '#e573a7' : '#00e5ff', marginRight: '4px' }}>{senderName}:</span>
                      <span style={{ color: msg.kind === 'game_invite' ? '#ffb74d' : '#eee' }}>{msg.body}</span>
                      {msg.kind === 'game_invite' && !mine && (
                        <button type="button" onClick={() => acceptInvite({ ...msg, sender_username: activeFriend?.username })} style={{ ...smallButton('#2ecc71', '#fff'), marginLeft: '6px', minHeight: '22px', padding: '2px 8px' }}>Katıl</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ position: 'relative', width: '100%', boxSizing: 'border-box' }}>
              {/* Autocomplete Popup */}
              {!activeFriend && chatTargetInput.trim() && matchingFriends.length > 0 && (
                <div role="listbox" aria-label="Arkadaş önerileri" style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '0',
                  marginBottom: '2px',
                  display: 'flex',
                  flexDirection: 'column',
                  width: '140px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
                  zIndex: 110
                }}>
                  {matchingFriends.slice(0, 3).map((friend, idx) => (
                    <button
                      type="button"
                      role="option"
                      aria-selected={idx === 0}
                      key={friend.friend_id}
                      onClick={() => selectChatTarget(friend)}
                      style={{
                        background: idx === 0 ? '#d4719e' : '#71717a',
                        color: '#ffffff',
                        padding: '6px 8px',
                        fontSize: '11px',
                        fontWeight: '600',
                        fontFamily: "'Outfit', sans-serif",
                        cursor: 'pointer',
                        border: 'none',
                        textAlign: 'left'
                      }}
                    >
                      {friend.username}
                    </button>
                  ))}
                </div>
              )}

              {chatError && (
                <div id="chat-error" role="alert" style={{ background: 'rgba(255, 82, 82, 0.15)', color: '#ff8a80', fontSize: '11px', padding: '4px 8px', border: '1px solid rgba(255, 82, 82, 0.3)', borderBottom: 'none' }}>
                  {chatError}
                </div>
              )}

              <form
                onSubmit={handleSendChatMessage}
                style={{
                  background: 'rgba(9, 11, 14, 0.95)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  minHeight: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 8px',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              >
                {activeFriend ? (
                  <button
                    type="button"
                    onClick={() => { social.openConversation(null); setChatTargetInput(''); setChatError(''); }}
                    style={{ background: '#d4719e', color: '#fff', padding: '2px 6px', borderRadius: '2px', fontWeight: '700', fontSize: '12px', marginRight: '8px', cursor: 'pointer', border: 'none' }}
                    title="Alıcıyı Değiştir"
                    aria-label={`Alıcı: ${activeFriend.username}. Değiştirmek için tıklayın`}
                  >
                    {activeFriend.username}
                  </button>
                ) : (
                  <label htmlFor="chat-target-input" style={{ color: '#e573a7', fontWeight: '700', fontSize: '13px', marginRight: '6px', userSelect: 'none' }}>
                    Kime:
                  </label>
                )}

                {!activeFriend ? (
                  <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                    <input
                      id="chat-target-input"
                      type="text"
                      autoComplete="off"
                      value={chatTargetInput}
                      onChange={(e) => { setChatTargetInput(e.target.value); setChatError(''); }}
                      onFocus={() => setShowChatLog(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Tab' || e.key === 'Enter') {
                          if (matchingFriends.length > 0 && chatTargetInput.trim()) {
                            e.preventDefault();
                            selectChatTarget(matchingFriends[0]);
                          } else if (e.key === 'Enter') {
                            e.preventDefault();
                            setChatError(acceptedFriends.length ? 'Bu isimde bir arkadaşın yok.' : 'Mesajlaşmak için önce arkadaş ekle.');
                          }
                        }
                      }}
                      aria-describedby={chatError ? 'chat-error' : undefined}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        color: '#ffffff',
                        fontSize: '13px',
                        fontFamily: "'Outfit', sans-serif",
                        flex: 1,
                        minWidth: 0
                      }}
                    />
                    <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '11px', marginLeft: '10px', userSelect: 'none', pointerEvents: 'none', whiteSpace: 'nowrap' }} className="chat-hint">
                      Tamamlamak için: [TAB]
                    </span>
                  </div>
                ) : (
                  <>
                    <label htmlFor="chat-message-input" className="sr-only">{`${activeFriend.username} kullanıcısına mesaj`}</label>
                    <input
                      id="chat-message-input"
                      type="text"
                      autoComplete="off"
                      maxLength={MAX_MESSAGE_LENGTH}
                      placeholder="Mesaj yazın ve Enter'a basın..."
                      value={chatText}
                      onChange={(e) => { setChatText(e.target.value); if (chatError) setChatError(''); }}
                      onFocus={() => setShowChatLog(true)}
                      aria-invalid={!!chatError}
                      aria-describedby={chatError ? 'chat-error' : undefined}
                      disabled={chatSending}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        color: '#ffffff',
                        fontSize: '13px',
                        fontFamily: "'Outfit', sans-serif"
                      }}
                    />
                    <button type="submit" disabled={chatSending || !chatText.trim()} aria-label="Mesajı gönder" style={{ background: 'transparent', border: 'none', color: chatText.trim() ? '#00e5ff' : '#555', cursor: chatText.trim() ? 'pointer' : 'default', fontSize: '14px', minWidth: '28px', minHeight: '28px' }}>
                      {chatSending ? '…' : '➤'}
                    </button>
                  </>
                )}
              </form>
            </div>
          </div>
        )}
        <SiteFooter language={language} compact className="menu-footer-links" />
        <script
          type="application/ld+json"
          // Yapılandırılmış veri: web üzerinden oynanan bir video oyunu (LocalBusiness değildir).
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'VideoGame',
            name: SITE_NAME,
            alternateName: 'FT26',
            url: SITE_URL,
            description: SITE_DESCRIPTION,
            genre: ['Strategy', 'Board game', 'Sports'],
            gamePlatform: 'Web browser',
            applicationCategory: 'Game',
            inLanguage: ['tr', 'en'],
            playMode: ['SinglePlayer', 'MultiPlayer'],
            image: `${SITE_URL}/og-image.jpg`
          }) }}
        />
      </main>

      <div className="game-wrap" id="app" style={{display: 'none'}}>

        {/* ÜST HUD: tur, sıra, süre ve olay kartı (ekran uzayında, her zaman okunaklı) */}
        <div className="topbar">
          <div className="game-status-card" role="status" aria-live="polite">
            <span className="turn-badge" id="turn-badge">TUR 1</span>
            <span className="phase-label" id="phase-label">Zar Bekleniyor...</span>
            <span className="status-divider" aria-hidden="true"></span>
            <span className="timer-chip" aria-label="Kalan süre">
              <span aria-hidden="true">⏱</span>
              <span id="timer-val">30:00</span>
            </span>
          </div>
          <div className="event-card">
            <p className="tutorial-text" id="tutorial-text">Oyunun amacı mülk satın almak ve zenginleşmektir.</p>
          </div>
        </div>

        {/* İZOMETRİK TAHTA ALANI */}
        <div className="board-wrap">
          <div className="board-3d-container" id="board-3d-container">
            <div className="board-grid" id="board-grid"></div>
          </div>
          {/* 3D katman tahtanın dışında, ekran uzayında: modeller tahtada ayakta durur */}
          <canvas id="three-canvas" aria-hidden="true"></canvas>
        </div>

        {/* YAN PANEL (Şehirler / Olaylar) */}
        <aside className="side-panel" id="side-panel" aria-label="Şehirler ve olaylar">
          <button type="button" className="side-panel-toggle" aria-controls="side-panel" onClick={() => {document.getElementById('side-panel').classList.toggle('open')}}>
            <span aria-hidden="true">📋</span> Menü
          </button>
          <div className="panel-tabs" role="tablist">
            <button type="button" role="tab" className="ptab active" onClick={(e) => {window.switchTab('props',e.currentTarget)}}>Şehirler</button>
            <button type="button" role="tab" className="ptab" onClick={(e) => {window.switchTab('log',e.currentTarget)}}>Olaylar</button>
          </div>
          <div className="panel-body" id="panel-body"></div>
        </aside>

        {/* OYUNCU KARTLARI (köşeler) */}
        <div className="hud-players" id="hud-players"></div>

        {/* ALT ORTA KONTROLLER (Zar At ve Sırayı Geç) */}
        <div className="hud-center-controls">
          <div className="dice-result" id="dice-result" aria-live="polite"></div>
          <div className="hud-control-row">
            <button type="button" className="game-btn game-btn-primary" id="btn-roll" onClick={() => {window.rollDice()}}>
              <span aria-hidden="true">🎲</span> ZAR AT
            </button>
            <button type="button" className="game-btn game-btn-secondary" id="btn-end" onClick={() => {window.endTurn()}} style={{display: 'none'}}>
              Sırayı Geç <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>

        {/* SAĞ AKSİYON BUTONLARI */}
        <div className="hud-right-actions">
          <button type="button" className="btn-round-action" onClick={() => {window.toggleTheme()}} title="Tema Değiştir" aria-label="Tema değiştir" id="btn-theme">🌙</button>
          <button type="button" className="btn-round-action" onClick={() => {window.openSettings()}} title="Ayarlar" aria-label="Oyun ayarları">⚙️</button>
          <button type="button" className="btn-round-action" onClick={() => {window.toggleFullscreen()}} title="Tam Ekran" aria-label="Tam ekran">⛶</button>
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
