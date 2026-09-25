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
  return (
    <nav className="menu-top-nav" aria-label="Ana menü" style={{position: 'fixed', top: '0', left: '0', width: '100%', zIndex: '10'}}>
      <div className="top-nav-left">
        <a className="menu-logo" href="/">
          <img src="/assets/logo.webp" alt="Football Tour Simulator FT26" className="logo-img" width="60" height="60" />
        </a>
      </div>
      <div className="top-nav-center">
        <div className="nav-icons-group left">
          {NAV_ITEMS_LEFT.map(item => (
            <a
              key={item.key}
              href={item.href}
              className={`nav-item-icon${activePage === item.key ? ' active' : ''}`}
              title={t[item.titleKey] || item.key}
              aria-label={t[item.titleKey] || item.key}
              aria-current={activePage === item.key ? 'page' : undefined}
              style={{ textDecoration: 'none' }}
            >
              {item.icon}
            </a>
          ))}
        </div>
        <a className="btn-play-tactical" href="/?play=true" style={{ textDecoration: 'none' }}>
          {t.play || 'OYNA'}
        </a>
        <div className="nav-icons-group right">
          {NAV_ITEMS_RIGHT.map(item => (
            <a
              key={item.key}
              href={item.href}
              className={`nav-item-icon${activePage === item.key ? ' active' : ''}`}
              title={t[item.titleKey] || item.key}
              aria-label={t[item.titleKey] || item.key}
              aria-current={activePage === item.key ? 'page' : undefined}
              style={{ textDecoration: 'none' }}
            >
              {item.icon}
            </a>
          ))}
        </div>
      </div>
      <div className="top-nav-right">
        {typeof stats?.total_earnings === 'number' && (
          <div className="user-stats">
            <div className="stat-item" title={t.earnings || 'Kazanç'}>
              <span aria-hidden="true" style={{display: "flex", alignItems: "center", justifyContent: "center", height: "100%"}}>🪙</span>
              <span style={{display: "flex", alignItems: "center", position: "relative", top: "0.5px"}}>
                ₺{stats.total_earnings.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
