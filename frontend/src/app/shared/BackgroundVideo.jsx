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

export default function BackgroundVideo({ id = 'bg-video' }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !shouldPlayBackgroundVideo()) return;
    video.src = VIDEO_SRC;
    video.play().catch(() => { /* otomatik oynatma engellenirse poster kalır */ });
  }, []);

  return (
    <video
      ref={videoRef}
      id={id}
      className="menu-video-bg"
      muted
      loop
      playsInline
      preload="none"
      poster={POSTER_SRC}
      aria-hidden="true"
      tabIndex={-1}
      suppressHydrationWarning
    />
  );
}
