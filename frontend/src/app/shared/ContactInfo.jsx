// Gerçek iletişim adresi NEXT_PUBLIC_CONTACT_EMAIL ile tanımlanır. Tanımlı değilse
// sahte bir adres göstermek yerine eksik olduğu açıkça belirtilir.
import { CONTACT_EMAIL } from './siteConfig.js';

export default function ContactInfo({ language = 'Türkçe' }) {
  if (CONTACT_EMAIL) {
    return <a href={`mailto:${CONTACT_EMAIL}`} className="legal-link">{CONTACT_EMAIL}</a>;
  }
  return (
    <span className="legal-placeholder">
      {language === 'English'
        ? '[Contact address not configured yet — set NEXT_PUBLIC_CONTACT_EMAIL]'
        : '[İletişim adresi henüz tanımlanmadı — NEXT_PUBLIC_CONTACT_EMAIL ayarlanmalı]'}
    </span>
  );
}
