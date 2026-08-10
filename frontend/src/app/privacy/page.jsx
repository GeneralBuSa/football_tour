'use client';
import PageShell from '../shared/PageShell.jsx';
import useSession from '../shared/useSession.js';

export default function PrivacyPage() {
  const { stats, t, mounted } = useSession({ loadStats: false });
  return (
    <PageShell activePage="settings" stats={stats} t={t} mounted={mounted}>
      <article className="menu-dynamic-screen" style={{ maxWidth: '850px', margin: '0 auto', color: '#fff', padding: '28px' }}>
        <h1>Gizlilik Politikası</h1>
        <p>Football Tour Simulator hesap, oyun ilerlemesi ve satın alma verilerini hizmeti sunmak için saklar.</p>
        <p>Şifreler hash’lenmiş olarak tutulur. Ödeme veya kredi kartı bilgisi bu uygulamada saklanmaz.</p>
        <p>Hesabınızın silinmesi veya veri talepleriniz için uygulama yöneticisine başvurabilirsiniz.</p>
        <button className="mbtn mbtn-pass" onClick={() => { window.location.href = '/settings'; }}>Geri dön</button>
      </article>
    </PageShell>
  );
}
