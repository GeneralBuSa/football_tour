// Ortak arka plan video bileşeni
// Tüm sayfalarda tekrar eden video + overlay bloğunu tek yerde tutar
'use client';
import BackgroundVideo from './BackgroundVideo.jsx';

export default function PageBackground() {
  return (
    <div className="main-menu-container" aria-hidden="true" style={{position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', zIndex: '-1'}}>
      <BackgroundVideo />
      <div className="menu-overlay"></div>
    </div>
  );
}
