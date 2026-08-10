'use client';
import PageShell from '../shared/PageShell.jsx';
import useSession from '../shared/useSession.js';

export default function RulesPage() {
  const { stats, t, mounted } = useSession({ loadStats: false });
  return (
    <PageShell activePage="settings" stats={stats} t={t} mounted={mounted}>
      <article className="menu-dynamic-screen" style={{ maxWidth: '850px', margin: '0 auto', color: '#fff', padding: '28px' }}>
        <h1>Oyun Kuralları</h1>
        <p>Her oyuncu sırası geldiğinde zar atar, ilerler ve bulunduğu şehre göre işlem yapar.</p>
        <p>Şehir satın alma, kira ve stadyum geliştirme kararları oyuncunun mevcut bakiyesine göre uygulanır.</p>
        <p>Oyun sonucu, bağlantı kesilmeden önce kaydedilmelidir. Multiplayer özellikleri şu anda beta kapsamındadır.</p>
        <button className="mbtn mbtn-pass" onClick={() => { window.location.href = '/settings'; }}>Geri dön</button>
      </article>
    </PageShell>
  );
}
