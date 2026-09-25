'use client';
import PageShell from '../shared/PageShell.jsx';
import ContactInfo from '../shared/ContactInfo.jsx';
import useSession from '../shared/useSession.js';

// Koşullar uygulamanın gerçek işleyişini (hesap, coin, çevrimiçi özellikler) yansıtır;
// hukuki danışmanlık yerine geçmez.
const CONTENT = {
  tr: {
    title: 'Kullanım Koşulları',
    note: 'Bu koşullar uygulamanın mevcut işleyişine göre hazırlanmıştır. Yayına almadan önce hukuki açıdan gözden geçirilmesi önerilir.',
    sections: [
      ['Hesap', [
        'Çevrimiçi özellikleri kullanmak için bir hesap oluşturman gerekir. Hesap bilgilerinin güvenliğinden sen sorumlusun.',
        'Kullanıcı adları 3-24 karakterdir ve diğer oyuncular tarafından görülür.',
        'Hesabını dilediğin zaman Ayarlar sayfasından silebilirsin.'
      ]],
      ['Kabul edilebilir kullanım', [
        'Hile, otomasyon/bot kullanımı, açık istismarı, başka kullanıcıların hesaplarına veya verilerine erişme girişimi yasaktır.',
        'Arkadaş mesajlarında taciz, nefret söylemi, spam ve yasa dışı içerik paylaşmak yasaktır. Mesaj gönderimi hız sınırına tabidir.',
        'Bu kurallara uymayan hesapların erişimi kısıtlanabilir.'
      ]],
      ['Oyun içi coin', [
        'Coin yalnızca oyun içinde karakter ve kozmetik açmak için kullanılır; gerçek paraya çevrilemez ve hesaplar arasında aktarılamaz.',
        'Coin paketleri Stripe Checkout üzerinden satılır. Coin, ödeme Stripe tarafından onaylandıktan sonra hesabına eklenir.',
        'Ödeme veya iade ile ilgili talepler için aşağıdaki iletişim adresini kullanabilirsin.'
      ]],
      ['Hizmetin durumu', [
        'Çevrimiçi özellikler geliştirme aşamasındadır; bakım veya teknik sorunlar nedeniyle geçici olarak kullanılamayabilir.',
        'Oyun kuralları, fiyatlar ve içerik zaman içinde güncellenebilir.'
      ]]
    ],
    contact: 'İletişim:',
    back: 'Ana menüye dön'
  },
  en: {
    title: 'Terms of Service',
    note: 'These terms reflect how the application currently works. A legal review is recommended before launch.',
    sections: [
      ['Account', [
        'Online features require an account. You are responsible for keeping your credentials safe.',
        'Usernames are 3-24 characters and visible to other players.',
        'You can delete your account at any time from the Settings page.'
      ]],
      ['Acceptable use', [
        'Cheating, bots/automation, exploiting bugs, or attempting to access other users’ accounts or data is prohibited.',
        'Harassment, hate speech, spam and illegal content in friend messages are prohibited. Messaging is rate limited.',
        'Accounts that break these rules may have their access restricted.'
      ]],
      ['In-game coins', [
        'Coins can only be used in the game to unlock characters and cosmetics; they cannot be exchanged for real money or transferred between accounts.',
        'Coin packs are sold through Stripe Checkout. Coins are added to your account after Stripe confirms the payment.',
        'For payment or refund questions, use the contact address below.'
      ]],
      ['Service status', [
        'Online features are under active development and may be temporarily unavailable due to maintenance or technical issues.',
        'Game rules, prices and content may change over time.'
      ]]
    ],
    contact: 'Contact:',
    back: 'Back to main menu'
  }
};

export default function TermsPage() {
  const { stats, t, language } = useSession({ loadStats: false });
  const c = language === 'English' ? CONTENT.en : CONTENT.tr;
  return (
    <PageShell activePage="settings" stats={stats} t={t} language={language}>
      <article className="legal-page">
        <h1>{c.title}</h1>
        <p className="legal-note">{c.note}</p>
        {c.sections.map(([heading, items]) => (
          <section key={heading}>
            <h2>{heading}</h2>
            <ul>{items.map(item => <li key={item}>{item}</li>)}</ul>
          </section>
        ))}
        <p>{c.contact} <ContactInfo language={language} /></p>
        <a className="legal-link" href="/">{c.back}</a>
      </article>
    </PageShell>
  );
}
