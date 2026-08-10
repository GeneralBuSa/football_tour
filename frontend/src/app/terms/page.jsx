'use client';
import PageShell from '../shared/PageShell.jsx';
import useSession from '../shared/useSession.js';

export default function TermsPage() {
  const { stats, t, mounted } = useSession({ loadStats: false });
  return (
    <PageShell activePage="settings" stats={stats} t={t} mounted={mounted}>
      <article className="menu-dynamic-screen" style={{ maxWidth: '850px', margin: '0 auto', color: '#fff', padding: '28px' }}>
        <h1>Kullanım Koşulları</h1>
        <p>Oyuncular hesap bilgilerini korumak ve hizmeti kötüye kullanmamakla yükümlüdür.</p>
        <p>Hile, otomasyon, açık istismarı ve başka kullanıcıların verilerine erişme girişimleri yasaktır.</p>
        <p>Çevrimiçi özellikler beta durumundadır ve bakım sırasında geçici olarak kullanılamayabilir.</p>
        <button className="mbtn mbtn-pass" onClick={() => { window.location.href = '/settings'; }}>Geri dön</button>
      </article>
    </PageShell>
  );
}
