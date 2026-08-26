// Ortak oturum/dil/stats yükleme hook'u
// Tüm sayfalarda tekrar eden auth, dil ve stats mantığını merkeze toplar
'use client';
import { useEffect, useState } from 'react';
import apiService from '../../../services/ApiService.js';
import tr from '../../locales/tr.json';
import en from '../../locales/en.json';

export default function useSession({ loadStats = true } = {}) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ total_earnings: 0, wins: 0 });
  const [language, setLanguage] = useState('Türkçe');
  const [mounted, setMounted] = useState(false);
  const [gameReady, setGameReady] = useState(false);

  const t = language === 'English' ? en : tr;

  useEffect(() => {
    // 1. Client-side durumları hemen yükle
    const logged = apiService.isLoggedIn();
    setIsLoggedIn(logged);

    const savedLang = localStorage.getItem('ft26_language') || 'Türkçe';
    setLanguage(savedLang);

    if (logged) {
      const u = apiService.getUser();
      setUser(u);
    }
    setMounted(true);

    // 2. game.js dinamik modülünü arka planda yükle
    import('../../../js/game.js').then(async () => {
      setGameReady(true);

      if (logged && loadStats) {
        const u = apiService.getUser();
        apiService.getStats(u.id).then(res => {
          if (res && !res.error) setStats(res);
        }).catch(console.error);
      }
    }).catch(console.error);
  }, []);

  return {
    isLoggedIn,
    user,
    stats,
    setStats,
    language,
    mounted,
    gameReady,
    t,
    apiService
  };
}
