'use client';
import { useEffect, useState } from 'react';
import useSession from '../shared/useSession.js';
import PageShell from '../shared/PageShell.jsx';
import { getPlayerByKey } from '../../../js/data/playerCatalog.js';
import { trackEvent } from '../../../services/analytics.js';

export default function Page() {
  const { isLoggedIn, user, stats, setStats, language, mounted, gameReady, t, apiService } = useSession({ loadGame: false });
  const [items, setItems] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [entitlements, setEntitlements] = useState([]);
  const [coinPacks, setCoinPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState(null);
  const [busyKey, setBusyKey] = useState('');

  // Stripe Checkout dönüşü: ödeme sonucu kullanıcıya açıkça bildirilir.
  useEffect(() => {
    const payment = new URLSearchParams(window.location.search).get('payment');
    const isEn = localStorage.getItem('ft26_language') === 'English';
    if (payment === 'success') {
      setNotice({ type: 'success', text: isEn
        ? 'Thank you! Your payment was received. Coins are added as soon as Stripe confirms the payment — refresh in a moment if your balance has not updated yet.'
        : 'Teşekkürler! Ödemen alındı. Coin’ler Stripe ödemeyi onayladığı anda hesabına eklenir; bakiyen güncellenmediyse birkaç saniye sonra sayfayı yenile.' });
      trackEvent('purchase', { type: 'coin_pack' });
    } else if (payment === 'cancelled') {
      setNotice({ type: 'info', text: isEn ? 'Payment was cancelled. You were not charged.' : 'Ödeme iptal edildi. Herhangi bir ücret alınmadı.' });
    }
  }, []);

  useEffect(() => {
    if (!gameReady) return;
    // Katalog ve coin paketleri herkese açıktır; misafirler de ürünleri görebilir.
    loadData(isLoggedIn && user ? user.id : null);
  }, [gameReady, isLoggedIn, user]);

  const loadData = async (userId) => {
    try {
      setLoading(true);
      setLoadError('');
      const [itemsRes, purchasesRes, entitlementsRes, packsRes] = await Promise.all([
        apiService.getStoreItems(),
        userId ? apiService.getMyPurchases() : Promise.resolve([]),
        userId ? apiService.getCharacterEntitlements() : Promise.resolve([]),
        apiService.getCoinPacks()
      ]);

      if (Array.isArray(itemsRes)) {
        setItems(itemsRes);
      } else {
        setItems([]);
        setLoadError(itemsRes?.error || (language === 'English' ? 'Store items could not be loaded.' : 'Mağaza ürünleri yüklenemedi.'));
      }

      if (Array.isArray(purchasesRes)) setPurchases(purchasesRes);
      if (Array.isArray(entitlementsRes)) setEntitlements(entitlementsRes);
      if (Array.isArray(packsRes)) setCoinPacks(packsRes);
    } catch (e) {
      console.error('Mağaza verileri yüklenirken hata:', e);
      setLoadError(language === 'English' ? 'Store could not be loaded. Check your connection and try again.' : 'Mağaza yüklenemedi. Bağlantını kontrol edip tekrar dene.');
    } finally {
      setLoading(false);
    }
  };

  const handleCoinPack = async (pack) => {
    if (!isLoggedIn) {
      window.location.assign('/auth?next=/store');
      return;
    }
    if (busyKey) return;
    setBusyKey(`pack:${pack.key}`);
    setNotice(null);
    trackEvent('begin_checkout', { pack: pack.key });
    const result = await apiService.createCoinCheckout(pack.key);
    if (result?.checkout_url) {
      window.location.href = result.checkout_url;
      return;
    }
    setBusyKey('');
    setNotice({ type: 'error', text: result?.error || (language === 'English' ? 'Payment page could not be created. Please try again.' : 'Ödeme sayfası oluşturulamadı. Lütfen tekrar dene.') });
  };

  const handlePurchase = async (item) => {
    if (!isLoggedIn) {
      window.location.assign('/auth?next=/store');
      return;
    }
    if (busyKey) return;

    const currentBalance = stats.total_earnings || 0;
    if (currentBalance < item.price) {
      setNotice({ type: 'error', text: t.store_insufficient_funds });
      return;
    }

    setBusyKey(`item:${item.id}`);
    setNotice(null);
    try {
      const res = await apiService.purchaseItem(item.id);
      if (res && !res.error && typeof res.balance === 'number') {
        setStats(prev => ({ ...prev, total_earnings: res.balance }));
        setNotice({ type: 'success', text: t.store_purchase_success.replace('{name}', item.name) });
        trackEvent('purchase', { type: 'store_item' });
        await loadData(user.id);
      } else {
        setNotice({ type: 'error', text: t.store_purchase_error.replace('{error}', res?.error || (language === 'English' ? 'Transaction failed' : 'İşlem gerçekleştirilemedi')) });
      }
    } catch (e) {
      setNotice({ type: 'error', text: t.store_purchase_failed });
    } finally {
      setBusyKey('');
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
    <PageShell activePage="store" stats={stats} t={t} language={language}>
      <div className="menu-dynamic-screen">
        <div className="dynamic-screen-header" style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
          <a className="btn-mode-back" href="/" style={{margin: '0', padding: '10px 12px', fontSize: '12px', textDecoration: 'none'}}>← {t.back}</a>
          <h1 style={{ fontSize: 'inherit', margin: 0 }}>{language === 'English' ? '🛒 IN-GAME STORE' : '🛒 OYUN İÇİ MAĞAZA'}</h1>
        </div>
        <div className="dynamic-screen-body" style={{marginTop: '20px'}}>
           {notice && (
             <div role={notice.type === 'error' ? 'alert' : 'status'} className={`store-notice ${notice.type}`}>
               <span>{notice.text}</span>
               <button type="button" className="link-button" onClick={() => setNotice(null)} aria-label={language === 'English' ? 'Dismiss' : 'Kapat'}>✕</button>
             </div>
           )}
           {!isLoggedIn && !loading && (
             <div className="store-notice info" role="note">
               <span>{language === 'English'
                 ? 'Browse freely. Log in to spend your 2,000 starting coins.'
                 : 'Ürünlere göz atabilirsin. Satın almak için giriş yap; yeni hesaplar 2.000 coin ile başlar.'}</span>
               <a className="mbtn mbtn-buy" href="/auth?next=/store" style={{ textDecoration: 'none', margin: 0 }}>{language === 'English' ? 'Log in' : 'Giriş Yap'}</a>
             </div>
           )}
           {coinPacks.length > 0 && (
             <section style={{ padding: '16px', border: '1px solid rgba(255,183,77,.25)', borderRadius: '12px', background: 'rgba(255,183,77,.04)' }}>
               <h2 style={{ margin: '0 0 12px', color: '#ffb74d', fontSize: '16px' }}>🪙 Coin satın al</h2>
               <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                 {coinPacks.map(pack => (
                   <button key={pack.key} type="button" className="mbtn mbtn-buy" onClick={() => handleCoinPack(pack)} disabled={loading || !!busyKey} aria-busy={busyKey === `pack:${pack.key}`} style={{ minHeight: '44px' }}>
                     {busyKey === `pack:${pack.key}` ? (language === 'English' ? 'Redirecting…' : 'Yönlendiriliyor…') : `${pack.coins.toLocaleString()} coin · $${(pack.amountUsdCents / 100).toFixed(2)}`}
                   </button>
                 ))}
               </div>
             </section>
           )}
           {loading && items.length === 0 ? (
             <div className="store-skeleton-grid" aria-busy="true" aria-label={t.loading}>
               {[0, 1, 2, 3].map(i => <div key={i} className="skeleton-row store-skeleton-card" />)}
             </div>
           ) : loadError ? (
             <div role="alert" style={{color: '#ffb74d', textAlign: 'center', padding: '40px'}}>
               <p>{loadError}</p>
               <button type="button" className="mbtn mbtn-buy" onClick={() => loadData(isLoggedIn && user ? user.id : null)}>{language === 'English' ? 'Try again' : 'Tekrar dene'}</button>
             </div>
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
                  if (n.includes('piyon') || n.includes('pawn') || n.includes('kutu') || n.includes('box')) return '/assets/store_gold_pawn_box.webp';
                  if (n.includes('stadyum') || n.includes('stadium') || n.includes('tema') || n.includes('theme')) return '/assets/store_stadium_theme.webp';
                  if (n.includes('zar') || n.includes('dice') || n.includes('elmas') || n.includes('diamond')) return '/assets/store_diamond_dice.webp';
                  if (n.includes('vip') || n.includes('rozet') || n.includes('badge')) return '/assets/store_vip_badge.webp';
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
                          alt=""
                          width="140"
                          height="140"
                          loading="lazy"
                          decoding="async"
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
                      type="button"
                      onClick={() => !purchased && handlePurchase(item)}
                      disabled={purchased || (!canAfford && isLoggedIn) || !!busyKey}
                      aria-busy={busyKey === `item:${item.id}`}
                      className={`mbtn ${purchased ? 'mbtn-pass' : 'mbtn-buy'}`}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '4px',
                        cursor: purchased ? 'default' : 'pointer',
                        opacity: (purchased || (!canAfford && isLoggedIn)) ? 0.6 : 1
                      }}
                    >
                      {busyKey === `item:${item.id}` ? (language === 'English' ? 'PROCESSING…' : 'İŞLENİYOR…') : purchased ? t.store_purchased : !isLoggedIn ? (language === 'English' ? 'LOG IN TO BUY' : 'SATIN ALMAK İÇİN GİRİŞ YAP') : !canAfford ? (language === 'English' ? 'INSUFFICIENT FUNDS' : 'YETERSİZ BAKİYE') : t.store_buy}
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
