'use client';
import PageShell from '../shared/PageShell.jsx';
import ContactInfo from '../shared/ContactInfo.jsx';
import useSession from '../shared/useSession.js';

// Bu metin uygulamanın gerçek veri işleme davranışını özetler; hukuki danışmanlık
// yerine geçmez. Yeni bir veri işleme eklendiğinde burası da güncellenmelidir.
const CONTENT = {
  tr: {
    title: 'Gizlilik Politikası',
    note: 'Bu metin, uygulamanın teknik olarak hangi verileri işlediğini açıklar. Yayına almadan önce hukuki açıdan gözden geçirilmesi önerilir.',
    sections: [
      ['Topladığımız veriler', [
        'Hesap: kullanıcı adı, e-posta adresi, şifrenin geri döndürülemez (bcrypt) özeti, profil avatarı ve hesap oluşturma tarihi.',
        'Oyun: istatistikler (kazanç, galibiyet, XP), başarımlar, maç geçmişi, bulut kayıtları, satın alınan ürünler ve karakterler, coin hareketleri.',
        'Sosyal: arkadaşlık istekleri ve listesi, arkadaşlar arasında gönderilen mesajlar ve oyun davetleri, eşleştirme kuyruğu ile çevrimiçi maç durumları.',
        'Ödeme: coin paketi siparişleri (paket, tutar, Stripe oturum kimliği). Kart bilgileri bu uygulamaya hiç ulaşmaz; Stripe tarafından işlenir.',
        'Güvenlik: şifre sıfırlama bağlantıları özetlenmiş (hash) olarak ve 15 dakika geçerli saklanır. Kötüye kullanımı önlemek için IP adresleri yalnızca sunucu belleğinde kısa süreli istek sınırlaması için kullanılır, veritabanına yazılmaz.'
      ]],
      ['Verileri neden kullanıyoruz', [
        'Hesabını oluşturmak ve oturumunu doğrulamak,',
        'Oyun ilerlemeni, satın aldıklarını ve maç sonuçlarını saklamak,',
        'Arkadaşlarınla eşleşmeni, mesajlaşmanı ve çevrimiçi oynamanı sağlamak,',
        'Şifre sıfırlama e-postası göndermek ve hizmeti kötüye kullanıma karşı korumak.'
      ]],
      ['Tarayıcıda saklananlar', [
        'Uygulama çerez kullanmaz. Oturum anahtarı (7 gün geçerli), kullanıcı bilgisi, dil/grafik/ses ayarları, tema, yerel oyun kayıtları ve istatistikleri tarayıcının localStorage alanında tutulur.',
        'Bu veriler oturumu kapattığında (oturum bilgileri) veya tarayıcı verilerini sildiğinde kaldırılır.'
      ]],
      ['Üçüncü taraf hizmetler', [
        'Supabase: veritabanı barındırma.',
        'Stripe: coin paketi ödemeleri (yalnızca satın alma yaptığında).',
        'Resend: şifre sıfırlama e-postaları (yalnızca yapılandırıldıysa).',
        'Google Fonts: yazı tipleri Google sunucularından yüklenir; bu sırada IP adresin Google’a iletilir.',
        'Google Analytics: yalnızca site yöneticisi etkinleştirdiyse ve sen açıkça izin verirsen anonim kullanım istatistikleri için yüklenir. Olaylara kullanıcı adı, e-posta veya mesaj içeriği eklenmez.'
      ]],
      ['Saklama süresi ve silme', [
        'Veriler hesabın açık olduğu sürece saklanır.',
        'Ayarlar → “Hesabı Sil” ile hesabını ve ona bağlı tüm verileri (istatistik, mesaj, arkadaşlık, kayıt, satın alma kayıtları) kalıcı olarak silebilirsin.',
        'Stripe gibi ödeme sağlayıcılarının yasal kayıt yükümlülükleri kendi politikalarına tabidir.'
      ]]
    ],
    contact: 'Veri talepleri ve sorular için iletişim:',
    back: 'Ana menüye dön'
  },
  en: {
    title: 'Privacy Policy',
    note: 'This text describes what the application technically processes. A legal review is recommended before launch.',
    sections: [
      ['Data we collect', [
        'Account: username, email address, an irreversible (bcrypt) hash of your password, profile avatar and sign-up date.',
        'Game: statistics (earnings, wins, XP), achievements, match history, cloud saves, purchased items and characters, coin transactions.',
        'Social: friend requests and friend list, messages and game invites sent between friends, matchmaking queue and online match states.',
        'Payments: coin pack orders (pack, amount, Stripe session id). Card details never reach this application; they are processed by Stripe.',
        'Security: password reset links are stored hashed and expire after 15 minutes. IP addresses are used only in server memory for short-term rate limiting and are not written to the database.'
      ]],
      ['Why we use it', [
        'To create your account and authenticate your session,',
        'To store your progress, purchases and match results,',
        'To let you match, chat and play online with friends,',
        'To send password reset emails and protect the service from abuse.'
      ]],
      ['Stored in your browser', [
        'The application does not use cookies. The session token (valid for 7 days), user info, language/graphics/audio settings, theme and local game saves are kept in localStorage.',
        'Session data is removed when you log out; other data when you clear your browser storage.'
      ]],
      ['Third-party services', [
        'Supabase: database hosting.',
        'Stripe: coin pack payments (only when you make a purchase).',
        'Resend: password reset emails (only if configured).',
        'Google Fonts: fonts are loaded from Google servers, which receive your IP address.',
        'Google Analytics: loaded only if enabled by the operator and you explicitly consent. Events never include usernames, emails or message content.'
      ]],
      ['Retention and deletion', [
        'Data is kept while your account exists.',
        'Settings → “Delete Account” permanently deletes your account and all related data (stats, messages, friendships, saves, purchase records).',
        'Legal record-keeping obligations of payment providers such as Stripe are governed by their own policies.'
      ]]
    ],
    contact: 'Contact for data requests and questions:',
    back: 'Back to main menu'
  }
};

export default function PrivacyPage() {
  const { stats, t, language } = useSession({ loadStats: false, loadGame: false });
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
