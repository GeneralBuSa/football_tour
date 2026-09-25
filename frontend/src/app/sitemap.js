import { PUBLIC_ROUTES, SITE_URL } from './shared/siteConfig.js';

export const dynamic = 'force-static';

// Sadece herkese açık, indekslenmesi istenen sayfalar. Dinamik route yoktur.
export default function sitemap() {
  const lastModified = new Date();
  return PUBLIC_ROUTES.map(route => ({
    url: `${SITE_URL}${route.path === '/' ? '' : route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority
  }));
}
