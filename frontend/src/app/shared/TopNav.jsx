// Ortak üst navigasyon barı bileşeni
// activePage: hangi nav item'ın aktif olduğunu belirler
// stats: kullanıcı bakiye bilgisi
// t: çeviri objesi
'use client';

const NAV_ITEMS_LEFT = [
  { key: 'home', icon: '🏠', href: '/', titleKey: 'nav_home' },
  { key: 'history', icon: '📜', href: '/history', titleKey: 'nav_history' },
  { key: 'profile', icon: '👤', href: '/profile', titleKey: 'nav_profile' },
];

const NAV_ITEMS_RIGHT = [
  { key: 'achievements', icon: '🏆', href: '/achievements', titleKey: 'nav_achievements' },
  { key: 'store', icon: '🛒', href: '/store', titleKey: 'nav_store' },
  { key: 'settings', icon: '⚙️', href: '/settings', titleKey: 'nav_settings' },
];

export default function TopNav({ activePage = '', stats = {}, t = {} }) {
  const navigate = (href) => {
    window.location.href = href;
  };

  return (
    <div className="menu-top-nav" style={{position: 'fixed', top: '0', left: '0', width: '100%', zIndex: '10'}}>
      <div className="top-nav-left">
        <div className="menu-logo" onClick={() => navigate('/')} style={{cursor: 'pointer'}}>
          <img src="/assets/logo.png" alt="FT26 Logo" className="logo-img" />
        </div>
      </div>
      <div className="top-nav-center">
        <div className="nav-icons-group left">
          {NAV_ITEMS_LEFT.map(item => (
            <div
              key={item.key}
              className={`nav-item-icon${activePage === item.key ? ' active' : ''}`}
              title={t[item.titleKey] || item.key}
              onClick={() => navigate(item.href)}
            >
              {item.icon}
            </div>
          ))}
        </div>
        <button className="btn-play-tactical" onClick={() => navigate('/?play=true')}>
          {t.play || 'OYNA'}
        </button>
        <div className="nav-icons-group right">
          {NAV_ITEMS_RIGHT.map(item => (
            <div
              key={item.key}
              className={`nav-item-icon${activePage === item.key ? ' active' : ''}`}
              title={t[item.titleKey] || item.key}
              onClick={() => navigate(item.href)}
            >
              {item.icon}
            </div>
          ))}
        </div>
      </div>
      <div className="top-nav-right">
        <div className="user-stats">
          <div className="stat-item" title={t.earnings || 'Kazanç'}>
            <span style={{display: "flex", alignItems: "center", justifyContent: "center", height: "100%"}}>🪙</span>
            <span style={{display: "flex", alignItems: "center", position: "relative", top: "0.5px"}}>
              ₺{(stats.total_earnings || 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
