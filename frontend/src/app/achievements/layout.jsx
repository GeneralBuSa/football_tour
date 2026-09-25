import { pageMetadata } from '../shared/siteConfig.js';

export const metadata = pageMetadata({
  title: 'Başarımlar',
  description: 'Football Tour Simulator başarımların: açtığın ve açılmayı bekleyen tüm kupa ve rozetler.',
  path: '/achievements', noindex: true
});

export default function AchievementsLayout({ children }) {
  return children;
}
