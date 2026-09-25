'use client';
// Dekoratif arka plan videosu (~6.5 MB). Önce hafif bir poster gösterilir; video yalnızca
// geniş ekranda, veri tasarrufu/yavaş bağlantı/azaltılmış hareket tercihi yokken yüklenir.
import { useEffect, useRef } from 'react';

const VIDEO_SRC = '/assets/bg-video.mp4?v=2';
const POSTER_SRC = '/assets/store_stadium_theme.webp';

export function shouldPlayBackgroundVideo(win = typeof window !== 'undefined' ? window : undefined) {
  if (!win) return false;
  const connection = win.navigator?.connection;
  if (connection?.saveData) return false;
  if (connection?.effectiveType && /(^|-)(2g|3g)$/.test(connection.effectiveType)) return false;
  if (win.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  if (win.matchMedia && !win.matchMedia('(min-width: 769px)').matches) return false;
  return true;
}

// Sayfalar arası istemci tarafı geçişte aynı <video> öğesi yeni sayfaya taşınır:
// video yeniden indirilmez ve baştan başlamaz, kaldığı yerden oynamaya devam eder.
let sharedVideo = null;

function createVideo() {
  const video = document.createElement('video');
  video.className = 'menu-video-bg';
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('aria-hidden', 'true');
  video.tabIndex = -1;
  video.poster = POSTER_SRC;
  video.src = VIDEO_SRC;
  return video;
}

export default function BackgroundVideo({ id = 'bg-video' }) {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !shouldPlayBackgroundVideo()) return undefined;
    if (!sharedVideo) sharedVideo = createVideo();
    const video = sharedVideo;
    video.id = id;
    host.appendChild(video);
    video.play().catch(() => { /* otomatik oynatma engellenirse poster kalır */ });
    return () => {
      if (video.parentNode === host) host.removeChild(video);
    };
  }, [id]);

  // Poster, JS yüklenmeden de görünsün diye sunucu HTML'inde arka plan olarak çizilir.
  return (
    <div
      ref={hostRef}
      className="menu-video-bg"
      style={{ backgroundImage: `url('${POSTER_SRC}')`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      aria-hidden="true"
    />
  );
}
