import { pageMetadata } from '../shared/siteConfig.js';

export const metadata = pageMetadata({
  title: 'Mağaza',
  description: 'FT26 mağazası: futbolcu karakterleri ve oyun içi kozmetikleri coin ile aç, coin paketlerini güvenli Stripe ödemesiyle satın al.',
  path: '/store'
});

export default function StoreLayout({ children }) {
  return children;
}
