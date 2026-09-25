// Ortak oturum/dil/stats yükleme hook'u
// Tüm sayfalarda tekrar eden auth, dil ve stats mantığını merkeze toplar
'use client';
import { useEffect, useState } from 'react';
import apiService from '../../../services/ApiService.js';
import tr from '../../locales/tr.json';
import en from '../../locales/en.json';

// Sayfalar arası istemci tarafı geçişte modül durumu korunur: üst menüdeki bakiye
// her sayfada boş başlayıp API'yi beklemek yerine son bilinen değerle hemen görünür,
// ardından arka planda tazelenir.
let cachedStats = null;

// Oyun ekranındaki tema tercihi (js/ui/settings.js initTheme ile aynı anahtar).
// Başarımlar gibi sayfalar .light-theme stillerini kullanır; bunun için oyun motorunu
// (Three.js dahil ~700 KB) yüklemeye gerek yoktur.
function applySavedTheme() {
  try {
    document.body.classList.toggle('light-theme', localStorage.getItem('game_theme') === 'light');
  } catch { /* depolama kapalı: varsayılan koyu tema */ }
}

// Oyun motoru (js/game.js) burada yüklenmez: oyun ekranı yalnızca ana sayfadadır.
export default function useSession({ loadStats = true } = {}) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  // Bakiye yüklenene kadar boş kalır; üst menü sahte bir "₺0" göstermez.
  const [stats, setStats] = useState({});
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
    applySavedTheme();

    const u = logged ? apiService.getUser() : null;
    if (u) setUser(u);
    setMounted(true);

    setGameReady(true);

    if (u && loadStats) {
      if (cachedStats && cachedStats.userId === u.id) setStats(cachedStats.data);
      apiService.getStats(u.id).then(res => {
        if (res && !res.error) setStats(res);
      }).catch(console.error);
    }
  }, []);

  // Sayfa içi güncellemeler (mağaza satın alımı, promosyon kodu) de önbelleğe yansır.
  useEffect(() => {
    if (user?.id && typeof stats?.total_earnings === 'number') cachedStats = { userId: user.id, data: stats };
  }, [stats, user]);

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
