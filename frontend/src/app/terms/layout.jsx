import { pageMetadata } from '../shared/siteConfig.js';

export const metadata = pageMetadata({
  title: 'Kullanım Koşulları',
  description: 'Football Tour Simulator hesap, oyun içi coin, çevrimiçi özellikler ve kabul edilebilir kullanım koşulları.',
  path: '/terms'
});

export default function TermsLayout({ children }) {
  return children;
}
