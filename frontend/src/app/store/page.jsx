'use client';
import { useEffect, useState } from 'react';
import useSession from '../shared/useSession.js';
import PageShell from '../shared/PageShell.jsx';
import { getPlayerByKey } from '../../../js/data/playerCatalog.js';

export default function Page() {
  const { isLoggedIn, user, stats, setStats, language, mounted, gameReady, t, apiService } = useSession();
  const [items, setItems] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [entitlements, setEntitlements] = useState([]);
  const [coinPacks, setCoinPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!gameReady) return;

    if (isLoggedIn && user) {
      loadData(user.id);
    } else {
      setLoading(false);
      setItems([]);
      setEntitlements([]);
      setLoadError('');
    }
  }, [gameReady, isLoggedIn, user]);

  const loadData = async (userId) => {
    try {
      setLoading(true);
      setLoadError('');
      const [itemsRes, purchasesRes, entitlementsRes, packsRes] = await Promise.all([
        apiService.getStoreItems(),
        apiService.getMyPurchases(),
        apiService.getCharacterEntitlements(),
        apiService.getCoinPacks()
      ]);

      if (Array.isArray(itemsRes) && itemsRes.length > 0) {
        setItems(itemsRes);
      } else {
        setItems([]);
        setLoadError(itemsRes?.error || 'Mağaza ürünleri yüklenemedi.');
      }

      if (Array.isArray(purchasesRes)) {
        setPurchases(purchasesRes);
      }

      if (Array.isArray(entitlementsRes)) {
        setEntitlements(entitlementsRes);
      }

      if (Array.isArray(packsRes)) setCoinPacks(packsRes);
    } catch (e) {
      console.error("Mağaza verileri yüklenirken hata:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCoinPack = async (pack) => {
    if (!isLoggedIn) {
      alert(t.store_login_required);
      return;
    }
    const result = await apiService.createCoinCheckout(pack.key);
    if (result?.checkout_url) {
      window.location.href = result.checkout_url;
    } else {
      alert(result?.error || 'Ödeme sayfası oluşturulamadı.');
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
      res = await apiService.purchaseItem(item.id);

      if (res && !res.error) {
        if (typeof res.balance !== 'number') {
          throw new Error(language === 'English' ? 'Invalid purchase response' : 'Geçersiz satın alma yanıtı');
        }
        const newBalance = res.balance;
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

  const isPurchased = (item) => {
    if (!item) return false;
    const inPurchases = purchases.some(p => p.item_id === item.id || p.id === item.id || p.store_items?.id === item.id);
    if (inPurchases) return true;

    if (item.type === 'Player') {
      const playerKey = item.sku?.startsWith('player_')
        ? item.sku.replace('player_', '')
        : item.name?.toLowerCase().replace(/^the\s+/, '');
      
      const hasEntitlement = entitlements.some(e => 
        e.character_key === playerKey || 
        `player_${e.character_key}` === item.sku ||
        e.character_name?.toLowerCase() === item.name?.toLowerCase()
      );
      if (hasEntitlement) return true;
    }

    return false;
  };

  return (
    <PageShell activePage="store" stats={stats} t={t} mounted={mounted}>
      <div className="menu-dynamic-screen">
        <div className="dynamic-screen-header" style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
          <button className="btn-mode-back" onClick={() => {window.location.href='/'}} style={{margin: '0', padding: '6px 12px', fontSize: '12px'}}>← {t.back}</button>
          <span>{t.store_title === "Mağaza" ? "🛒 OYUN İÇİ MAĞAZA" : "🛒 IN-GAME STORE"}</span>
        </div>
        <div className="dynamic-screen-body" style={{marginTop: '20px'}}>
           {isLoggedIn && coinPacks.length > 0 && (
             <section style={{ padding: '16px', border: '1px solid rgba(255,183,77,.25)', borderRadius: '12px', background: 'rgba(255,183,77,.04)' }}>
               <h2 style={{ margin: '0 0 12px', color: '#ffb74d', fontSize: '16px' }}>🪙 Coin satın al</h2>
               <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                 {coinPacks.map(pack => (
                   <button key={pack.key} type="button" className="mbtn mbtn-buy" onClick={() => handleCoinPack(pack)} disabled={loading}>
                     {pack.coins.toLocaleString()} coin · ${(pack.amountUsdCents / 100).toFixed(2)}
                   </button>
                 ))}
               </div>
             </section>
           )}
           {loading ? (
             <div style={{color: '#fff', textAlign: 'center', padding: '40px'}}>{t.loading}</div>
           ) : loadError ? (
             <div style={{color: '#ffb74d', textAlign: 'center', padding: '40px'}}>{loadError}</div>
           ) : !isLoggedIn ? (
             <div style={{color: '#aaa', textAlign: 'center', padding: '40px'}}>{t.store_login_required}</div>
           ) : items.length === 0 ? (
             <div style={{color: '#aaa', textAlign: 'center', padding: '40px'}}>{language === 'English' ? 'No store items are available.' : 'Mağazada gösterilecek ürün yok.'}</div>
           ) : (
            <div className="store-items-container" id="store-items-container" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '20px',
              padding: '10px'
            }}>
              {items.map(item => {
                const purchased = isPurchased(item);
                const canAfford = (stats.total_earnings || 0) >= item.price;
                const localizedType = item.type === 'Kutu' || item.type === 'Box' ? t.store_item_box :
                                      item.type === 'Tema' || item.type === 'Theme' ? t.store_item_theme :
                                      item.type === 'Zar' || item.type === 'Dice' ? t.store_item_dice :
                                      item.type === 'Rozet' || item.type === 'Badge' ? t.store_item_badge :
                                      item.type === 'Player' ? (language === 'English' ? 'Player' : 'Futbolcu') : item.type;
                
                const getItemImage = (name) => {
                  if (!name) return null;
                  const n = name.toLowerCase();
                  if (n.includes('piyon') || n.includes('pawn') || n.includes('kutu') || n.includes('box')) return '/assets/store_gold_pawn_box.png';
                  if (n.includes('stadyum') || n.includes('stadium') || n.includes('tema') || n.includes('theme')) return '/assets/store_stadium_theme.png';
                  if (n.includes('zar') || n.includes('dice') || n.includes('elmas') || n.includes('diamond')) return '/assets/store_diamond_dice.png';
                  if (n.includes('vip') || n.includes('rozet') || n.includes('badge')) return '/assets/store_vip_badge.png';
                  return null;
                };
                const playerKey = item.type === 'Player'
                  ? (item.sku?.startsWith('player_')
                    ? item.sku.replace('player_', '')
                    : item.name?.toLowerCase().replace(/^the\s+/, ''))
                  : null;
                const player = playerKey ? getPlayerByKey(playerKey) : null;
                const imgUrl = player?.refImage || getItemImage(item.name);

                return (
                  <div key={item.id} className="store-item-card" style={{
                    background: 'linear-gradient(145deg, rgba(20, 24, 33, 0.95) 0%, rgba(10, 12, 17, 0.95) 100%)',
                    border: '1px solid rgba(41, 182, 246, 0.25)',
                    borderRadius: '12px',
                    padding: '20px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    color: '#fff',
                    boxShadow: '0 8px 25px rgba(0,0,0,0.4)',
                    transition: 'transform 0.2s',
                  }}>
                    {imgUrl ? (
                      <div style={{
                        width: '140px',
                        height: '140px',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        marginBottom: '12px',
                        border: '1px solid rgba(41, 182, 246, 0.3)',
                        boxShadow: '0 0 20px rgba(41, 182, 246, 0.2)',
                        background: '#0d1117',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <img 
                          src={imgUrl} 
                          alt={item.name} 
                          style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'cover'
                          }} 
                        />
                      </div>
                    ) : (
                      <div style={{fontSize: '44px', marginBottom: '12px'}}>
                        {item.type === 'Kutu' || item.type === 'Box' ? '📦' : item.type === 'Tema' || item.type === 'Theme' ? '🏟️' : item.type === 'Zar' || item.type === 'Dice' ? '🎲' : '🏅'}
                      </div>
                    )}
                    <h3 style={{fontSize: '16px', fontWeight: 'bold', margin: '4px 0', textAlign: 'center', color: '#00e5ff'}}>{item.name}</h3>
                    <span style={{
                      fontSize: '11px', 
                      background: 'rgba(255,255,255,0.06)', 
                      border: '1px solid rgba(255,255,255,0.1)',
                      padding: '2px 10px', 
                      borderRadius: '12px',
                      marginBottom: '14px',
                      color: '#aaa'
                    }}>{localizedType}</span>
                    
                    <div style={{display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px'}}>
                      <span style={{fontSize: '18px'}}>🪙</span>
                      <span style={{fontSize: '16px', fontWeight: 'bold', color: '#ffb74d'}}>{item.price.toLocaleString()} coin</span>
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
