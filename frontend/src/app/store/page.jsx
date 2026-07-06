'use client';
import { useEffect, useState } from 'react';
import useSession from '../shared/useSession.js';
import PageShell from '../shared/PageShell.jsx';

export default function Page() {
  const { isLoggedIn, user, stats, setStats, language, mounted, gameReady, t, apiService } = useSession();
  const [items, setItems] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!gameReady) return;

    const savedLang = localStorage.getItem('ft26_language') || 'Türkçe';
    const defaultItems = getDefaultItems(savedLang);

    if (isLoggedIn && user) {
      loadData(user.id, savedLang);
    } else {
      setLoading(false);
      setItems(defaultItems);
    }
  }, [gameReady, isLoggedIn, user]);

  const getDefaultItems = (lang) => {
    return lang === 'English' ? [
      { id: 'mock-1', name: 'Golden Pawn Box', type: 'Box', price: 1500 },
      { id: 'mock-2', name: 'Legendary Stadium Theme', type: 'Theme', price: 5000 },
      { id: 'mock-3', name: 'Diamond Dice Skin', type: 'Dice', price: 3000 },
      { id: 'mock-4', name: 'VIP Player Badge', type: 'Badge', price: 10000 }
    ] : [
      { id: 'mock-1', name: 'Altın Piyon Kutusu', type: 'Kutu', price: 1500 },
      { id: 'mock-2', name: 'Efsanevi Stadyum Teması', type: 'Tema', price: 5000 },
      { id: 'mock-3', name: 'Elmas Zar Görünümü', type: 'Zar', price: 3000 },
      { id: 'mock-4', name: 'VIP Oyuncu Rozeti', type: 'Rozet', price: 10000 }
    ];
  };

  const loadData = async (userId, currentLang) => {
    const activeLang = currentLang || language;
    const defaultItems = getDefaultItems(activeLang);

    try {
      setLoading(true);
      const itemsRes = await apiService.getStoreItems();
      if (Array.isArray(itemsRes) && itemsRes.length > 0) {
        setItems(itemsRes);
      } else {
        setItems(defaultItems);
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
      alert(t.store_login_required);
      return;
    }

    const currentBalance = stats.total_earnings || 0;
    if (currentBalance < item.price) {
      alert(t.store_insufficient_funds);
      return;
    }

    try {
      setLoading(true);
      
      let res;
      if (item.id.startsWith('mock-')) {
        res = { success: true };
      } else {
        res = await apiService.purchaseItem(item.id);
      }

      if (res && !res.error) {
        const newBalance = typeof res.balance === 'number' ? res.balance : currentBalance - item.price;
        if (item.id.startsWith('mock-')) {
          await apiService.updateStats(user.id, {
            total_earnings: newBalance
          });
        }
        setStats(prev => ({ ...prev, total_earnings: newBalance }));
        
        alert(t.store_purchase_success.replace('{name}', item.name));
        loadData(user.id);
      } else {
        alert(t.store_purchase_error.replace('{error}', res?.error || (language === 'English' ? 'Transaction failed' : 'İşlem gerçekleştirilemedi')));
      }
    } catch (e) {
      alert(t.store_purchase_failed);
    } finally {
      setLoading(false);
    }
  };

  const isPurchased = (itemId) => {
    return purchases.some(p => p.item_id === itemId || p.id === itemId);
  };

  return (
    <PageShell activePage="store" stats={stats} t={t} mounted={mounted}>
      <div className="menu-dynamic-screen">
        <div className="dynamic-screen-header" style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
          <button className="btn-mode-back" onClick={() => {window.location.href='/'}} style={{margin: '0', padding: '6px 12px', fontSize: '12px'}}>← {t.back}</button>
          <span>{t.store_title === "Mağaza" ? "🛒 OYUN İÇİ MAĞAZA" : "🛒 IN-GAME STORE"}</span>
        </div>
        <div className="dynamic-screen-body" style={{marginTop: '20px'}}>
          {loading ? (
            <div style={{color: '#fff', textAlign: 'center', padding: '40px'}}>{t.loading}</div>
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
                const localizedType = item.type === 'Kutu' || item.type === 'Box' ? t.store_item_box :
                                      item.type === 'Tema' || item.type === 'Theme' ? t.store_item_theme :
                                      item.type === 'Zar' || item.type === 'Dice' ? t.store_item_dice :
                                      item.type === 'Rozet' || item.type === 'Badge' ? t.store_item_badge : item.type;
                
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
                      {item.type === 'Kutu' || item.type === 'Box' ? '📦' : item.type === 'Tema' || item.type === 'Theme' ? '🏟️' : item.type === 'Zar' || item.type === 'Dice' ? '🎲' : '🏅'}
                    </div>
                    <h3 style={{fontSize: '16px', fontWeight: 'bold', margin: '4px 0', textAlign: 'center'}}>{item.name}</h3>
                    <span style={{
                      fontSize: '11px', 
                      background: 'rgba(255,255,255,0.1)', 
                      padding: '2px 8px', 
                      borderRadius: '12px',
                      marginBottom: '16px',
                      color: '#aaa'
                    }}>{localizedType.toUpperCase()}</span>
                    
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
                      {purchased ? t.store_purchased : !canAfford && isLoggedIn ? (language === 'English' ? 'INSUFFICIENT FUNDS' : 'YETERSİZ BAKİYE') : t.store_buy}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
