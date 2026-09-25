'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import useSession from '../shared/useSession.js';
import PageShell from '../shared/PageShell.jsx';
import EmptyState from '../shared/EmptyState.jsx';
import { getPlayerByKey } from '../../../js/data/playerCatalog.js';
import apiService from '../../../services/ApiService.js';

// backend/routes/auth.js MAX_AVATAR_DATA_URL_LENGTH ile aynı olmalıdır.
const MAX_AVATAR_DATA_URL_LENGTH = 32_000;

export default function ProfilePage() {
  const { isLoggedIn, user: sessionUser, stats, language, gameReady, t } = useSession();
  const [user, setUser] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState('👤');
  const [tempAvatar, setTempAvatar] = useState('👤');
  const [equippedItems, setEquippedItems] = useState({});

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ft26_equipped_items');
      if (saved) {
        try { setEquippedItems(JSON.parse(saved)); } catch (e) { }
      }
    }
  }, []);

  // Oyunda kullanılacak karakter sunucuda saklanır; çevrimiçi rakip de bu modeli görür.
  const [characterStatus, setCharacterStatus] = useState({ key: '', text: '', error: false });
  const selectCharacter = async (characterKey) => {
    if (characterStatus.key === 'pending') return;
    setCharacterStatus({ key: 'pending', text: '', error: false });
    const res = await apiService.selectCharacter(characterKey);
    if (res?.error) {
      setCharacterStatus({ key: characterKey, text: res.error, error: true });
      return;
    }
    setUser(prev => ({ ...prev, selected_character: res.selected_character }));
    setCharacterStatus({ key: characterKey, text: language === 'English' ? 'Your pawn in matches is updated.' : 'Maçlardaki piyonun güncellendi.', error: false });
  };

  const toggleEquip = (itemId) => {
    setEquippedItems(prev => {
      const updated = { ...prev, [itemId]: !prev[itemId] };
      if (typeof window !== 'undefined') {
        localStorage.setItem('ft26_equipped_items', JSON.stringify(updated));
      }
      return updated;
    });
  };

  // Fotoğraf kırpma ve konumlandırma state'leri
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [cropImgSize, setCropImgSize] = useState({ width: 0, height: 0 });
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const generateLevels = () => {
    const levels = [{ level: 1, xpRequired: 0 }];
    let currentXp = 0;
    let step = 1000;
    for (let lvl = 2; lvl <= 100; lvl++) {
      currentXp += step;
      levels.push({ level: lvl, xpRequired: currentXp });
      if (lvl < 5) step += 500;
      else if (lvl < 20) step += 1000;
      else if (lvl < 50) step += 2000;
      else step += 3000;
    }
    return levels;
  };
  const LEVELS = generateLevels();

  const AVATAR_OPTIONS = [
    { type: 'emoji', value: '⚽', name: 'Futbol' },
    { type: 'emoji', value: '🏆', name: 'Kupa' },
    { type: 'emoji', value: '🎯', name: 'Hedef' },
    { type: 'emoji', value: '⚡', name: 'Hız' },
    { type: 'emoji', value: '👑', name: 'Kral' },
    { type: 'emoji', value: '👤', name: 'Varsayılan' }
  ];

  const isImageAvatar = (avatar) => {
    return typeof avatar === 'string' && (avatar.startsWith('/') || avatar.startsWith('data:') || avatar.startsWith('http'));
  };

  const getClampedOffset = (x, y, zoom, imgWidth, imgHeight) => {
    if (!imgWidth || !imgHeight) return { x, y };
    const CONTAINER_SIZE = 280;
    const baseScale = Math.max(CONTAINER_SIZE / imgWidth, CONTAINER_SIZE / imgHeight);
    const dispW = imgWidth * baseScale * zoom;
    const dispH = imgHeight * baseScale * zoom;

    const maxOffsetX = Math.max(0, (dispW - CONTAINER_SIZE) / 2);
    const maxOffsetY = Math.max(0, (dispH - CONTAINER_SIZE) / 2);

    return {
      x: Math.min(maxOffsetX, Math.max(-maxOffsetX, x)),
      y: Math.min(maxOffsetY, Math.max(-maxOffsetY, y))
    };
  };

  const handleFileUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Lütfen geçerli bir görsel dosyası seçin.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setCropImgSize({ width: img.width, height: img.height });
        setCropImageSrc(event.target.result);
        setCropZoom(1);
        setCropOffset({ x: 0, y: 0 });
        setShowCropModal(true);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - cropOffset.x, y: e.clientY - cropOffset.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const rawX = e.clientX - dragStart.x;
    const rawY = e.clientY - dragStart.y;
    setCropOffset(getClampedOffset(rawX, rawY, cropZoom, cropImgSize.width, cropImgSize.height));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e) => {
    const zoomStep = 0.1;
    const delta = e.deltaY < 0 ? zoomStep : -zoomStep;
    const newZoom = Math.min(3, Math.max(1, parseFloat((cropZoom + delta).toFixed(2))));

    setCropZoom(newZoom);
    setCropOffset(prev => getClampedOffset(prev.x, prev.y, newZoom, cropImgSize.width, cropImgSize.height));
  };

  const handleApplyCrop = () => {
    if (!cropImageSrc) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // Avatar arkadaş listesi ve maç ekranında da gönderildiği için küçük tutulur;
      // sunucu en fazla MAX_AVATAR_DATA_URL_LENGTH karakterlik data URL kabul eder.
      const CANVAS_SIZE = 160;
      canvas.width = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;
      const ctx = canvas.getContext('2d');

      const CONTAINER_SIZE = 280;
      const CROP_MASK_SIZE = 220;
      const baseScale = Math.max(CONTAINER_SIZE / img.width, CONTAINER_SIZE / img.height);
      const totalScale = baseScale * cropZoom * (CANVAS_SIZE / CROP_MASK_SIZE);

      const drawW = img.width * totalScale;
      const drawH = img.height * totalScale;
      const drawX = (CANVAS_SIZE / 2) + (cropOffset.x * CANVAS_SIZE / CROP_MASK_SIZE) - drawW / 2;
      const drawY = (CANVAS_SIZE / 2) + (cropOffset.y * CANVAS_SIZE / CROP_MASK_SIZE) - drawH / 2;

      ctx.fillStyle = '#0d1117';
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.drawImage(img, drawX, drawY, drawW, drawH);

      let dataUrl = '';
      for (const quality of [0.85, 0.7, 0.55, 0.4]) {
        dataUrl = canvas.toDataURL('image/jpeg', quality);
        if (dataUrl.length <= MAX_AVATAR_DATA_URL_LENGTH) break;
      }
      setTempAvatar(dataUrl);
      setShowCropModal(false);
      setCropImageSrc(null);
    };
    img.src = cropImageSrc;
  };

  const handleSaveAvatar = async () => {
    try {
      const res = await apiService.updateAvatar(tempAvatar);
      if (res && res.error) {
        alert("Avatar güncellenemedi: " + res.error);
        if (res.error.includes('token') || res.error.includes('Authorization')) {
          window.location.href = '/auth';
        }
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
      setSelectedAvatar(sessionUser.avatar || '👤');
      setTempAvatar(sessionUser.avatar || '👤');
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
            setSelectedAvatar(meRes.avatar || '👤');
            setTempAvatar(meRes.avatar || '👤');
          }

          const [purchasesRes, entitlementsRes] = await Promise.all([
            apiService.getMyPurchases(),
            apiService.getCharacterEntitlements()
          ]);
          // Futbolcular character_entitlements üzerinden doğru görsel ve bilgilerle listelendiği için
          // purchases tablosundaki ham 'Player' kayıtlarını filtreleyerek çift görünümü engelliyoruz.
          const rawItems = Array.isArray(purchasesRes) ? purchasesRes : [];
          const ownedItems = rawItems.filter(p => {
            const type = p.store_items?.type || p.item_type;
            const sku = p.store_items?.sku || p.sku || '';
            return type !== 'Player' && !sku.startsWith('player_');
          });

          const ownedCharacters = Array.isArray(entitlementsRes)
            ? entitlementsRes.map(entitlement => {
              const player = getPlayerByKey(entitlement.character_key);
              if (!player) return null;
              return {
                id: `character-${player.key}`,
                item_id: `character-${player.key}`,
                item_name: player.name,
                item_type: 'Futbolcu',
                character_key: player.key,
                character_image: player.refImage,
                purchased_at: entitlement.granted_at
              };
            }).filter(Boolean)
            : [];
          setPurchases([...ownedItems, ...ownedCharacters]);
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
    <PageShell activePage="profile" stats={stats} t={t} language={language}>
      <div className="menu-dynamic-screen">
        <div className="dynamic-screen-header" style={{ display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '2px solid rgba(41, 182, 246, 0.3)' }}>
          <button className="btn-mode-back" onClick={() => { window.location.href = '/' }} style={{ margin: '0', padding: '6px 12px', fontSize: '12px' }}>← {t.back}</button>
          <span style={{ textShadow: '0 0 10px rgba(41, 182, 246, 0.4)' }}>{t.profile_title}</span>
        </div>
        <div className="dynamic-screen-body" style={{ marginTop: '20px' }}>
          {loading ? (
            <div style={{ color: '#fff', textAlign: 'center', padding: '40px' }}>{t.loading}</div>
          ) : !isLoggedIn ? (
            <EmptyState icon="🔒" message={t.profile_login_required} actionLabel={t.login_btn || 'Giriş Yap'} actionHref="/auth?next=/profile" />
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
                    {isImageAvatar(selectedAvatar) ? (
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
                <p style={{ fontSize: '13px', color: '#8892b0', margin: '0 0 24px 0', fontWeight: '500' }}>{user?.email}</p>

                {/* Seviye ve XP Bilgisi */}
                <div style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid rgba(255,255,255,0.03)',
                  borderRadius: '12px',
                  padding: '16px',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '13px', fontWeight: 'bold' }}>
                    <span style={{ color: '#29b6f6' }}>{t.level_display.replace('{level}', currentLevel).toUpperCase()}</span>
                    <span style={{ color: '#ff7043' }}>{currentXp} XP</span>
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
                  <div style={{ fontSize: '11px', color: '#8892b0', marginTop: '8px', textAlign: 'right', fontWeight: '500' }}>
                    {t.profile_next_level} <span style={{ color: '#fff' }}>{nextLevelXp - currentXp} XP</span>
                  </div>
                  <Link href="/battlepass" style={{ display: 'inline-block', marginTop: '10px', padding: '8px 0', fontSize: '12px', fontWeight: '700', color: '#29b6f6' }}>
                    {language === 'English' ? 'View battle pass rewards →' : 'Savaş bileti ödüllerini gör →'}
                  </Link>
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
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '16px'
                  }}>
                    <div style={{
                      background: 'rgba(46, 204, 113, 0.03)',
                      border: '1px solid rgba(46, 204, 113, 0.1)',
                      padding: '18px',
                      borderRadius: '14px',
                      boxShadow: 'inset 0 0 15px rgba(0,0,0,0.2)',
                      transition: 'transform 0.2s',
                      cursor: 'default'
                    }}>
                      <div style={{ fontSize: '11px', color: '#8892b0', marginBottom: '6px', fontWeight: '600', letterSpacing: '0.5px' }}>{t.profile_total_earnings}</div>
                      <div style={{ fontSize: '24px', fontWeight: '800', color: '#2ecc71' }}>₺{(stats.total_earnings || 0).toLocaleString()}</div>
                    </div>
                    <div style={{
                      background: 'rgba(46, 204, 113, 0.03)',
                      border: '1px solid rgba(46, 204, 113, 0.1)',
                      padding: '18px',
                      borderRadius: '14px',
                      boxShadow: 'inset 0 0 15px rgba(0,0,0,0.2)'
                    }}>
                      <div style={{ fontSize: '11px', color: '#8892b0', marginBottom: '6px', fontWeight: '600', letterSpacing: '0.5px' }}>{t.profile_highest_money}</div>
                      <div style={{ fontSize: '24px', fontWeight: '800', color: '#2ecc71' }}>
                        ₺{((Number(stats.total_earnings || 0)) + purchases.reduce((acc, p) => acc + Number(p.store_items?.price || p.price || 0), 0)).toLocaleString()}
                      </div>
                    </div>
                    <div style={{
                      background: 'rgba(245, 208, 97, 0.03)',
                      border: '1px solid rgba(245, 208, 97, 0.1)',
                      padding: '18px',
                      borderRadius: '14px',
                      boxShadow: 'inset 0 0 15px rgba(0,0,0,0.2)'
                    }}>
                      <div style={{ fontSize: '11px', color: '#8892b0', marginBottom: '6px', fontWeight: '600', letterSpacing: '0.5px' }}>{t.profile_wins}</div>
                      <div style={{ fontSize: '24px', fontWeight: '800', color: '#f5d061' }}>{stats.wins || 0}</div>
                    </div>
                    <div style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      padding: '18px',
                      borderRadius: '14px'
                    }}>
                      <div style={{ fontSize: '11px', color: '#8892b0', marginBottom: '6px', fontWeight: '600', letterSpacing: '0.5px' }}>{t.profile_games_played}</div>
                      <div style={{ fontSize: '24px', fontWeight: '800', color: '#fff' }}>{stats.games_played || 0}</div>
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
                    <div style={{ color: '#8892b0', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
                      {t.profile_no_owned_items}
                    </div>
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                      gap: '16px'
                    }}>
                      {purchases.map((p, idx) => {
                        const itemId = p.item_id || p.id || p.store_items?.id || `item-${idx}`;
                        const isCharacter = !!p.character_key;
                        const isEquipped = isCharacter ? user?.selected_character === p.character_key : !!equippedItems[itemId];
                        const itemName = p.store_items?.name || p.item_name || 'Özel Eşya';
                        const rawType = p.store_items?.type || p.item_type || 'Eşya';
                        const localizedType = rawType === 'Kutu' || rawType === 'Box' ? t.store_item_box :
                                              rawType === 'Tema' || rawType === 'Theme' ? t.store_item_theme :
                                              rawType === 'Zar' || rawType === 'Dice' ? t.store_item_dice :
                                              rawType === 'Rozet' || rawType === 'Badge' ? t.store_item_badge :
                                              rawType === 'Player' || rawType === 'Futbolcu' ? (language === 'English' ? 'Player' : 'Futbolcu') : rawType;

                        const getItemImage = (name) => {
                          if (!name) return null;
                          const n = name.toLowerCase();
                          if (n.includes('piyon') || n.includes('pawn') || n.includes('kutu') || n.includes('box')) return '/assets/store_gold_pawn_box.webp';
                          if (n.includes('stadyum') || n.includes('stadium') || n.includes('tema') || n.includes('theme')) return '/assets/store_stadium_theme.webp';
                          if (n.includes('zar') || n.includes('dice') || n.includes('elmas') || n.includes('diamond')) return '/assets/store_diamond_dice.webp';
                          if (n.includes('vip') || n.includes('rozet') || n.includes('badge')) return '/assets/store_vip_badge.webp';
                          return null;
                        };
                        const imgUrl = p.character_image || getItemImage(itemName);

                        return (
                          <div key={idx} style={{
                            background: isEquipped
                              ? 'linear-gradient(145deg, rgba(46, 204, 113, 0.15) 0%, rgba(15, 35, 22, 0.65) 100%)'
                              : 'linear-gradient(145deg, rgba(20, 24, 33, 0.9) 0%, rgba(10, 12, 17, 0.95) 100%)',
                            border: isEquipped ? '1px solid #2ecc71' : '1px solid rgba(41, 182, 246, 0.25)',
                            padding: '16px 12px',
                            borderRadius: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            boxShadow: isEquipped ? '0 0 20px rgba(46, 204, 113, 0.25)' : '0 6px 20px rgba(0, 0, 0, 0.4)',
                            transition: 'all 0.25s ease'
                          }}>
                            <div style={{
                              width: '100%',
                              aspectRatio: '1/1',
                              maxWidth: '120px',
                              maxHeight: '120px',
                              borderRadius: '12px',
                              overflow: 'hidden',
                              background: '#0d1117',
                              border: isEquipped ? '1px solid rgba(46, 204, 113, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                              boxShadow: 'inset 0 0 15px rgba(0,0,0,0.6)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginBottom: '12px'
                            }}>
                              {imgUrl ? (
                                <img src={imgUrl} alt={itemName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <span style={{ fontSize: '36px' }}>🎁</span>
                              )}
                            </div>

                            <div style={{ textAlign: 'center', width: '100%', marginBottom: '12px' }}>
                              <div style={{
                                color: isEquipped ? '#2ecc71' : '#00e5ff',
                                fontWeight: '700',
                                fontSize: '13px',
                                lineHeight: '1.3',
                                marginBottom: '4px'
                              }}>
                                {itemName}
                              </div>
                              <div style={{ fontSize: '11px', color: '#8892b0', fontWeight: '500' }}>{localizedType}</div>
                            </div>

                            <button
                              type="button"
                              aria-pressed={isEquipped}
                              disabled={isCharacter && characterStatus.key === 'pending'}
                              onClick={() => (isCharacter ? selectCharacter(p.character_key) : toggleEquip(itemId))}
                              style={{
                                width: '100%',
                                background: isEquipped ? 'rgba(46, 204, 113, 0.2)' : 'rgba(41, 182, 246, 0.15)',
                                border: isEquipped ? '1px solid #2ecc71' : '1px solid #29b6f6',
                                color: isEquipped ? '#2ecc71' : '#29b6f6',
                                padding: '8px 0',
                                borderRadius: '20px',
                                fontSize: '11px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                outline: 'none',
                                boxShadow: isEquipped ? '0 0 10px rgba(46, 204, 113, 0.2)' : 'none'
                              }}
                            >
                              {isCharacter
                                ? (isEquipped ? (language === 'English' ? '✓ Your pawn' : '✓ Oyundaki piyonun') : (language === 'English' ? 'Use in matches' : 'Maçlarda kullan'))
                                : (isEquipped ? '✓ Kuşanıldı' : 'Kuşan')}
                            </button>
                            {isCharacter && characterStatus.key === p.character_key && characterStatus.text && (
                              <div role={characterStatus.error ? 'alert' : 'status'} style={{ fontSize: '11px', marginTop: '6px', color: characterStatus.error ? '#ff8a80' : '#69f0ae' }}>
                                {characterStatus.text}
                              </div>
                            )}
                          </div>
                        );
                      })}
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
            <div className="modal-body" style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', justifyItems: 'center' }}>
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
                    {isImageAvatar(opt.value) ? (
                      <img src={opt.value} alt={opt.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      opt.value
                    )}
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px', textAlign: 'center' }}>
                <label style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(41, 182, 246, 0.15)',
                  border: '1px dashed #29b6f6',
                  color: '#29b6f6',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}>
                  📷 Cihazdan Fotoğraf Yükle
                  <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
                </label>
              </div>

              {tempAvatar && isImageAvatar(tempAvatar) && !AVATAR_OPTIONS.some(o => o.value === tempAvatar) && (
                <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '12px', color: '#aaa' }}>Seçilen Fotoğraf:</span>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', overflow: 'hidden', border: '2px solid #29b6f6' }}>
                    <img src={tempAvatar} alt="Özel Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                </div>
              )}
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

      {showCropModal && (
        <div className="modal-backdrop" style={{ zIndex: 1100 }}>
          <div className="modal" style={{ maxWidth: '420px', padding: '20px' }}>
            <div className="modal-head" style={{ marginBottom: '16px', textAlign: 'center' }}>
              <div className="modal-city">FOTOĞRAFI KIRP & KONUMLANDIR</div>
            </div>

            <div
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
              onTouchStart={(e) => {
                setIsDragging(true);
                setDragStart({ x: e.touches[0].clientX - cropOffset.x, y: e.touches[0].clientY - cropOffset.y });
              }}
              onTouchMove={(e) => {
                if (!isDragging) return;
                const rawX = e.touches[0].clientX - dragStart.x;
                const rawY = e.touches[0].clientY - dragStart.y;
                setCropOffset(getClampedOffset(rawX, rawY, cropZoom, cropImgSize.width, cropImgSize.height));
              }}
              onTouchEnd={() => setIsDragging(false)}
              style={{
                width: '280px',
                height: '280px',
                margin: '0 auto',
                borderRadius: '16px',
                overflow: 'hidden',
                position: 'relative',
                border: '1px solid rgba(41, 182, 246, 0.3)',
                cursor: isDragging ? 'grabbing' : 'grab',
                userSelect: 'none',
                background: '#0a0c10'
              }}
            >
              {(() => {
                const CONTAINER_SIZE = 280;
                const MASK_SIZE = 220;
                const baseScale = cropImgSize.width && cropImgSize.height
                  ? Math.max(CONTAINER_SIZE / cropImgSize.width, CONTAINER_SIZE / cropImgSize.height)
                  : 1;
                const dispW = cropImgSize.width ? cropImgSize.width * baseScale : CONTAINER_SIZE;
                const dispH = cropImgSize.height ? cropImgSize.height * baseScale : CONTAINER_SIZE;

                const imgStyle = {
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  width: `${dispW}px`,
                  height: `${dispH}px`,
                  maxWidth: 'none',
                  maxHeight: 'none',
                  transform: `translate(-50%, -50%) translate(${cropOffset.x}px, ${cropOffset.y}px) scale(${cropZoom})`,
                  pointerEvents: 'none'
                };

                return (
                  <>
                    {/* Arka planda tam fotoğraf (Düşük Opaklık / Dimmed View) */}
                    <img
                      src={cropImageSrc}
                      alt=""
                      draggable={false}
                      style={{
                        ...imgStyle,
                        opacity: 0.35,
                        filter: 'brightness(0.7)'
                      }}
                    />

                    {/* Ortada dairesel profil resmi çerçevesi (Tam Netlik) */}
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      width: `${MASK_SIZE}px`,
                      height: `${MASK_SIZE}px`,
                      transform: 'translate(-50%, -50%)',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      border: '3px solid #29b6f6',
                      boxShadow: '0 0 20px rgba(41, 182, 246, 0.6), inset 0 0 10px rgba(0,0,0,0.5)',
                      pointerEvents: 'none'
                    }}>
                      <img
                        src={cropImageSrc}
                        alt="Kırpılacak profil fotoğrafı önizlemesi"
                        draggable={false}
                        style={{
                          ...imgStyle,
                          opacity: 1
                        }}
                      />
                    </div>
                  </>
                );
              })()}
            </div>

            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
              <label style={{ fontSize: '12px', color: '#aaa' }}>Yakınlaştırma: {cropZoom.toFixed(1)}x</label>
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={cropZoom}
                onChange={(e) => {
                  const newZoom = parseFloat(e.target.value);
                  setCropZoom(newZoom);
                  setCropOffset(prev => getClampedOffset(prev.x, prev.y, newZoom, cropImgSize.width, cropImgSize.height));
                }}
                style={{ width: '80%', accentColor: '#29b6f6' }}
              />
              <span style={{ fontSize: '11px', color: '#777' }}>Fotoğrafı basılı tutarak sürükleyip hizalayabilirsiniz</span>
            </div>

            <div className="modal-btns" style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
              <button className="mbtn mbtn-buy" style={{ flex: 1 }} onClick={handleApplyCrop}>
                Kırp ve Uygula
              </button>
              <button className="mbtn mbtn-pass" style={{ flex: 1 }} onClick={() => { setShowCropModal(false); setCropImageSrc(null); }}>
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
