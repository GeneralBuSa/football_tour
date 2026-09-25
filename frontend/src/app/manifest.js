import { SITE_DESCRIPTION, SITE_NAME } from './shared/siteConfig.js';

export const dynamic = 'force-static';

export default function manifest() {
  return {
    name: SITE_NAME,
    short_name: 'FT26',
    description: SITE_DESCRIPTION,
    start_url: '/',
    display: 'fullscreen',
    background_color: '#020617',
    theme_color: '#020617',
    lang: 'tr',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
    ]
  };
}
