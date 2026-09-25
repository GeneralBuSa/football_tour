'use client';
// Analitik yalnızca ortam değişkeni tanımlıysa ve kullanıcı açıkça izin verirse yüklenir.
// Uygulama kendi başına çerez kullanmaz (oturum localStorage'da tutulur); bu nedenle
// analitik kapalıyken çerez bildirimi gösterilmez.
import { useEffect, useState } from 'react';
import {
  GA_MEASUREMENT_ID, isAnalyticsConfigured, readConsent, writeConsent
} from '../../../services/analytics.js';

function loadGoogleAnalytics() {
  if (document.getElementById('ga-loader')) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, { anonymize_ip: true });
  const script = document.createElement('script');
  script.id = 'ga-loader';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`;
  document.head.appendChild(script);
}

export default function ConsentAnalytics() {
  const [consent, setConsent] = useState('unknown');

  useEffect(() => {
    if (!isAnalyticsConfigured()) return undefined;
    const stored = readConsent();
    setConsent(stored || 'pending');
    if (stored === 'granted') loadGoogleAnalytics();

    const onChange = event => setConsent(event.detail);
    window.addEventListener('ft26:analytics-consent', onChange);
    return () => window.removeEventListener('ft26:analytics-consent', onChange);
  }, []);

  if (!isAnalyticsConfigured() || consent !== 'pending') return null;

  const decide = value => {
    writeConsent(value);
    setConsent(value);
    if (value === 'granted') loadGoogleAnalytics();
  };

  return (
    <div className="consent-banner" role="dialog" aria-live="polite" aria-label="Çerez ve analitik tercihi">
      <p>
        Oyunu geliştirmek için anonim kullanım istatistikleri (Google Analytics) toplamak istiyoruz.
        Bu, analitik çerezleri kullanır ve yalnızca izin verirsen etkinleşir.{' '}
        <a href="/privacy">Gizlilik Politikası</a>
      </p>
      <div className="consent-actions">
        <button type="button" className="mbtn mbtn-pass" onClick={() => decide('denied')}>Reddet</button>
        <button type="button" className="mbtn mbtn-buy" onClick={() => decide('granted')}>Kabul Et</button>
      </div>
    </div>
  );
}
