'use client';

import { useEffect, useState } from 'react';
import useSession from '../shared/useSession.js';
import PageShell from '../shared/PageShell.jsx';
import { PLAYER_CATALOG, STARTER_CHARACTER_KEYS } from '../../../js/data/playerCatalog.js';
import { trackEvent } from '../../../services/analytics.js';

// Giriş sonrası dönülecek sayfa (yalnızca site içi göreli yol kabul edilir).
function destination() {
  const next = new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export default function StarterPage() {
  const { isLoggedIn, mounted, gameReady, t, apiService, stats } = useSession({ loadGame: false });
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!gameReady) return;
    if (!isLoggedIn) {
      window.location.replace('/auth?next=/starter');
      return;
    }
    apiService.getCharacterEntitlements().then(entitlements => {
      if (Array.isArray(entitlements) && entitlements.some(item => STARTER_CHARACTER_KEYS.includes(item.character_key))) {
        window.location.replace(destination());
      } else {
        setLoading(false);
      }
    }).catch(() => setLoading(false));
  }, [gameReady, isLoggedIn]);

  const claim = async (key) => {
    setClaiming(true);
    setError('');
    const result = await apiService.claimStarterCharacter(key);
    if (result?.claimed) {
      trackEvent('starter_claimed', { character: key });
      window.location.replace(destination());
    } else {
      setError(result?.error || 'Starter karakter alınamadı.');
      setClaiming(false);
    }
  };

  const choices = PLAYER_CATALOG.filter(player => STARTER_CHARACTER_KEYS.includes(player.key));

  return (
    <PageShell activePage="home" stats={stats} t={t} mounted={mounted}>
      <main style={{ height: '100vh', overflowY: 'auto', display: 'grid', alignItems: 'start', justifyItems: 'center', padding: '40px 24px 96px', boxSizing: 'border-box', WebkitOverflowScrolling: 'touch' }}>
        <section style={{ width: 'min(900px, 100%)', margin: 'auto 0', padding: 32, borderRadius: 22, background: 'rgba(10,15,25,.92)', border: '1px solid rgba(41,182,246,.25)', textAlign: 'center' }}>
          <p style={{ color: '#29b6f6', letterSpacing: 3, fontWeight: 800 }}>{t.starter_welcome_pack}</p>
          <h1 style={{ color: '#fff', margin: '8px 0' }}>{t.starter_title}</h1>
          <p style={{ color: '#9eb1c9' }}>{t.starter_desc}</p>
          {loading ? <p style={{ color: '#9eb1c9' }}>{t.loading}</p> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 18, marginTop: 24 }}>
              {choices.map(player => (
                <button key={player.key} type="button" disabled={claiming} onClick={() => claim(player.key)} style={{ padding: 18, color: '#fff', background: `linear-gradient(145deg, ${player.color}55, rgba(10,15,25,.95))`, border: `1px solid ${player.color}`, borderRadius: 16, cursor: claiming ? 'wait' : 'pointer', overflow: 'hidden' }}>
                  <img src={player.refImage} alt={`${player.name} karakter görseli`} width="384" height="250" decoding="async" style={{ display: 'block', width: '100%', height: 250, objectFit: 'cover', objectPosition: 'center top', borderRadius: 12, background: 'rgba(0,0,0,.2)', marginBottom: 14 }} />
                  <strong style={{ display: 'block', fontSize: 22 }}>{player.name}</strong>
                  <span style={{ display: 'block', marginTop: 8, color: '#d8e6f5' }}>{player.archetype}</span>
                  <span style={{ display: 'block', marginTop: 18, color: '#7dffb2', fontWeight: 800 }}>{t.starter_claim_free}</span>
                </button>
              ))}
            </div>
          )}
          {error && <p role="alert" style={{ color: '#ff7070', marginTop: 18 }}>{error}</p>}
        </section>
      </main>
    </PageShell>
  );
}
