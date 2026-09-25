'use client';
// Oturum süresi dolduğunda (API 401) veya başka bir sekmede çıkış yapıldığında
// kullanıcıyı sessizce bozuk bir ekranda bırakmak yerine bilgilendirir.
import { useEffect, useState } from 'react';

const TOKEN_KEY = 'ft26_auth_token';

export default function SessionWatcher() {
  const [reason, setReason] = useState(null);

  useEffect(() => {
    const onExpired = () => setReason('expired');
    const onStorage = event => {
      if (event.key !== TOKEN_KEY) return;
      // Başka sekmede çıkış yapıldı veya farklı hesaba girildi.
      if (!event.newValue) setReason('logged_out');
      else if (event.oldValue && event.oldValue !== event.newValue) window.location.reload();
    };
    window.addEventListener('ft26:session-expired', onExpired);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('ft26:session-expired', onExpired);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  if (!reason) return null;

  const next = typeof window !== 'undefined' ? window.location.pathname : '/';
  const loginHref = `/auth?next=${encodeURIComponent(next)}`;

  return (
    <div className="session-banner" role="alert">
      <span>
        {reason === 'expired'
          ? 'Oturumunun süresi doldu. Devam etmek için tekrar giriş yap.'
          : 'Başka bir sekmede çıkış yapıldı.'}
      </span>
      <div className="session-banner-actions">
        <a className="mbtn mbtn-buy" href={loginHref}>Giriş Yap</a>
        <button type="button" className="mbtn mbtn-pass" onClick={() => window.location.assign('/')}>Ana Menü</button>
      </div>
    </div>
  );
}
