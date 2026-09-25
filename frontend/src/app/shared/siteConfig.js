// Site genelinde kullanılan SEO ve iletişim ayarları. Değerler build sırasında
// ortam değişkenlerinden okunur; kaynak koda gerçek alan adı/e-posta yazılmaz.
export const SITE_NAME = 'Football Tour Simulator';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

export const SITE_DESCRIPTION =
  'Football Tour Simulator (FT26), futbol temalı, Monopoly tarzı bir strateji masa oyunudur. Şehir satın al, stadyum kur, arkadaşlarınla çevrimiçi eşleş ve maçları kazan.';

// Gerçek bir iletişim adresi tanımlanmadıysa arayüz bunu açıkça belirtir.
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || '';

// Arama motorlarında listelenecek herkese açık sayfalar (sitemap.xml).
export const PUBLIC_ROUTES = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/rules', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/store', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 }
];

// Hesaba özel veya içerik değeri olmayan sayfalar: robots.txt ile engellenir ve noindex alır.
export const PRIVATE_ROUTES = ['/auth', '/profile', '/settings', '/starter', '/history', '/achievements', '/battlepass', '/showcase'];

export function pageMetadata({ title, description, path, noindex = false }) {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
      url: path,
      siteName: SITE_NAME,
      locale: 'tr_TR',
      type: 'website',
      images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Football Tour Simulator FT26' }]
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | ${SITE_NAME}`,
      description,
      images: ['/og-image.jpg']
    },
    ...(noindex ? { robots: { index: false, follow: false } } : {})
  };
}
