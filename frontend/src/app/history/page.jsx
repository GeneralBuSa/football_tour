'use client';
import { useEffect, useState } from 'react';
import useSession from '../shared/useSession.js';
import PageShell from '../shared/PageShell.jsx';
import EmptyState from '../shared/EmptyState.jsx';

export default function Page() {
  const { isLoggedIn, user, stats, language, gameReady, t, apiService } = useSession();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadHistory = () => {
    setLoading(true);
    setLoadError('');
    apiService.getGameHistory(user.id).then(res => {
      if (Array.isArray(res)) setHistory(res);
      else setLoadError(res?.error || 'Maç geçmişi yüklenemedi.');
    }).catch(() => setLoadError('Maç geçmişi yüklenemedi.')).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!gameReady) return;

    if (isLoggedIn && user) {
      loadHistory();
    } else {
      setLoading(false);
    }
  }, [gameReady, isLoggedIn, user]);

  return (
    <PageShell activePage="history" stats={stats} t={t} language={language}>
      <div className="menu-dynamic-screen">
        <div className="dynamic-screen-header" style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
          <button className="btn-mode-back" onClick={() => {window.location.href='/'}} style={{margin: '0', padding: '6px 12px', fontSize: '12px'}}>← {t.back}</button>
          <span>📜 {t.history_title.toUpperCase()}</span>
        </div>
        <div className="dynamic-screen-body" style={{marginTop: '20px'}}>
          {loading ? (
            <div style={{color: '#fff', textAlign: 'center', padding: '40px'}}>{t.loading}</div>
          ) : !isLoggedIn ? (
            <EmptyState icon="🔒" message={t.history_login_required} actionLabel={t.login_btn || 'Giriş Yap'} actionHref="/auth?next=/history" />
          ) : loadError ? (
            <EmptyState icon="⚠️" tone="error" message={`${loadError} Bağlantını kontrol edip tekrar dene.`} actionLabel={language === 'English' ? 'Try again' : 'Tekrar dene'} onAction={loadHistory} />
          ) : (
            <div className="history-list" id="history-container" style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              padding: '10px'
            }}>
              {history.length === 0 ? (
                <EmptyState icon="⚽" message={language === 'English' ? 'No matches yet. Play your first match to see results here.' : 'Henüz maç oynamadın. İlk maçını oyna, sonuçların burada görünsün.'} actionLabel={language === 'English' ? 'PLAY FIRST MATCH' : 'İLK MAÇINI OYNA'} actionHref="/?play=true" />
              ) : (
                history.map((game, idx) => {
                  const players = game.result_data?.players || [];
                  const winner = [...players].sort((a, b) => b.money - a.money)[0];
                  const playDate = new Date(game.played_at).toLocaleString(language === 'English' ? 'en-US' : 'tr-TR');

                  return (
                    <div key={game.id || idx} className="history-card" style={{
                      background: 'rgba(20, 24, 33, 0.85)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '10px',
                      padding: '20px',
                      color: '#fff',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                    }}>
                      <div style={{display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px', marginBottom: '12px'}}>
                        <span style={{color: '#29b6f6', fontWeight: 'bold'}}>🎮 {t.history_match_no.replace('{no}', history.length - idx)}</span>
                        <span style={{fontSize: '12px', color: '#aaa'}}>{playDate}</span>
                      </div>
                      <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                        {players.map((p, pIdx) => {
                          const isWinner = winner && winner.name === p.name;
                          return (
                            <div key={pIdx} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px'}}>
                              <span style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                <span>{p.avatar || '👤'}</span>
                                <span style={{fontWeight: isWinner ? 'bold' : 'normal', color: isWinner ? '#2ecc71' : '#fff'}}>
                                  {p.name} {isWinner ? '🏆' : ''}
                                </span>
                              </span>
                              <span style={{fontWeight: 'bold', color: isWinner ? '#2ecc71' : '#aaa'}}>
                                ₺{p.money.toLocaleString()}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
