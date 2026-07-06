// Ortak arka plan video bileşeni
// Tüm sayfalarda tekrar eden video + overlay bloğunu tek yerde tutar
'use client';

export default function PageBackground() {
  return (
    <div className="main-menu-container" style={{position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', zIndex: '-1'}}>
      <video autoPlay loop muted playsInline id="bg-video" className="menu-video-bg">
        <source src="/assets/bg-video.mp4?v=2" type="video/mp4" />
      </video>
      <div className="menu-overlay"></div>
    </div>
  );
}
