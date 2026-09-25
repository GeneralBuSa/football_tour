// Veritabanı/servis hatalarını loglar, istemciye iç detay (tablo, constraint,
// SQL mesajı) sızdırmadan anlaşılır bir mesaj döndürür.
export const GENERIC_DB_ERROR = 'İşlem şu anda tamamlanamadı. Lütfen biraz sonra tekrar deneyin.';

export function sendDbError(res, error, { status = 500, message = GENERIC_DB_ERROR, context } = {}) {
  const where = context || `${res.req?.method || ''} ${res.req?.originalUrl || ''}`.trim();
  console.error(`[db] ${where}:`, error?.message || error);
  return res.status(status).json({ error: message });
}
