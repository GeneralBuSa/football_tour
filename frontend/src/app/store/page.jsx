'use client';
import { useEffect, useState } from 'react';
import apiService from '../../../services/ApiService.js';

export default function Page() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ total_earnings: 2000, wins: 0 });
  const [items, setItems] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import('../../../js/game.js').then(() => {
      const logged = apiService.isLoggedIn();
      setIsLoggedIn(logged);
      if (logged) {
        const u = apiService.getUser();
        setUser(u);
        loadData(u.id);
      } else {
        setLoading(false);
        // Varsayılan mock ürünleri göster
        setItems([
          { id: 'mock-1', name: 'Altın Piyon Kutusu', type: 'Kutu', price: 1500 },
          { id: 'mock-2', name: 'Efsanevi Stadyum Teması', type: 'Tema', price: 5000 },
          { id: 'mock-3', name: 'Elmas Zar Görünümü', type: 'Zar', price: 3000 },
          { id: 'mock-4', name: 'VIP Oyuncu Rozeti', type: 'Rozet', price: 10000 }
        ]);
      }
    }).catch(console.error);
  }, []);

  const loadData = async (userId) => {
    try {
      setLoading(true);
      const statsRes = await apiService.getStats(userId);
      if (statsRes && !statsRes.error) {
        setStats(statsRes);
      }

      const itemsRes = await apiService.getStoreItems();
      if (Array.isArray(itemsRes) && itemsRes.length > 0) {
        setItems(itemsRes);
      } else {
        setItems([
          { id: 'mock-1', name: 'Altın Piyon Kutusu', type: 'Kutu', price: 1500 },
          { id: 'mock-2', name: 'Efsanevi Stadyum Teması', type: 'Tema', price: 5000 },
          { id: 'mock-3', name: 'Elmas Zar Görünümü', type: 'Zar', price: 3000 },
          { id: 'mock-4', name: 'VIP Oyuncu Rozeti', type: 'Rozet', price: 10000 }
        ]);
      }

      const purchasesRes = await apiService.getMyPurchases();
      if (Array.isArray(purchasesRes)) {
        setPurchases(purchasesRes);
      }
    } catch (e) {
      console.error("Mağaza verileri yüklenirken hata:", e);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (item) => {
    if (!isLoggedIn) {
      alert("Satın alma işlemi gerçekleştirmek için lütfen önce giriş yapın!");
      return;
    }

    const currentBalance = stats.total_earnings || 0;
    if (currentBalance < item.price) {
      alert("Yetersiz bakiye! 🪙");
      return;
    }

    // Mock ID'ler için yerel satın alma simülasyonu yap veya gerçek API'ye gönder
    try {
      setLoading(true);
      
      let res;
      if (item.id.startsWith('mock-')) {
        // Mock satın alma simülasyonu
        res = { success: true };
      } else {
        res = await apiService.purchaseItem(item.id);
      }

      if (res && !res.error) {
        const newBalance = currentBalance - item.price;
        await apiService.updateStats(user.id, {
          total_earnings: newBalance
        });
        
        alert(`"${item.name}" başarıyla satın alındı! 🎉`);
        loadData(user.id);
      } else {
        alert("Satın alma hatası: " + (res?.error || "İşlem gerçekleştirilemedi"));
      }
    } catch (e) {
      alert("Satın alma hatası oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const isPurchased = (itemId) => {
    return purchases.some(p => p.item_id === itemId || p.id === itemId);
  };

  return (
    <>
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
            <div className="nav-item-icon" title="Başarımlar" onClick={() => {window.location.href='/achievements'}}>🏆</div>
            <div className="nav-item-icon active" title="Mağaza" onClick={() => {window.location.href='/store'}}>🛒</div>
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

      <div className="store-page-container" style={{marginTop: '80px', padding: '20px'}}>
        <div className="menu-dynamic-screen">
          <div className="dynamic-screen-header" style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
            <button className="btn-mode-back" onClick={() => {window.location.href='/'}} style={{margin: '0', padding: '6px 12px', fontSize: '12px'}}>← GERİ</button>
            <span>🛒 OYUN İÇİ MAĞAZA</span>
          </div>
          <div className="dynamic-screen-body" style={{marginTop: '20px'}}>
            {loading ? (
              <div style={{color: '#fff', textAlign: 'center', padding: '40px'}}>Yükleniyor...</div>
            ) : (
              <div className="store-items-container" id="store-items-container" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '20px',
                padding: '10px'
              }}>
                {items.map(item => {
                  const purchased = isPurchased(item.id);
                  const canAfford = (stats.total_earnings || 0) >= item.price;
                  
                  return (
                    <div key={item.id} className="store-item-card" style={{
                      background: 'rgba(20, 24, 33, 0.85)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'between',
                      alignItems: 'center',
                      color: '#fff',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                      transition: 'transform 0.2s',
                    }}>
                      <div style={{fontSize: '36px', marginBottom: '12px'}}>
                        {item.type === 'Kutu' ? '📦' : item.type === 'Tema' ? '🏟️' : item.type === 'Zar' ? '🎲' : '🏅'}
                      </div>
                      <h3 style={{fontSize: '16px', fontWeight: 'bold', margin: '4px 0', textAlign: 'center'}}>{item.name}</h3>
                      <span style={{
                        fontSize: '11px', 
                        background: 'rgba(255,255,255,0.1)', 
                        padding: '2px 8px', 
                        borderRadius: '12px',
                        marginBottom: '16px',
                        color: '#aaa'
                      }}>{item.type.toUpperCase()}</span>
                      
                      <div style={{display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px'}}>
                        <span style={{fontSize: '18px'}}>🪙</span>
                        <span style={{fontSize: '16px', fontWeight: 'bold'}}>₺{item.price.toLocaleString()}</span>
                      </div>

                      <button 
                        onClick={() => !purchased && handlePurchase(item)}
                        disabled={purchased || (!canAfford && isLoggedIn)}
                        className={`mbtn ${purchased ? 'mbtn-pass' : 'mbtn-buy'}`}
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '4px',
                          cursor: purchased ? 'default' : 'pointer',
                          opacity: (purchased || (!canAfford && isLoggedIn)) ? 0.6 : 1
                        }}
                      >
                        {purchased ? 'SATIN ALINDI' : !canAfford && isLoggedIn ? 'YETERSİZ BAKİYE' : 'SATIN AL'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
