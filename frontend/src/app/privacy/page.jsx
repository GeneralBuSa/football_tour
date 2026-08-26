'use client';
import PageShell from '../shared/PageShell.jsx';
import useSession from '../shared/useSession.js';

export default function PrivacyPage() {
  const { stats, t, mounted } = useSession({ loadStats: false });
  return (
    <PageShell activePage="settings" stats={stats} t={t} mounted={mounted}>
      <article className="menu-dynamic-screen" style={{ maxWidth: '850px', margin: '0 auto', color: '#fff', padding: '28px' }}>
        <h1>{t.privacy_policy || 'Gizlilik Politikası'}</h1>
        <p>{t.privacy_content_p1 || 'Football Tour Simulator hesap, oyun ilerlemesi ve satın alma verilerini hizmeti sunmak için saklar.'}</p>
        <p>{t.privacy_content_p2 || 'Şifreler hash’lenmiş olarak tutulur. Ödeme veya kredi kartı bilgisi bu uygulamada saklanmaz.'}</p>
        <p>{t.privacy_content_p3 || 'Hesabınızın silinmesi veya veri talepleriniz için uygulama yöneticisine başvurabilirsiniz.'}</p>
        <button className="mbtn mbtn-pass" onClick={() => { window.location.href = '/settings'; }}>{t.btn_back_to_settings || 'Geri dön'}</button>
      </article>
    </PageShell>
  );
}
