'use client';
import { useEffect, useState } from 'react';
import useSession from '../shared/useSession.js';
import PageShell from '../shared/PageShell.jsx';
import apiService from '../../../services/ApiService.js';

export default function ProfilePage() {
  const { isLoggedIn, user: sessionUser, stats, setStats, language, mounted, gameReady, t, apiService: api } = useSession();
  const [user, setUser] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState('🐐');
  const [tempAvatar, setTempAvatar] = useState('🐐');

  const LEVELS = [
    { level: 1, xpRequired: 0 },
    { level: 2, xpRequired: 1000 },
    { level: 3, xpRequired: 2500 },
    { level: 4, xpRequired: 4500 },
    { level: 5, xpRequired: 7000 },
    { level: 6, xpRequired: 10000 },
    { level: 7, xpRequired: 14000 },
    { level: 8, xpRequired: 19000 },
    { level: 9, xpRequired: 25000 },
    { level: 10, xpRequired: 32000 }
  ];

  const AVATAR_OPTIONS = [
    { type: 'emoji', value: '🐐', name: 'Keçi' },
    { type: 'emoji', value: '🦁', name: 'Aslan' },
    { type: 'emoji', value: '🐯', name: 'Kaplan' },
    { type: 'emoji', value: '🦅', name: 'Kartal' },
    { type: 'emoji', value: '👑', name: 'Kral' },
    { type: 'emoji', value: '👤', name: 'Varsayılan' },
    { type: 'image', value: '/assets/messi.png', name: 'Messi' },
    { type: 'image', value: '/assets/ronaldo.png', name: 'Ronaldo' },
    { type: 'image', value: '/assets/haaland.png', name: 'Haaland' },
    { type: 'image', value: '/assets/mbappe.png', name: 'Mbappe' }
  ];

  const handleSaveAvatar = async () => {
    try {
      const res = await apiService.updateAvatar(tempAvatar);
      if (res && res.error) {
        alert("Avatar güncellenemedi: " + res.error);
        console.error("Avatar güncelleme API hatası:", res.error);
        return;
      }
      setSelectedAvatar(tempAvatar);
      setUser(prev => ({ ...prev, avatar: tempAvatar }));
      setShowAvatarModal(false);
    } catch (e) {
      console.error("Avatar kaydetme hatası:", e);
      alert("Avatar kaydetme hatası: " + e.message);
    }
  };

  // sessionUser değiştiğinde yerel user state'ini güncelle
  useEffect(() => {
    if (sessionUser) {
      setUser(sessionUser);
      setSelectedAvatar(sessionUser.avatar || '🐐');
      setTempAvatar(sessionUser.avatar || '🐐');
    }
  }, [sessionUser]);

  // game.js hazır olunca profil verilerini yükle
  useEffect(() => {
    if (!gameReady) return;

    if (isLoggedIn && sessionUser) {
      (async () => {
        try {
          const meRes = await apiService.getMe();
          if (meRes && !meRes.error) {
            setUser(meRes);
            setSelectedAvatar(meRes.avatar || '🐐');
            setTempAvatar(meRes.avatar || '🐐');
          }
          
          const purchasesRes = await apiService.getMyPurchases();
          if (Array.isArray(purchasesRes)) {
            setPurchases(purchasesRes);
          }
        } catch (e) {
          console.error("Profil yükleme hatası:", e);
        }
        setLoading(false);
      })();
    } else {
      setLoading(false);
    }
  }, [gameReady, isLoggedIn, sessionUser]);

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

  const prevLevelXp = LEVELS[currentLevel - 1]?.xpRequired || 0;
  const xpInCurrentLevel = currentXp - prevLevelXp;
  const xpNeededForNext = nextLevelXp - prevLevelXp;
  const progressPercent = xpNeededForNext > 0 ? Math.min(100, (xpInCurrentLevel / xpNeededForNext) * 100) : 100;

  return (
    <PageShell activePage="profile" stats={stats} t={t} mounted={mounted}>
        <div className="menu-dynamic-screen">
          <div className="dynamic-screen-header" style={{display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '2px solid rgba(41, 182, 246, 0.3)'}}>
            <button className="btn-mode-back" onClick={() => {window.location.href='/'}} style={{margin: '0', padding: '6px 12px', fontSize: '12px'}}>← {t.back}</button>
            <span style={{ textShadow: '0 0 10px rgba(41, 182, 246, 0.4)' }}>{t.profile_title}</span>
          </div>
          <div className="dynamic-screen-body" style={{marginTop: '20px'}}>
            {loading ? (
              <div style={{color: '#fff', textAlign: 'center', padding: '40px'}}>{t.loading}</div>
            ) : !isLoggedIn ? (
              <div style={{color: '#aaa', textAlign: 'center', padding: '40px'}}>{t.profile_login_required}</div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '320px 1fr',
                gap: '24px',
                color: '#fff'
              }}>
                {/* Sol Kısım: Kart ve Avatar (VALORANT tarzı premium kart) */}
                <div style={{
                  background: 'linear-gradient(145deg, rgba(20, 24, 33, 0.9) 0%, rgba(10, 12, 17, 0.95) 100%)',
                  border: '1px solid rgba(41, 182, 246, 0.3)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
                  borderRadius: '16px',
                  padding: '30px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  {/* Dekoratif Gradient Çizgiler */}
                  <div style={{
                    position: 'absolute',
                    top: '0',
                    left: '0',
                    width: '100%',
                    height: '4px',
                    background: 'linear-gradient(90deg, #29b6f6, #ff7043)'
                  }}></div>

                  {/* Avatar Halkası */}
                  <div style={{
                    position: 'relative',
                    width: '120px',
                    height: '120px',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <div style={{
                      position: 'absolute',
                      inset: '0',
                      borderRadius: '50%',
                      padding: '4px',
                      background: 'linear-gradient(135deg, #29b6f6, #ff7043)',
                      boxShadow: '0 0 20px rgba(41, 182, 246, 0.4)',
                      animation: 'spin 10s linear infinite'
                    }}>
                      <div style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '50%',
                        background: '#0d1117'
                      }}></div>
                    </div>
                    <div style={{
                      zIndex: 2,
                      width: '100px',
                      height: '100px',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#0d1117'
                    }}>
                      {selectedAvatar.startsWith('/') ? (
                        <img src={selectedAvatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: '50px' }}>{selectedAvatar}</span>
                      )}
                    </div>
                  </div>

                  <button onClick={() => { setTempAvatar(selectedAvatar); setShowAvatarModal(true); }} style={{
                    background: 'rgba(41, 182, 246, 0.15)',
                    border: '1px solid rgba(41, 182, 246, 0.3)',
                    color: '#29b6f6',
                    padding: '6px 16px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    marginTop: '-10px',
                    marginBottom: '15px',
                    transition: 'all 0.2s',
                    outline: 'none'
                  }} className="avatar-change-btn">
                    Avatar Değiştir
                  </button>

                  <h2 style={{
                    fontSize: '24px',
                    fontWeight: '800',
                    margin: '0 0 4px 0',
                    background: 'linear-gradient(135deg, #29b6f6, #00e5ff)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    textShadow: '0 2px 10px rgba(41, 182, 246, 0.2)'
                  }}>{user?.username}</h2>
                  <p style={{fontSize: '13px', color: '#8892b0', margin: '0 0 24px 0', fontWeight: '500'}}>{user?.email}</p>
                  
                  {/* Seviye ve XP Bilgisi */}
                  <div style={{
                    width: '100%',
                    background: 'rgba(0, 0, 0, 0.25)',
                    border: '1px solid rgba(255,255,255,0.03)',
                    borderRadius: '12px',
                    padding: '16px',
                    boxSizing: 'border-box'
                  }}>
                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '13px', fontWeight: 'bold'}}>
                      <span style={{color: '#29b6f6'}}>{t.level_display.replace('{level}', currentLevel).toUpperCase()}</span>
                      <span style={{color: '#ff7043'}}>{currentXp} XP</span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: '8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)'
                    }}>
                      <div style={{
                        width: `${progressPercent}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #29b6f6, #00e5ff)',
                        borderRadius: '4px',
                        boxShadow: '0 0 8px rgba(0,229,255,0.5)'
                      }}></div>
                    </div>
                    <div style={{fontSize: '11px', color: '#8892b0', marginTop: '8px', textAlign: 'right', fontWeight: '500'}}>
                      {t.profile_next_level} <span style={{color: '#fff'}}>{nextLevelXp - currentXp} XP</span>
                    </div>
                  </div>
                </div>

                {/* Sağ Kısım: Detaylı İstatistikler & Eşyalar */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                  minWidth: '0'
                }}>
                  {/* İstatistikler Paneli */}
                  <div style={{
                    background: 'linear-gradient(145deg, rgba(20, 24, 33, 0.85) 0%, rgba(13, 16, 23, 0.9) 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    padding: '24px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
                  }}>
                    <h3 style={{
                      fontSize: '18px',
                      fontWeight: '800',
                      margin: '0 0 20px 0',
                      borderBottom: '1px solid rgba(255,255,255,0.08)',
                      paddingBottom: '10px',
                      color: '#29b6f6',
                      letterSpacing: '1px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      {t.profile_club_stats}
                    </h3>
                    
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '14px'
                    }}>
                      <div style={{
                        background: 'rgba(46, 204, 113, 0.03)',
                        border: '1px solid rgba(46, 204, 113, 0.1)',
                        padding: '16px',
                        borderRadius: '12px',
                        boxShadow: 'inset 0 0 15px rgba(0,0,0,0.2)',
                        transition: 'transform 0.2s',
                        cursor: 'default'
                      }}>
                        <div style={{fontSize: '11px', color: '#8892b0', marginBottom: '6px', fontWeight: '600', letterSpacing: '0.5px'}}>{t.profile_total_earnings}</div>
                        <div style={{fontSize: '22px', fontWeight: '800', color: '#2ecc71'}}>₺{(stats.total_earnings || 0).toLocaleString()}</div>
                      </div>
                      <div style={{
                        background: 'rgba(46, 204, 113, 0.03)',
                        border: '1px solid rgba(46, 204, 113, 0.1)',
                        padding: '16px',
                        borderRadius: '12px',
                        boxShadow: 'inset 0 0 15px rgba(0,0,0,0.2)'
                      }}>
                        <div style={{fontSize: '11px', color: '#8892b0', marginBottom: '6px', fontWeight: '600', letterSpacing: '0.5px'}}>{t.profile_highest_money}</div>
                        <div style={{fontSize: '22px', fontWeight: '800', color: '#2ecc71'}}>₺{(stats.highest_money || 0).toLocaleString()}</div>
                      </div>
                      <div style={{
                        background: 'rgba(245, 208, 97, 0.03)',
                        border: '1px solid rgba(245, 208, 97, 0.1)',
                        padding: '16px',
                        borderRadius: '12px',
                        boxShadow: 'inset 0 0 15px rgba(0,0,0,0.2)'
                      }}>
                        <div style={{fontSize: '11px', color: '#8892b0', marginBottom: '6px', fontWeight: '600', letterSpacing: '0.5px'}}>{t.profile_wins}</div>
                        <div style={{fontSize: '22px', fontWeight: '800', color: '#f5d061'}}>{stats.wins || 0}</div>
                      </div>
                      <div style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        padding: '16px',
                        borderRadius: '12px'
                      }}>
                        <div style={{fontSize: '11px', color: '#8892b0', marginBottom: '6px', fontWeight: '600', letterSpacing: '0.5px'}}>{t.profile_games_played}</div>
                        <div style={{fontSize: '22px', fontWeight: '800', color: '#fff'}}>{stats.games_played || 0}</div>
                      </div>
                      <div style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        padding: '16px',
                        borderRadius: '12px'
                      }}>
                        <div style={{fontSize: '11px', color: '#8892b0', marginBottom: '6px', fontWeight: '600', letterSpacing: '0.5px'}}>{t.profile_total_properties}</div>
                        <div style={{fontSize: '22px', fontWeight: '800', color: '#fff'}}>{stats.total_properties || 0}</div>
                      </div>
                      <div style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        padding: '16px',
                        borderRadius: '12px'
                      }}>
                        <div style={{fontSize: '11px', color: '#8892b0', marginBottom: '6px', fontWeight: '600', letterSpacing: '0.5px'}}>{t.profile_total_turns}</div>
                        <div style={{fontSize: '22px', fontWeight: '800', color: '#fff'}}>{stats.total_turns || 0}</div>
                      </div>
                    </div>
                  </div>

                  {/* Sahip Olunan Eşyalar */}
                  <div style={{
                    background: 'linear-gradient(145deg, rgba(20, 24, 33, 0.85) 0%, rgba(13, 16, 23, 0.9) 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    padding: '24px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
                  }}>
                    <h3 style={{
                      fontSize: '18px',
                      fontWeight: '800',
                      margin: '0 0 16px 0',
                      borderBottom: '1px solid rgba(255,255,255,0.08)',
                      paddingBottom: '10px',
                      color: '#29b6f6',
                      letterSpacing: '1px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      {t.profile_owned_items}
                    </h3>
                    {purchases.length === 0 ? (
                      <div style={{color: '#8892b0', fontSize: '13px', textAlign: 'center', padding: '20px 0'}}>
                        {t.profile_no_owned_items}
                      </div>
                    ) : (
                      <div style={{display: 'flex', flexWrap: 'wrap', gap: '10px'}}>
                        {purchases.map((p, idx) => (
                          <div key={idx} style={{
                            background: 'rgba(41, 182, 246, 0.08)',
                            border: '1px solid rgba(41, 182, 246, 0.25)',
                            padding: '10px 20px',
                            borderRadius: '30px',
                            fontSize: '13px',
                            fontWeight: '600',
                            color: '#00e5ff',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 15px rgba(0, 229, 255, 0.05)'
                          }}>
                            <span style={{ fontSize: '16px' }}>🎁</span>
                            <span>{p.store_items?.name || p.item_name || 'Özel Eşya'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      {showAvatarModal && (
        <div className="modal-backdrop" style={{ zIndex: 1000 }}>
          <div className="modal" style={{ maxWidth: '400px' }}>
            <div className="modal-head">
              <div className="modal-city">AVATAR SEÇİN</div>
            </div>
            <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', padding: '20px', justifyItems: 'center' }}>
              {AVATAR_OPTIONS.map((opt, index) => (
                <div 
                  key={index} 
                  onClick={() => setTempAvatar(opt.value)}
                  style={{
                    border: tempAvatar === opt.value ? '2px solid #29b6f6' : '1px solid rgba(255,255,255,0.1)',
                    background: tempAvatar === opt.value ? 'rgba(41, 182, 246, 0.15)' : 'rgba(255,255,255,0.02)',
                    borderRadius: '8px',
                    width: '56px',
                    height: '56px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '28px',
                    overflow: 'hidden',
                    transition: 'all 0.2s'
                  }}
                  className="avatar-opt-card"
                  title={opt.name}
                >
                  {opt.type === 'image' ? (
                    <img src={opt.value} alt={opt.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    opt.value
                  )}
                </div>
              ))}
            </div>
            <div className="modal-btns" style={{ padding: '0 20px 20px', display: 'flex', gap: '10px' }}>
              <button className="mbtn mbtn-buy" style={{ flex: 1 }} onClick={handleSaveAvatar}>
                Kaydet
              </button>
              <button className="mbtn mbtn-pass" style={{ flex: 1 }} onClick={() => setShowAvatarModal(false)}>
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
