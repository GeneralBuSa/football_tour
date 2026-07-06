'use client';
import { useEffect, useState } from 'react';
import useSession from '../shared/useSession.js';
import PageShell from '../shared/PageShell.jsx';
import gameService from '../../../services/GameService.js';

export default function Page() {
  const { isLoggedIn, user, stats, language, mounted, gameReady, t } = useSession();
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!gameReady) return;

    // GameService başlatılıp başarımlar yükleniyor
    gameService.init().then(() => {
      try {
        const allAch = gameService.achievement.getAll();
        setAchievements(allAch);
      } catch (e) {
        console.error("Başarımlar yüklenirken hata:", e);
      } finally {
        setLoading(false);
      }
    }).catch(console.error);
  }, [gameReady]);

  return (
    <PageShell activePage="achievements" stats={stats} t={t} mounted={mounted}>
      <div className="menu-dynamic-screen">
        <div className="dynamic-screen-header" style={{position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
          <button className="btn-mode-back" onClick={() => {window.location.href='/'}} style={{position: 'absolute', left: '0', margin: '0', padding: '6px 12px', fontSize: '12px'}}>← {t.back}</button>
          <span id="ach-header">{t.achievements_header}</span>
        </div>
        <div className="dynamic-screen-body" style={{marginTop: '20px'}}>
          {loading ? (
            <div style={{color: '#fff', textAlign: 'center', padding: '40px'}}>{t.loading}</div>
          ) : (
            <div className="achievements-list" id="ach-container" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '20px',
              padding: '10px'
            }}>
              {achievements.map(ach => {
                const achName = t[`ach_${ach.id}_name`] || ach.name;
                const achDesc = t[`ach_${ach.id}_desc`] || ach.desc;
                const unlockDate = ach.unlockedAt ? new Date(ach.unlockedAt).toLocaleDateString(language === 'English' ? 'en-US' : 'tr-TR') : '';

                return (
                  <div key={ach.id} className="achievement-card" style={{
                    background: ach.unlocked ? 'rgba(46, 204, 113, 0.15)' : 'rgba(20, 24, 33, 0.85)',
                    border: ach.unlocked ? '1px solid #2ecc71' : '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    padding: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    color: '#fff',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                    transition: 'transform 0.2s'
                  }}>
                    <div style={{ fontSize: '36px', opacity: ach.unlocked ? 1 : 0.4 }}>
                      {ach.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ 
                        fontSize: '16px', 
                        fontWeight: 'bold', 
                        margin: '0 0 4px 0',
                        color: ach.unlocked ? '#2ecc71' : '#fff' 
                      }}>
                        {achName}
                      </h3>
                      <p style={{ fontSize: '12px', color: '#ccc', margin: 0 }}>{achDesc}</p>
                      {ach.unlocked && (
                        <span style={{ 
                          fontSize: '10px', 
                          color: '#2ecc71', 
                          display: 'block', 
                          marginTop: '6px',
                          fontWeight: '600'
                        }}>
                          {t.achievements_unlocked.replace('{date}', unlockDate)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
