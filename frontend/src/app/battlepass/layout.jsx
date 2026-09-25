import { pageMetadata } from '../shared/siteConfig.js';

export const metadata = pageMetadata({
  title: 'Savaş Bileti',
  description: 'Football Tour Simulator savaş bileti: XP ile ilerleyen seviyelerin ve kazanılacak ödüller.',
  path: '/battlepass', noindex: true
});

export default function BattlepassLayout({ children }) {
  return children;
}
