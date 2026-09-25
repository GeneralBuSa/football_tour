// Onaya bağlı, isteğe bağlı analitik (Google Analytics 4).
// NEXT_PUBLIC_GA_MEASUREMENT_ID tanımlı değilse hiçbir script yüklenmez ve
// tüm çağrılar sessizce yok sayılır. Olaylara kişisel veri (e-posta, kullanıcı adı,
// mesaj içeriği vb.) eklenmez.

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '';
export const CONSENT_STORAGE_KEY = 'ft26_analytics_consent';

// Ürün yolculuğu için izin verilen olaylar. Buraya eklenmeyen olay gönderilmez.
export const JOURNEY_EVENTS = new Set([
  'play_cta_click',
  'sign_up',
  'login',
  'starter_claimed',
  'matchmaking_started',
  'match_found',
  'private_room_created',
  'private_room_joined',
  'online_game_started',
  'game_finished',
  'friend_request_sent',
  'purchase',
  'begin_checkout'
]);

const SAFE_PARAM = /^[a-z_]{1,40}$/;

export function isAnalyticsConfigured() {
  return !!GA_MEASUREMENT_ID;
}

export function readConsent() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(CONSENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeConsent(value) {
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, value);
  } catch { /* depolama kapalıysa sadece bu oturum için geçerli */ }
  window.dispatchEvent(new CustomEvent('ft26:analytics-consent', { detail: value }));
}

// Sadece sayı, boolean ve kısa sabit metinler geçer; serbest metin ve PII atılır.
export function sanitizeParams(params = {}) {
  const clean = {};
  Object.entries(params).forEach(([key, value]) => {
    if (!SAFE_PARAM.test(key)) return;
    if (typeof value === 'number' && Number.isFinite(value)) clean[key] = value;
    else if (typeof value === 'boolean') clean[key] = value;
    else if (typeof value === 'string' && /^[a-z0-9_-]{1,40}$/i.test(value)) clean[key] = value;
  });
  return clean;
}

export function trackEvent(name, params = {}) {
  if (typeof window === 'undefined' || !isAnalyticsConfigured()) return false;
  if (!JOURNEY_EVENTS.has(name)) return false;
  if (readConsent() !== 'granted' || typeof window.gtag !== 'function') return false;
  window.gtag('event', name, sanitizeParams(params));
  return true;
}
