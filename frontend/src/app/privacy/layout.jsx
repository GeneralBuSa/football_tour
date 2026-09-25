import { pageMetadata } from '../shared/siteConfig.js';

export const metadata = pageMetadata({
  title: 'Gizlilik Politikası',
  description: 'Football Tour Simulator hangi verileri neden işler, nerede saklar ve hangi üçüncü taraf servisleri kullanır.',
  path: '/privacy'
});

export default function PrivacyLayout({ children }) {
  return children;
}
