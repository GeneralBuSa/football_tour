'use client';
import { useEffect, useState } from 'react';
import useSession from '../shared/useSession.js';
import PageShell from '../shared/PageShell.jsx';
import apiService from '../../../services/ApiService.js';
import tr from '../../locales/tr.json';
import en from '../../locales/en.json';

function CustomCheckbox({ checked, onChange }) {
  return (
    <div 
      onClick={onChange}
      style={{
        width: '20px',
        height: '20px',
        border: checked ? '1px solid #00e5ff' : '1px solid rgba(255,255,255,0.2)',
        borderRadius: '6px',
        background: checked ? 'rgba(0, 229, 255, 0.1)' : 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: checked ? '0 0 8px rgba(0, 229, 255, 0.4)' : 'none',
        transition: 'all 0.2s',
        userSelect: 'none'
      }}
    >
      {checked && (
        <span style={{
          color: '#00e5ff',
          fontSize: '11px',
          fontWeight: 'bold'
        }}>✓</span>
      )}
    </div>
  );
}

function CustomDropdown({ value, onChange, options }) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div style={{position: 'relative', width: '180px', zIndex: isOpen ? '101' : '1'}}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'rgba(0,0,0,0.5)',
          border: '1px solid rgba(41, 182, 246, 0.3)',
          color: '#fff',
          padding: '8px 14px',
          borderRadius: '8px',
          fontSize: '12px',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          userSelect: 'none',
          boxShadow: isOpen ? '0 0 10px rgba(41, 182, 246, 0.3)' : 'none',
          transition: 'all 0.2s'
        }}
      >
        <span>{value}</span>
        <span style={{
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
          fontSize: '10px'
        }}>▼</span>
      </div>
      {isOpen && (
        <>
          <div onClick={() => setIsOpen(false)} style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99}} />
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            background: 'rgba(15, 18, 25, 0.98)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(41, 182, 246, 0.3)',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.8)',
            zIndex: 100,
            overflow: 'hidden'
          }}>
            {options.map((opt) => (
              <div
                key={opt}
                onClick={() => {
                  onChange(opt);
                  setIsOpen(false);
                }}
                style={{
                  padding: '10px 14px',
                  fontSize: '12px',
                  color: value === opt ? '#00e5ff' : '#8892b0',
                  cursor: 'pointer',
                  background: value === opt ? 'rgba(0, 229, 255, 0.08)' : 'transparent',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = value === opt ? 'rgba(0, 229, 255, 0.08)' : 'transparent';
                  e.currentTarget.style.color = value === opt ? '#00e5ff' : '#8892b0';
                }}
              >
                {opt}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { isLoggedIn, user, stats, language: sessionLang, mounted, gameReady } = useSession();
  const [loading, setLoading] = useState(true);
  
  // Zenginleştirilmiş Ayar State'leri
  const [soundVolume, setSoundVolume] = useState(80);
  const [musicVolume, setMusicVolume] = useState(60);
  const [backgroundAudio, setBackgroundAudio] = useState(true);
  
  // Sesli Sohbet Ayarları
  const [voiceChat, setVoiceChat] = useState(false);
  const [voiceVolume, setVoiceVolume] = useState(70);
  const [voiceInputDevice, setVoiceInputDevice] = useState('Sistem Varsayılanı');
  const [voiceInputMode, setVoiceInputMode] = useState('Konuşmak için bas');
  const [voiceSensitivity, setVoiceSensitivity] = useState(50);

  // Grafik & Video Ayarları
  const [graphicsQuality, setGraphicsQuality] = useState('Ultramodern');
  const [fpsLimit, setFpsLimit] = useState(60);
  const [vSync, setVSync] = useState('Kapat');
  // Genel & Oynanış Ayarları
  const [language, setLanguage] = useState('Türkçe');
  const [avatarsDisabled, setAvatarsDisabled] = useState(false);
  const [emojisMuted, setEmojisMuted] = useState(false);
  const [showPing, setShowPing] = useState(true);
  const [zoomBtnDisabled, setZoomBtnDisabled] = useState(false);

  // Modal State'leri
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [promoCodeInput, setPromoCodeInput] = useState('');

  useEffect(() => {
    if (sessionLang) {
      setLanguage(sessionLang);
    }
  }, [sessionLang]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = JSON.parse(localStorage.getItem('ft26_settings') || '{}');
      if (saved.soundVolume !== undefined) setSoundVolume(saved.soundVolume);
      if (saved.musicVolume !== undefined) setMusicVolume(saved.musicVolume);
      if (saved.backgroundAudio !== undefined) setBackgroundAudio(saved.backgroundAudio);

      if (saved.voiceChat !== undefined) setVoiceChat(saved.voiceChat);
      if (saved.voiceVolume !== undefined) setVoiceVolume(saved.voiceVolume);
      if (saved.voiceInputDevice !== undefined) setVoiceInputDevice(saved.voiceInputDevice);
      if (saved.voiceInputMode !== undefined) setVoiceInputMode(saved.voiceInputMode);
      if (saved.voiceSensitivity !== undefined) setVoiceSensitivity(saved.voiceSensitivity);

      if (saved.fpsLimit !== undefined) setFpsLimit(saved.fpsLimit);
      if (saved.vSync !== undefined) setVSync(saved.vSync);

      if (saved.avatarsDisabled !== undefined) setAvatarsDisabled(saved.avatarsDisabled);
      if (saved.emojisMuted !== undefined) setEmojisMuted(saved.emojisMuted);
      if (saved.showPing !== undefined) setShowPing(saved.showPing);
      if (saved.zoomBtnDisabled !== undefined) setZoomBtnDisabled(saved.zoomBtnDisabled);

      window.ft26_settings = saved;
    }
  }, []);

  useEffect(() => {
    if (!gameReady) return;
    setLoading(false);
  }, [gameReady]);

  const updateSetting = (key, val, setter) => {
    setter(val);
    if (typeof window !== 'undefined') {
      const current = JSON.parse(localStorage.getItem('ft26_settings') || '{}');
      current[key] = val;
      localStorage.setItem('ft26_settings', JSON.stringify(current));
      window.ft26_settings = current;
    }
  };

  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    localStorage.setItem('ft26_language', newLang);
  };

  const handleLogout = () => {
    apiService.logout();
    window.location.href = '/';
  };

  const handlePromoSubmit = () => {
    if (!promoCodeInput.trim()) return;
    alert(language === 'English' ? `Promo code "${promoCodeInput}" is invalid or expired.` : `"${promoCodeInput}" promosyon kodu geçersiz veya süresi dolmuş.`);
    setPromoCodeInput('');
  };

  const t = language === 'English' ? en : tr;

  return (
    <PageShell activePage="settings" stats={stats} t={t} mounted={mounted}>
      <div className="settings-page-container" style={{display: 'flex', justifyContent: 'center'}}>
        <div className="menu-dynamic-screen" style={{width: '100%', maxWidth: '1150px'}}>
          <div className="dynamic-screen-header" style={{display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '2px solid rgba(41, 182, 246, 0.3)'}}>
            <button className="btn-mode-back" onClick={() => {window.location.href='/'}} style={{margin: '0', padding: '6px 14px', fontSize: '12px', background: 'linear-gradient(135deg, rgba(41, 182, 246, 0.2), rgba(2, 136, 209, 0.3))', border: '1px solid #29b6f6', color: '#29b6f6', borderRadius: '8px', fontWeight: 'bold'}}>{t.back}</button>
            <span style={{ textShadow: '0 0 10px rgba(41, 182, 246, 0.4)' }}>{t.settings}</span>
          </div>
          <div className="dynamic-screen-body" style={{marginTop: '20px'}}>
            {loading ? (
              <div style={{color: '#fff', textAlign: 'center', padding: '40px'}}>{t.loading}</div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '24px',
                color: '#fff'
              }}>
                {/* Sol Taraf: Genel ve Video Ayarları */}
                <div style={{
                  background: 'linear-gradient(145deg, rgba(20, 24, 33, 0.9) 0%, rgba(10, 12, 17, 0.95) 100%)',
                  border: '1px solid rgba(41, 182, 246, 0.3)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
                  borderRadius: '16px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '24px'
                }}>
                  {/* PROMOSYON KODU ALANI */}
                  <div>
                    <button 
                      onClick={() => setShowPromoModal(true)} 
                      style={{
                        width: '100%',
                        padding: '14px',
                        background: 'linear-gradient(135deg, #ffb74d 0%, #f57c00 100%)',
                        color: '#000',
                        border: 'none',
                        borderRadius: '12px',
                        fontWeight: '800',
                        fontSize: '14px',
                        cursor: 'pointer',
                        boxShadow: '0 6px 20px rgba(255, 183, 77, 0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        transition: 'transform 0.2s',
                        letterSpacing: '0.5px'
                      }}
                    >
                      🎁 {language === 'English' ? 'Redeem Promo Code' : 'Promosyon Kodu Kullan'}
                    </button>
                  </div>

                  {/* DİL & GENEL SEÇENEKLER */}
                  <div>
                    <h3 style={{fontSize: '15px', fontWeight: '800', marginBottom: '14px', color: '#00e5ff', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px', letterSpacing: '0.5px'}}>{t.general_language}</h3>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px'}}>
                        <span style={{color: '#8892b0'}}>{t.ui_lang}</span>
                        <CustomDropdown value={language} onChange={handleLanguageChange} options={['Türkçe', 'English']} />
                      </div>
                      
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px'}}>
                        <span style={{color: '#8892b0'}}>{t.show_avatars}</span>
                        <CustomCheckbox checked={!avatarsDisabled} onChange={() => updateSetting('avatarsDisabled', !avatarsDisabled, setAvatarsDisabled)} />
                      </div>

                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px'}}>
                        <span style={{color: '#8892b0'}}>{t.mute_emojis}</span>
                        <CustomCheckbox checked={emojisMuted} onChange={() => updateSetting('emojisMuted', !emojisMuted, setEmojisMuted)} />
                      </div>

                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px'}}>
                        <span style={{color: '#8892b0'}}>{t.show_ping}</span>
                        <CustomCheckbox checked={showPing} onChange={() => updateSetting('showPing', !showPing, setShowPing)} />
                      </div>

                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px'}}>
                        <span style={{color: '#8892b0'}}>{t.disable_zoom}</span>
                        <CustomCheckbox checked={zoomBtnDisabled} onChange={() => updateSetting('zoomBtnDisabled', !zoomBtnDisabled, setZoomBtnDisabled)} />
                      </div>
                    </div>
                  </div>

                  {/* VİDEO VE EKRAN AYARLARI */}
                  <div>
                    <h3 style={{fontSize: '15px', fontWeight: '800', marginBottom: '14px', color: '#00e5ff', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px', letterSpacing: '0.5px'}}>{t.video_screen}</h3>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '14px'}}>
                      <button 
                        onClick={() => {window.toggleFullscreen()}} 
                        style={{
                          width: '100%', 
                          padding: '12px', 
                          borderRadius: '10px', 
                          fontSize: '13px', 
                          background: 'linear-gradient(135deg, #00e5ff 0%, #0288d1 100%)',
                          color: '#000',
                          border: 'none',
                          fontWeight: '800',
                          cursor: 'pointer',
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          boxShadow: '0 4px 15px rgba(0, 229, 255, 0.3)',
                          transition: 'all 0.2s'
                        }}
                      >
                        {t.fullscreen_btn}
                      </button>
                      
                      <div>
                        <div style={{fontSize: '12px', color: '#8892b0', marginBottom: '6px', fontWeight: 'bold'}}>{t.fps_limit}</div>
                        <div style={{display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '8px'}}>
                          {[30, 60, 120].map(f => (
                            <button key={f} onClick={() => updateSetting('fpsLimit', f, setFpsLimit)} style={{flex: 1, padding: '8px', background: fpsLimit === f ? '#00e5ff' : 'transparent', color: fpsLimit === f ? '#000' : '#8892b0', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer'}}>{f} FPS</button>
                          ))}
                        </div>
                      </div>

                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px'}}>
                        <span style={{color: '#8892b0'}}>{t.vsync}</span>
                        <CustomDropdown value={vSync} onChange={(val) => updateSetting('vSync', val, setVSync)} options={['Kapat', 'Aç', '1/2']} />
                      </div>
                    </div>
                  </div>

                  {/* HESAP SEÇENEKLERİ */}
                  {isLoggedIn && (
                    <div>
                      <h3 style={{fontSize: '15px', fontWeight: '800', marginBottom: '14px', color: '#00e5ff', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px', letterSpacing: '0.5px'}}>{t.account_options}</h3>
                      <button className="mbtn" onClick={handleLogout} style={{
                        width: '100%', 
                        background: 'linear-gradient(135deg, #ff5252, #ff1744)',
                        color: '#fff', 
                        padding: '12px', 
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                        fontSize: '13px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 15px rgba(255, 23, 68, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}>
                        {t.logout_btn}
                      </button>
                    </div>
                  )}
                </div>

                {/* Sağ Taraf: Ses ve Sesli Sohbet Ayarları */}
                <div style={{
                  background: 'linear-gradient(145deg, rgba(20, 24, 33, 0.9) 0%, rgba(10, 12, 17, 0.95) 100%)',
                  border: '1px solid rgba(41, 182, 246, 0.3)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
                  borderRadius: '16px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '24px'
                }}>
                  {/* SES VE MÜZİK */}
                  <div>
                    <h3 style={{fontSize: '15px', fontWeight: '800', marginBottom: '18px', color: '#00e5ff', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px', letterSpacing: '0.5px'}}>{t.general_sound}</h3>
                    <div style={{marginBottom: '14px'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px', fontWeight: '600'}}>
                        <span style={{color: '#8892b0'}}>{t.sfx_volume}</span>
                        <span style={{color: '#00e5ff'}}>%{soundVolume}</span>
                      </div>
                      <input type="range" min="0" max="100" value={soundVolume} onChange={(e) => updateSetting('soundVolume', Number(e.target.value), setSoundVolume)} style={{width: '100%', accentColor: '#00e5ff', cursor: 'pointer'}} />
                    </div>
                    
                    <div style={{marginBottom: '14px'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px', fontWeight: '600'}}>
                        <span style={{color: '#8892b0'}}>{t.music_volume}</span>
                        <span style={{color: '#00e5ff'}}>%{musicVolume}</span>
                      </div>
                      <input type="range" min="0" max="100" value={musicVolume} onChange={(e) => updateSetting('musicVolume', Number(e.target.value), setMusicVolume)} style={{width: '100%', accentColor: '#00e5ff', cursor: 'pointer'}} />
                    </div>

                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px'}}>
                      <span style={{color: '#8892b0'}}>{t.bg_audio}</span>
                      <CustomCheckbox checked={backgroundAudio} onChange={() => updateSetting('backgroundAudio', !backgroundAudio, setBackgroundAudio)} />
                    </div>
                  </div>

                  {/* SESLİ SOHBET (VOICE CHAT) */}
                  <div>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px', marginBottom: '16px'}}>
                      <h3 style={{fontSize: '15px', fontWeight: '800', color: '#00e5ff', letterSpacing: '0.5px', margin: '0'}}>{t.voice_chat}</h3>
                      <CustomCheckbox checked={voiceChat} onChange={() => updateSetting('voiceChat', !voiceChat, setVoiceChat)} />
                    </div>

                    {voiceChat && (
                      <div style={{display: 'flex', flexDirection: 'column', gap: '14px', animation: 'fadeIn 0.2s'}}>
                        <div>
                          <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px', fontWeight: '600'}}>
                            <span style={{color: '#8892b0'}}>{t.voice_volume}</span>
                            <span style={{color: '#00e5ff'}}>%{voiceVolume}</span>
                          </div>
                          <input type="range" min="0" max="100" value={voiceVolume} onChange={(e) => updateSetting('voiceVolume', Number(e.target.value), setVoiceVolume)} style={{width: '100%', accentColor: '#00e5ff', cursor: 'pointer'}} />
                        </div>

                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px'}}>
                          <span style={{color: '#8892b0'}}>{t.input_device}</span>
                          <CustomDropdown value={voiceInputDevice} onChange={(val) => updateSetting('voiceInputDevice', val, setVoiceInputDevice)} options={['Sistem Varsayılanı', 'Microphone Array (Digit...)', 'Harici Mikrofon']} />
                        </div>

                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', marginTop: '12px'}}>
                          <span style={{color: '#8892b0'}}>{t.input_mode}</span>
                          <CustomDropdown value={voiceInputMode} onChange={(val) => updateSetting('voiceInputMode', val, setVoiceInputMode)} options={['Konuşmak için bas', 'Açık / Sürekli İletişim']} />
                        </div>

                        <div>
                          <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px', fontWeight: '600'}}>
                            <span style={{color: '#8892b0'}}>{t.mic_sensitivity}</span>
                            <span style={{color: '#00e5ff'}}>%{voiceSensitivity}</span>
                          </div>
                          <input type="range" min="0" max="100" value={voiceSensitivity} onChange={(e) => updateSetting('voiceSensitivity', Number(e.target.value), setVoiceSensitivity)} style={{width: '100%', accentColor: '#00e5ff', cursor: 'pointer'}} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Alt Bilgi & Destek Butonları Grid'i */}
            <div style={{
              marginTop: '30px',
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '12px',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              paddingTop: '20px'
            }}>
              <button 
                onClick={() => { window.location.href = '/privacy'; }}
                style={{
                  margin: '0', 
                  padding: '12px', 
                  fontSize: '12px', 
                  fontWeight: '700',
                  borderRadius: '10px',
                  background: 'linear-gradient(145deg, rgba(46, 204, 113, 0.15) 0%, rgba(39, 174, 96, 0.25) 100%)',
                  border: '1px solid #2ecc71',
                  color: '#2ecc71',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(46, 204, 113, 0.15)',
                  transition: 'all 0.2s'
                }}
              >
                {t.privacy_policy}
              </button>

              <button 
                onClick={() => { window.location.href = '/terms'; }}
                style={{
                  margin: '0', 
                  padding: '12px', 
                  fontSize: '12px', 
                  fontWeight: '700',
                  borderRadius: '10px',
                  background: 'linear-gradient(145deg, rgba(41, 182, 246, 0.15) 0%, rgba(2, 136, 209, 0.25) 100%)',
                  border: '1px solid #29b6f6',
                  color: '#29b6f6',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(41, 182, 246, 0.15)',
                  transition: 'all 0.2s'
                }}
              >
                {t.terms_of_service}
              </button>

              <button 
                onClick={() => { window.location.href = '/rules'; }}
                style={{
                  margin: '0', 
                  padding: '12px', 
                  fontSize: '12px', 
                  fontWeight: '700',
                  borderRadius: '10px',
                  background: 'linear-gradient(145deg, rgba(255, 183, 77, 0.15) 0%, rgba(245, 124, 0, 0.25) 100%)',
                  border: '1px solid #ffb74d',
                  color: '#ffb74d',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(255, 183, 77, 0.15)',
                  transition: 'all 0.2s'
                }}
              >
                {t.rules}
              </button>

              <button 
                onClick={() => setShowCreditsModal(true)} 
                style={{
                  margin: '0', 
                  padding: '12px', 
                  fontSize: '12px', 
                  fontWeight: '700',
                  borderRadius: '10px',
                  background: 'linear-gradient(145deg, rgba(156, 39, 176, 0.15) 0%, rgba(123, 31, 162, 0.25) 100%)',
                  border: '1px solid #ba68c8',
                  color: '#e1bee7',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(156, 39, 176, 0.15)',
                  transition: 'all 0.2s'
                }}
              >
                {t.credits || 'Emeği Geçenler'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Promosyon Kodu Modal */}
      {showPromoModal && (
        <div className="modal-backdrop" style={{ zIndex: 1000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}>
          <div className="modal" style={{ maxWidth: '420px', background: 'linear-gradient(145deg, #141821 0%, #0d1017 100%)', border: '1px solid #ffb74d', borderRadius: '16px', padding: '24px', color: '#fff', boxShadow: '0 10px 40px rgba(255,183,77,0.3)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#ffb74d', marginBottom: '14px', textAlign: 'center' }}>🎁 {language === 'English' ? 'REDEEM PROMO CODE' : 'PROMOSYON KODU KULLAN'}</h3>
            <p style={{ fontSize: '12px', color: '#8892b0', marginBottom: '16px', textAlign: 'center' }}>
              {language === 'English' ? 'Enter your gift code to unlock special coins and rewards!' : 'Özel hediyelerinizi ve ödüllerinizi yüklemek için kodunuzu girin!'}
            </p>
            <input 
              type="text"
              value={promoCodeInput}
              onChange={(e) => setPromoCodeInput(e.target.value)}
              placeholder="Örn: FT26-GOLD-2026"
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid rgba(255,183,77,0.4)',
                background: 'rgba(0,0,0,0.5)',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 'bold',
                textAlign: 'center',
                letterSpacing: '1px',
                outline: 'none',
                marginBottom: '16px'
              }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={() => setShowPromoModal(false)}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', fontWeight: 'bold', cursor: 'pointer' }}
              >
                {t.back || 'İptal'}
              </button>
              <button 
                onClick={handlePromoSubmit}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'linear-gradient(135deg, #ffb74d, #f57c00)', border: 'none', color: '#000', fontWeight: '800', cursor: 'pointer' }}
              >
                {language === 'English' ? 'Redeem' : 'Kullan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Emeği Geçenler Modal */}
      {showCreditsModal && (
        <div className="modal-backdrop" style={{ zIndex: 1000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}>
          <div className="modal" style={{ maxWidth: '420px', background: 'linear-gradient(145deg, #141821 0%, #0d1017 100%)', border: '1px solid #ba68c8', borderRadius: '16px', padding: '24px', color: '#fff', boxShadow: '0 10px 40px rgba(186,104,200,0.3)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#ba68c8', marginBottom: '14px', textAlign: 'center' }}>⭐ {language === 'English' ? 'GAME CREDITS' : 'EMEĞİ GEÇENLER'}</h3>
            <div style={{ fontSize: '13px', lineHeight: '1.8', color: '#e5e2e1', textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontWeight: '800', color: '#00e5ff', fontSize: '15px' }}>FOOTBALL TOUR SIMULATOR — 3D</div>
              <div style={{ fontSize: '11px', color: '#8892b0', marginBottom: '14px' }}>v1.02 Isometric Edition</div>
              <p><strong>Geliştirici & Tasarım:</strong> Football Tour Dev Team</p>
              <p><strong>3D Sahne & Motor:</strong> Three.js Engine</p>
              <p><strong>Ses & Müzik:</strong> Sound Assets Studio</p>
              <p><strong>Altyapı & Veritabanı:</strong> Supabase Cloud Service</p>
            </div>
            <button 
              onClick={() => setShowCreditsModal(false)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'linear-gradient(135deg, #ba68c8, #7b1fa2)', border: 'none', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}
            >
              {language === 'English' ? 'Close' : 'Kapat'}
            </button>
          </div>
        </div>
      )}
    </PageShell>
  );
}
