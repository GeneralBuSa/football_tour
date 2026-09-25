import { pageMetadata } from '../shared/siteConfig.js';

export const metadata = pageMetadata({
  title: 'Başlangıç Karakteri',
  description: 'Football Tour Simulator hoş geldin paketi: ücretsiz başlangıç futbolcu karakterini seç.',
  path: '/starter', noindex: true
});

export default function StarterLayout({ children }) {
  return children;
}
