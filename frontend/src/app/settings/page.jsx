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


  useEffect(() => {
    if (sessionLang) {
      setLanguage(sessionLang);
    }
  }, [sessionLang]);

  useEffect(() => {
    if (!gameReady) return;
    setLoading(false);
  }, [gameReady]);

  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    localStorage.setItem('ft26_language', newLang);
  };

  const handleLogout = () => {
    apiService.logout();
    window.location.href = '/';
  };

  const showPromptPlaceholder = (title) => {
    alert(`${title} yakında eklenecek!`);
  };

  const t = language === 'English' ? en : tr;

  return (
    <PageShell activePage="settings" stats={stats} t={t} mounted={mounted}>
      <div className="settings-page-container" style={{display: 'flex', justifyContent: 'center'}}>
        <div className="menu-dynamic-screen" style={{width: '100%', maxWidth: '1150px'}}>
          <div className="dynamic-screen-header" style={{display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '2px solid rgba(41, 182, 246, 0.3)'}}>
            <button className="btn-mode-back" onClick={() => {window.location.href='/'}} style={{margin: '0', padding: '6px 12px', fontSize: '12px'}}>← {t.back}</button>
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
                        <CustomCheckbox checked={!avatarsDisabled} onChange={() => setAvatarsDisabled(!avatarsDisabled)} />
                      </div>

                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px'}}>
                        <span style={{color: '#8892b0'}}>{t.mute_emojis}</span>
                        <CustomCheckbox checked={emojisMuted} onChange={() => setEmojisMuted(!emojisMuted)} />
                      </div>

                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px'}}>
                        <span style={{color: '#8892b0'}}>{t.show_ping}</span>
                        <CustomCheckbox checked={showPing} onChange={() => setShowPing(!showPing)} />
                      </div>

                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px'}}>
                        <span style={{color: '#8892b0'}}>{t.disable_zoom}</span>
                        <CustomCheckbox checked={zoomBtnDisabled} onChange={() => setZoomBtnDisabled(!zoomBtnDisabled)} />
                      </div>
                    </div>
                  </div>

                  {/* VİDEO VE EKRAN AYARLARI */}
                  <div>
                    <h3 style={{fontSize: '15px', fontWeight: '800', marginBottom: '14px', color: '#00e5ff', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px', letterSpacing: '0.5px'}}>{t.video_screen}</h3>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '14px'}}>
                      <button className="mbtn mbtn-pass" onClick={() => {window.toggleFullscreen()}} style={{width: '100%', padding: '12px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}}>{t.fullscreen_btn}</button>
                      
                      <div>
                        <div style={{fontSize: '12px', color: '#8892b0', marginBottom: '6px', fontWeight: 'bold'}}>{t.fps_limit}</div>
                        <div style={{display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '8px'}}>
                          {[30, 60, 120].map(f => (
                            <button key={f} onClick={() => setFpsLimit(f)} style={{flex: 1, padding: '8px', background: fpsLimit === f ? '#00e5ff' : 'transparent', color: fpsLimit === f ? '#000' : '#8892b0', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer'}}>{f} FPS</button>
                          ))}
                        </div>
                      </div>

                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px'}}>
                        <span style={{color: '#8892b0'}}>{t.vsync}</span>
                        <CustomDropdown value={vSync} onChange={setVSync} options={['Kapat', 'Aç', '1/2']} />
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
                      <input type="range" min="0" max="100" value={soundVolume} onChange={(e) => setSoundVolume(e.target.value)} style={{width: '100%', accentColor: '#00e5ff', cursor: 'pointer'}} />
                    </div>
                    
                    <div style={{marginBottom: '14px'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px', fontWeight: '600'}}>
                        <span style={{color: '#8892b0'}}>{t.music_volume}</span>
                        <span style={{color: '#00e5ff'}}>%{musicVolume}</span>
                      </div>
                      <input type="range" min="0" max="100" value={musicVolume} onChange={(e) => setMusicVolume(e.target.value)} style={{width: '100%', accentColor: '#00e5ff', cursor: 'pointer'}} />
                    </div>

                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px'}}>
                      <span style={{color: '#8892b0'}}>{t.bg_audio}</span>
                      <CustomCheckbox checked={backgroundAudio} onChange={() => setBackgroundAudio(!backgroundAudio)} />
                    </div>
                  </div>

                  {/* SESLİ SOHBET (VOICE CHAT) */}
                  <div>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px', marginBottom: '16px'}}>
                      <h3 style={{fontSize: '15px', fontWeight: '800', color: '#00e5ff', letterSpacing: '0.5px', margin: '0'}}>{t.voice_chat}</h3>
                      <CustomCheckbox checked={voiceChat} onChange={() => setVoiceChat(!voiceChat)} />
                    </div>

                    {voiceChat && (
                      <div style={{display: 'flex', flexDirection: 'column', gap: '14px', animation: 'fadeIn 0.2s'}}>
                        <div>
                          <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px', fontWeight: '600'}}>
                            <span style={{color: '#8892b0'}}>{t.voice_volume}</span>
                            <span style={{color: '#00e5ff'}}>%{voiceVolume}</span>
                          </div>
                          <input type="range" min="0" max="100" value={voiceVolume} onChange={(e) => setVoiceVolume(e.target.value)} style={{width: '100%', accentColor: '#00e5ff', cursor: 'pointer'}} />
                        </div>

                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px'}}>
                          <span style={{color: '#8892b0'}}>{t.input_device}</span>
                          <CustomDropdown value={voiceInputDevice} onChange={setVoiceInputDevice} options={['Sistem Varsayılanı', 'Microphone Array (Digit...)', 'Harici Mikrofon']} />
                        </div>

                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', marginTop: '12px'}}>
                          <span style={{color: '#8892b0'}}>{t.input_mode}</span>
                          <CustomDropdown value={voiceInputMode} onChange={setVoiceInputMode} options={['Konuşmak için bas', 'Açık / Sürekli İletişim']} />
                        </div>

                        <div>
                          <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px', fontWeight: '600'}}>
                            <span style={{color: '#8892b0'}}>{t.mic_sensitivity}</span>
                            <span style={{color: '#00e5ff'}}>%{voiceSensitivity}</span>
                          </div>
                          <input type="range" min="0" max="100" value={voiceSensitivity} onChange={(e) => setVoiceSensitivity(e.target.value)} style={{width: '100%', accentColor: '#00e5ff', cursor: 'pointer'}} />
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
              <button className="mbtn mbtn-pass" onClick={() => showPromptPlaceholder("Gizlilik Politikası")} style={{margin: '0', padding: '12px', fontSize: '12px'}}>{t.privacy_policy}</button>
              <button className="mbtn mbtn-pass" onClick={() => showPromptPlaceholder("Gizlilik Ayarları")} style={{margin: '0', padding: '12px', fontSize: '12px'}}>{t.privacy_settings}</button>
              <button className="mbtn mbtn-pass" onClick={() => showPromptPlaceholder("Kullanım Koşulları")} style={{margin: '0', padding: '12px', fontSize: '12px'}}>{t.terms_of_service}</button>
              <button className="mbtn mbtn-pass" onClick={() => showPromptPlaceholder("Kontroller")} style={{margin: '0', padding: '12px', fontSize: '12px'}}>{t.controls}</button>
              <button className="mbtn mbtn-pass" onClick={() => showPromptPlaceholder("Oyun Kuralları")} style={{margin: '0', padding: '12px', fontSize: '12px'}}>{t.rules}</button>
              <button className="mbtn mbtn-pass" onClick={() => showPromptPlaceholder("Hesap Bağlama")} style={{margin: '0', padding: '12px', fontSize: '12px'}}>{t.link_account}</button>
              <button className="mbtn mbtn-pass" onClick={() => showPromptPlaceholder("Hata Raporu")} style={{margin: '0', padding: '12px', fontSize: '12px'}}>{t.send_doc}</button>
              <button className="mbtn mbtn-upgrade" onClick={() => showPromptPlaceholder("Promosyon Kodu")} style={{margin: '0', padding: '12px', fontSize: '12px', color: '#000'}}>{t.promo_codes}</button>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
