import { pageMetadata } from '../shared/siteConfig.js';

export const metadata = pageMetadata({
  title: 'Profil',
  description: 'Football Tour Simulator oyuncu profilin: istatistiklerin, avatarın, karakterlerin ve envanterin.',
  path: '/profile', noindex: true
});

export default function ProfileLayout({ children }) {
  return children;
}
