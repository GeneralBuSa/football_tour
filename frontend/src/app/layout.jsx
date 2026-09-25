import '../../css/style.css';
import ConsentAnalytics from './shared/ConsentAnalytics.jsx';
import SessionWatcher from './shared/SessionWatcher.jsx';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from './shared/siteConfig.js';

// CSS içindeki @import yerine: tarayıcı font CSS'ini ana stil dosyasını beklemeden indirir.
const FONT_STYLESHEET = 'https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700;800&family=Outfit:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Çevrimiçi Futbol Strateji Masa Oyunu`,
    template: `%s | ${SITE_NAME}`
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'tr_TR',
    url: '/',
    title: `${SITE_NAME} — Çevrimiçi Futbol Strateji Masa Oyunu`,
    description: SITE_DESCRIPTION,
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Football Tour Simulator FT26 logosu ve stadyum görseli' }]
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — Çevrimiçi Futbol Strateji Masa Oyunu`,
    description: SITE_DESCRIPTION,
    images: ['/og-image.jpg']
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' }
    ],
    apple: '/apple-touch-icon.png'
  },
  manifest: '/manifest.webmanifest'
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#020617'
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONT_STYLESHEET} />
      </head>
      <body suppressHydrationWarning>
        <a href="#main-content" className="skip-link">İçeriğe geç</a>
        <div id="main-content">{children}</div>
        <SessionWatcher />
        <ConsentAnalytics />
      </body>
    </html>
  );
}
