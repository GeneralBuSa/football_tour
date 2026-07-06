// Ortak sayfa sarmalayıcısı
// PageBackground + TopNav + mount animasyonu + içerik alanını birleştirir
'use client';
import PageBackground from './PageBackground.jsx';
import TopNav from './TopNav.jsx';

export default function PageShell({ activePage, stats, t, mounted, children }) {
  return (
    <div style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.15s ease-in-out' }}>
      <PageBackground />
      <TopNav activePage={activePage} stats={stats} t={t} />
      <div style={{marginTop: '80px', padding: '20px'}}>
        {children}
      </div>
    </div>
  );
}
