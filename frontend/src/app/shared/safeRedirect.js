// Giriş sonrası dönülecek ?next= yolunu doğrular: yalnızca site içi göreli yollar.
// Basit "/" ile başlıyor kontrolü yetmez: tarayıcılar "/\evil.com" yolunu "//evil.com"
// (başka site) olarak yorumlar. Bu yüzden yol gerçekten çözümlenip köken karşılaştırılır.
const PROBE_ORIGIN = 'https://ft26.invalid';

export function safeNextPath(value, { excludePrefixes = [] } = {}) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return null;

  let url;
  try {
    url = new URL(value, PROBE_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== PROBE_ORIGIN) return null;
  if (excludePrefixes.some(prefix => url.pathname.startsWith(prefix))) return null;
  return url.pathname + url.search + url.hash;
}
