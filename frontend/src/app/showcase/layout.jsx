import { pageMetadata } from '../shared/siteConfig.js';

export const metadata = pageMetadata({
  title: 'Karakter Vitrini',
  description: 'Football Tour Simulator futbolcu karakterlerinin 3D modellerini incelediğin karakter vitrini.',
  path: '/showcase', noindex: true
});

export default function ShowcaseLayout({ children }) {
  return children;
}
