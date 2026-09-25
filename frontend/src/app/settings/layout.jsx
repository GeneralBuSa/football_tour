import { pageMetadata } from '../shared/siteConfig.js';

export const metadata = pageMetadata({
  title: 'Ayarlar',
  description: 'Football Tour Simulator ayarları: arayüz dili, tam ekran, FPS sınırı, VSync ve hesap yönetimi.',
  path: '/settings', noindex: true
});

export default function SettingsLayout({ children }) {
  return children;
}
