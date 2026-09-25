// Ortak sayfa sarmalayıcısı
// PageBackground + TopNav + giriş animasyonu + içerik alanı + site bağlantıları
'use client';
import PageBackground from './PageBackground.jsx';
import TopNav from './TopNav.jsx';
import SiteFooter from './SiteFooter.jsx';

// Not: İçerik artık JS yüklenene kadar opacity:0 ile gizlenmiyor; aksi halde
// sayfanın ilk anlamlı boyaması (FCP/LCP) hydration'ı bekliyordu. Geçiş CSS ile yapılır.
export default function PageShell({ activePage, stats, t, children, language }) {
  return (
    <div className="page-shell page-fade-in">
      <PageBackground />
      <TopNav activePage={activePage} stats={stats} t={t} />
      <main className="page-shell-content">
        {children}
      </main>
      <SiteFooter language={language} clientNav />
    </div>
  );
}
