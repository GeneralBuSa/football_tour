import { pageMetadata } from '../shared/siteConfig.js';

export const metadata = pageMetadata({
  title: 'Maç Geçmişi',
  description: 'Football Tour Simulator maç geçmişin: oynadığın maçların sonuçları ve oyuncu bakiyeleri.',
  path: '/history', noindex: true
});

export default function HistoryLayout({ children }) {
  return children;
}
