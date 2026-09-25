import { pageMetadata } from '../shared/siteConfig.js';

export const metadata = pageMetadata({
  title: 'Oyun Kuralları ve SSS',
  description: 'Football Tour Simulator nasıl oynanır: zar, şehir satın alma, kira, stadyum yükseltme, çevrimiçi eşleşme ve sık sorulan sorular.',
  path: '/rules'
});

export default function RulesLayout({ children }) {
  return children;
}
