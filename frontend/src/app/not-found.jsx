import Link from 'next/link';

export const metadata = {
  title: 'Sayfa Bulunamadı',
  description: 'Aradığın sayfa bulunamadı. Ana menüye dönerek oynamaya devam edebilirsin.',
  robots: { index: false, follow: true }
};

export default function NotFound() {
  return (
    <main className="not-found-page">
      <div className="not-found-card">
        <img src="/assets/logo.webp" alt="Football Tour Simulator FT26 logosu" width="120" height="120" />
        <p className="not-found-code" aria-hidden="true">404</p>
        <h1>Bu saha boş görünüyor</h1>
        <p>Aradığın sayfa taşınmış, silinmiş ya da hiç var olmamış olabilir.</p>
        <div className="not-found-actions">
          <Link href="/" className="btn-play-tactical not-found-primary">ANA MENÜYE DÖN</Link>
          <Link href="/rules" className="not-found-secondary">Oyun kurallarını oku</Link>
        </div>
      </div>
    </main>
  );
}
