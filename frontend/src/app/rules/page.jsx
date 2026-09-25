'use client';
import PageShell from '../shared/PageShell.jsx';
import useSession from '../shared/useSession.js';

// İçerik oyun motorundaki gerçek değerlere dayanır (js/engine/*, js/data/cities.js).
const CONTENT = {
  tr: {
    title: 'Oyun Kuralları',
    intro: 'Football Tour Simulator, futbol şehirleri üzerinde oynanan, Monopoly tarzı bir strateji masa oyunudur. Amaç, rakiplerinden daha zengin kulüp olmaktır.',
    sections: [
      ['Başlangıç', ['Her oyuncu ₺1.000.000 ile başlar.', 'Sırası gelen oyuncu iki zar atar ve toplam kadar ilerler.', 'Başlangıç noktasından her geçişte ₺100.000 kazanılır.']],
      ['Şehirler ve stadyumlar', ['Sahipsiz bir şehre gelen oyuncu şehri satın alabilir.', 'Başka bir oyuncunun şehrine gelen oyuncu kira öder. Kira, şehrin kirasının her stadyum seviyesi için %50 artırılmış halidir.', 'Kendi şehrinde stadyum kurabilirsin: her seviye şehir fiyatının %40\'ı kadardır, en fazla 3 seviye.', 'Bir ligin tüm şehirlerine sahip olmak “Liga Hakimi” başarımını açar.']],
      ['Özel alanlar', ['Vergi: −₺50.000 · Faul: −₺30.000', 'Gol Bonusu: +₺40.000 · Penaltı: +₺60.000 · Şampiyona: +₺150.000', 'Kutu Aç: rastgele bir ödül veya ceza.']],
      ['Maçın bitişi', ['Bir oyuncunun parası sıfırlandığında ya da 30 dakikalık süre dolduğunda maç biter.', 'Maç sonunda en çok parası olan oyuncu kazanır.']]
    ],
    faqTitle: 'Sık Sorulan Sorular',
    faq: [
      ['Oynamak için hesap gerekiyor mu?', 'Aynı cihazda iki kişilik “Yerel Maç” hesap gerektirmez. Çevrimiçi eşleşme, özel oda, arkadaş listesi ve mesajlaşma için ücretsiz bir hesap gerekir.'],
      ['Arkadaşımla çevrimiçi nasıl oynarım?', 'OYNA → Özel Oda → “Oda Oluştur” de; oda kodun kullanıcı adındır. Arkadaşın “Odaya Katıl” alanına kullanıcı adını yazar. Arkadaş listende “Davet Et” butonu da odayı kurup davet gönderir.'],
      ['Hızlı eşleşme nasıl çalışır?', 'Sıraya giren iki oyuncu otomatik eşleşir. Sırada en uzun bekleyen oyuncu maçı başlatır. Eşleşmeden önce sayfayı kapatan oyuncular kısa süre içinde sıradan düşer.'],
      ['Bağlantım koparsa ne olur?', 'Çevrimiçi maçta hamleler sunucuda saklanır. Kısa kopmalarda oyun otomatik olarak yeniden bağlanır ve son durumu yükler.'],
      ['Coin nedir, nasıl kullanılır?', 'Yeni hesaplar 2.000 coin ile başlar. Coin; mağazadaki futbolcu karakterleri ve kozmetikler için kullanılır. İstersen coin paketlerini Stripe güvenli ödeme sayfası üzerinden satın alabilirsin.'],
      ['Hesabımı nasıl silerim?', 'Ayarlar sayfasındaki “Hesabı Sil” bölümünden şifreni doğrulayarak hesabını ve ilişkili verilerini kalıcı olarak silebilirsin.']
    ],
    back: 'Ana menüye dön'
  },
  en: {
    title: 'Game Rules',
    intro: 'Football Tour Simulator is a Monopoly-style strategy board game played across football cities. The goal is to become richer than your rivals.',
    sections: [
      ['Getting started', ['Every player starts with ₺1,000,000.', 'On your turn, roll two dice and move the total number of cells.', 'Passing the start cell earns ₺100,000.']],
      ['Cities and stadiums', ['Land on an unowned city to buy it.', 'Landing on another player\'s city costs rent. Rent increases by 50% for each stadium level.', 'You can build stadiums on your own cities: each level costs 40% of the city price, up to 3 levels.', 'Owning every city of a league unlocks the “League Master” achievement.']],
      ['Special cells', ['Tax: −₺50,000 · Foul: −₺30,000', 'Goal bonus: +₺40,000 · Penalty: +₺60,000 · Championship: +₺150,000', 'Loot box: a random reward or penalty.']],
      ['End of the match', ['The match ends when a player runs out of money or the 30-minute timer expires.', 'The richest player wins.']]
    ],
    faqTitle: 'Frequently Asked Questions',
    faq: [
      ['Do I need an account to play?', 'The two-player “Local Match” on one device needs no account. Online matchmaking, private rooms, friends and chat require a free account.'],
      ['How do I play online with a friend?', 'PLAY → Private Room → “Create Room”; your room code is your username. Your friend enters it under “Join Room”. The “Invite” button in your friends list also creates a room and sends an invite.'],
      ['How does quick match work?', 'Two players in the queue are matched automatically. The player who waited longest starts the match. Players who close the page before a match drop out of the queue shortly after.'],
      ['What happens if my connection drops?', 'Online moves are stored on the server. After a short disconnect the game reconnects automatically and loads the latest state.'],
      ['What are coins for?', 'New accounts start with 2,000 coins. Coins unlock player characters and cosmetics in the store. Optionally, coin packs can be purchased through Stripe\'s secure checkout.'],
      ['How do I delete my account?', 'Open Settings → “Delete Account”, confirm with your password, and your account and related data are permanently deleted.']
    ],
    back: 'Back to main menu'
  }
};

export default function RulesPage() {
  const { stats, t, language } = useSession({ loadStats: false, loadGame: false });
  const c = language === 'English' ? CONTENT.en : CONTENT.tr;
  // FAQ yapılandırılmış verisi her zaman varsayılan dil (Türkçe) içerikle üretilir.
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: CONTENT.tr.faq.map(([question, answer]) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer }
    }))
  };

  return (
    <PageShell activePage="" stats={stats} t={t} language={language}>
      <article className="legal-page">
        <h1>{c.title}</h1>
        <p className="legal-lead">{c.intro}</p>
        {c.sections.map(([heading, items]) => (
          <section key={heading}>
            <h2>{heading}</h2>
            <ul>{items.map(item => <li key={item}>{item}</li>)}</ul>
          </section>
        ))}

        <section id="sss" aria-labelledby="faq-title">
          <h2 id="faq-title">{c.faqTitle}</h2>
          {c.faq.map(([question, answer]) => (
            <details key={question} className="faq-item">
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </section>

        <a className="mbtn mbtn-buy legal-cta" href="/?play=true">{language === 'English' ? 'PLAY NOW' : 'HEMEN OYNA'}</a>{' '}
        <a className="legal-link" href="/">{c.back}</a>
      </article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
    </PageShell>
  );
}
