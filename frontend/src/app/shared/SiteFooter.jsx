// Herkese açık sayfalar arası iç bağlantılar ve (tanımlıysa) iletişim adresi.
import { CONTACT_EMAIL } from './siteConfig.js';

const LINKS = {
  tr: [
    ['/', 'Ana Menü'],
    ['/rules', 'Kurallar & SSS'],
    ['/store', 'Mağaza'],
    ['/privacy', 'Gizlilik'],
    ['/terms', 'Koşullar']
  ],
  en: [
    ['/', 'Main Menu'],
    ['/rules', 'Rules & FAQ'],
    ['/store', 'Store'],
    ['/privacy', 'Privacy'],
    ['/terms', 'Terms']
  ]
};

export default function SiteFooter({ language = 'Türkçe', compact = false, className = '' }) {
  const links = language === 'English' ? LINKS.en : LINKS.tr;
  return (
    <footer className={`site-footer ${compact ? 'compact' : ''} ${className}`}>
      <nav aria-label={language === 'English' ? 'Site links' : 'Site bağlantıları'}>
        {links.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
        {!compact && CONTACT_EMAIL && <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>}
      </nav>
    </footer>
  );
}
