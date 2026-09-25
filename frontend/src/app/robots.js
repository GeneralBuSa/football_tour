import { PRIVATE_ROUTES, SITE_URL } from './shared/siteConfig.js';

export const dynamic = 'force-static';

export default function robots() {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: PRIVATE_ROUTES }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL
  };
}
