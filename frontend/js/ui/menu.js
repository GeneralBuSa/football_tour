import { PLAYERS, setPlayers, setTutorialText, resetState } from '../engine/state.js';
import { DEFAULT_PLAYERS } from '../data/cities.js';
import { buildBoard } from '../engine/board.js';
import { openCityModal, closeModal } from './modal.js';
import { showNotif, updateTutorialHUD } from './panel.js';
import { renderPlayers, finishGame } from '../engine/player.js';
import { applyGameSnapshot } from '../engine/snapshot.js';
import { startTimer, exitToMainMenu } from './settings.js';
import apiService from '../../services/ApiService.js';
import multiplayerService from '../../services/MultiplayerService.js';
import { trackEvent } from '../../services/analytics.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

// Oyun başlatma — options.sessionId varsa multiplayer session başlatılır
export function playLocalGame(options = {}) {
  resetState();

  const sessionId = options.sessionId;
  if (sessionId) {
    // Çevrimiçi oyunda sadece 2 oyuncu (Host vs Guest) yer alır
    setPlayers(PLAYERS.slice(0, 2));
    // Rol bilgisi gelene kadar yerel hamleler kilitlenir; aksi halde misafir,
    // host'un sırasında zar atabiliyordu.
    multiplayerService.prepare(sessionId);
    trackEvent('online_game_started');
    startMultiplayerSession(sessionId);
  } else {
    multiplayerService.stop();
    // Yerel maç: HUD dört köşeyi destekler; varsayılan olarak 2 oyuncu kullanılır.
    const localPlayers = Math.min(Math.max(Number(options.localPlayers) || 2, 2), 4);
    setPlayers(PLAYERS.slice(0, localPlayers));
  }

  buildBoard(openCityModal);
  renderPlayers();

  const showGameScreen = () => {
    const mainMenu = document.getElementById('main-menu');
    const appElement = document.getElementById('app');
    const gameModeScreen = document.getElementById('game-mode-screen');

    if (mainMenu) mainMenu.style.display = 'none';
    if (gameModeScreen) gameModeScreen.style.display = 'none';
    if (appElement) appElement.style.display = 'flex';

    startTimer();
    if (window.update3DPawnsTargetPositions) window.update3DPawnsTargetPositions();
    showNotif(sessionId ? 'Çevrimiçi Oyun Başladı! ⚽' : `Oyun Başladı! Sıra ${PLAYERS[0]?.name || 'Oyuncu'}'de ⚽`);
  };

  if (typeof window.triggerPageTransition === 'function') {
    window.triggerPageTransition(() => {
      showGameScreen();
      const overlay = document.querySelector('.loading-transition-overlay');
      if (overlay) overlay.classList.add('fade-out');
    });
  } else {
    showGameScreen();
  }
}

async function startMultiplayerSession(sessionId) {
  try {
    const session = await apiService.getMultiplayerSession(sessionId);
    if (!session || session.error || !Array.isArray(session.game_session_players)) {
      throw new Error(session?.error || 'Oturum bilgisi alınamadı');
    }
    if (session.status === 'cancelled' || session.status === 'finished') {
      throw new Error('Bu maç artık aktif değil');
    }

    const hostPlayer = session.game_session_players.find(p => p.role === 'host');
    const guestPlayer = session.game_session_players.find(p => p.role === 'guest');
    const localUserId = apiService.getUser()?.id;
    const localPlayerIndex = hostPlayer?.user_id === localUserId ? 0 : guestPlayer?.user_id === localUserId ? 1 : null;
    if (localPlayerIndex === null) throw new Error('Oturumdaki oyuncu rolü belirlenemedi');

    [hostPlayer, guestPlayer].forEach((participant, index) => {
      if (!participant?.users || !PLAYERS[index]) return;
      PLAYERS[index].name = participant.users.username;
      // Oyuncunun profilinde seçtiği karakter modeli (seçmediyse slotun varsayılanı korunur).
      if (participant.users.selected_character) PLAYERS[index].characterKey = participant.users.selected_character;
      // Kart simgesi: profil fotoğrafı/emoji varsa o, yoksa seçilen karakterin simgesi.
      const character = DEFAULT_PLAYERS.find(item => item.characterKey === PLAYERS[index].characterKey);
      const customAvatar = participant.users.avatar && participant.users.avatar !== '👤' ? participant.users.avatar : null;
      PLAYERS[index].avatar = customAvatar || character?.avatar || PLAYERS[index].avatar;
    });
    renderPlayers();
    if (window.update3DPawnsTargetPositions) window.update3DPawnsTargetPositions();

    const rollBtn = document.getElementById('btn-roll');
    if (rollBtn) rollBtn.disabled = localPlayerIndex !== 0;
    setTutorialText(localPlayerIndex === 0
      ? 'Rakibin bağlandı. İlk zarı sen atıyorsun!'
      : `${PLAYERS[0]?.name || 'Rakip'} oyunu başlatıyor. Sıranı bekle...`);
    updateTutorialHUD();

    await multiplayerService.start(sessionId, stateData => applyGameSnapshot(stateData), localPlayerIndex, {
      onClosed: ({ reason, state_data, result_data }) => {
        if (reason === 'finished') {
          if (state_data) applyGameSnapshot(state_data);
          finishGame('opponent_finished', { syncRemote: false });
          const forfeit = result_data?.reason === 'forfeit';
          const iWon = result_data?.winner_user_id && result_data.winner_user_id === apiService.getUser()?.id;
          showNotif(forfeit ? 'Rakibin maçtan ayrıldı. Hükmen kazandın! 🏆' : iWon ? 'Maçı kazandın! 🏆' : 'Maç sona erdi.');
          return;
        }
        multiplayerService.stop();
        exitToMainMenu();
        showNotif('Rakip maçtan ayrıldı. Oyun iptal edildi.');
      }
    });
  } catch (e) {
    console.warn('[Multiplayer] session başlatılamadı', e);
    multiplayerService.stop();
    exitToMainMenu();
    showNotif(`Çevrimiçi oyuna bağlanılamadı: ${e.message}`);
  }
}

function lobbyModalHtml({ title, subtitle, body = '', status }) {
  return `
    <div class="modal" style="width: 340px;" role="dialog" aria-modal="true" aria-labelledby="lobby-modal-title">
      <div class="modal-head">
        <div class="modal-city" id="lobby-modal-title">${title}</div>
        <div class="modal-league">${subtitle}</div>
      </div>
      <div class="modal-body lobby-modal-body">
        ${body}
        <div class="lobby-spinner" aria-hidden="true"></div>
        <div class="lobby-sim-status" id="lobby-status" role="status" aria-live="polite">${status}</div>
      </div>
      <div class="modal-btns">
        <button class="mbtn mbtn-pass" id="btn-lobby-cancel" onclick="window.closeLobbyQueue()" style="width: 100%">İptal Et</button>
      </div>
    </div>
  `;
}

function openLobbyModal(options) {
  stopLobbyPolling();
  closeModal('lobby-modal');
  const div = document.createElement('div');
  div.className = 'modal-backdrop';
  div.id = 'lobby-modal';
  div.innerHTML = lobbyModalHtml(options);
  document.body.appendChild(div);
  return div;
}

function showLobbyError(message) {
  const statusEl = document.getElementById('lobby-status');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.style.color = '#ff7070';
  }
  const spinner = document.querySelector('#lobby-modal .lobby-spinner');
  if (spinner) spinner.style.display = 'none';
}

// Eşleşme sağlandığında lobi modalında "Oyunu Başlat" butonunu gösterir.
function showMatchReady(statusRes, buttonId) {
  const statusEl = document.getElementById('lobby-status');
  if (statusEl) {
    statusEl.textContent = `Eşleşme Sağlandı! ${statusRes.matched_with} ile oyun başlıyor...`;
    statusEl.style.background = 'rgba(46, 204, 113, 0.1)';
    statusEl.style.color = '#2ecc71';
  }

  const spinner = document.querySelector('#lobby-modal .lobby-spinner');
  if (spinner) spinner.style.display = 'none';

  const matchedSessionId = statusRes.session_id;
  const modalBtns = document.querySelector('#lobby-modal .modal-btns');
  if (modalBtns) {
    modalBtns.innerHTML = `<button class="mbtn mbtn-buy" id="${buttonId}" style="width: 100%">Oyunu Başlat</button>`;
    const startBtn = document.getElementById(buttonId);
    startBtn.addEventListener('click', () => {
      closeModal('lobby-modal');
      playLocalGame({ sessionId: matchedSessionId });
    });
    startBtn.focus();
  }
}

let lobbyPollTimer = null;

function stopLobbyPolling() {
  if (lobbyPollTimer) clearInterval(lobbyPollTimer);
  lobbyPollTimer = null;
}

// Lobi durumunu 2 sn'de bir yoklar. Yoklama sunucuda kuyruk kaydını canlı tutar ve
// hâlâ arıyorsak eşleştirmeyi yeniden dener.
function pollLobby({ onMatched, onCancelled }) {
  stopLobbyPolling();
  let busy = false;
  lobbyPollTimer = setInterval(async () => {
    if (!document.getElementById('lobby-modal')) {
      stopLobbyPolling();
      return;
    }
    if (busy) return;
    busy = true;
    try {
      const statusRes = await apiService.getLobbyStatus();
      if (statusRes?.error) {
        const statusEl = document.getElementById('lobby-status');
        if (statusEl) statusEl.textContent = `Bağlantı sorunu: ${statusRes.error} Tekrar deneniyor...`;
        return;
      }
      if (statusRes.status === 'matched') {
        stopLobbyPolling();
        onMatched(statusRes);
      } else if (statusRes.status === 'cancelled' || statusRes.status === 'idle') {
        await onCancelled?.(statusRes);
      }
    } finally {
      busy = false;
    }
  }, 2000);
}

// Çevrimiçi lobi (hızlı eşleşme)
export async function showOnlineLobby() {
  if (!apiService.isLoggedIn()) {
    showNotif('Çevrimiçi lobiye katılmak için lütfen giriş yapın!');
    window.location.href = '/auth';
    return;
  }

  openLobbyModal({
    title: '🌐 ÇEVRİMİÇİ LOBİ',
    subtitle: 'Gerçek Zamanlı Eşleştirme',
    body: `<div class="lobby-players-list" id="lobby-players">
      <div class="lobby-player-row"><span>Siz (${escapeHtml(apiService.getUser()?.username)})</span><span style="color:#2ecc71">ARANIYOR</span></div>
    </div>`,
    status: 'Sıraya giriliyor...'
  });

  window.closeLobbyQueue = async () => {
    stopLobbyPolling();
    closeModal('lobby-modal');
    await apiService.leaveLobby();
    showNotif('Eşleştirme iptal edildi.');
  };

  const handleMatched = statusRes => {
    trackEvent('match_found', { mode: 'quick' });
    const playersEl = document.getElementById('lobby-players');
    if (playersEl) {
      const row = document.createElement('div');
      row.className = 'lobby-player-row';
      row.innerHTML = `<span>${escapeHtml(statusRes.matched_with)} (Rakip)</span><span style="color:#2ecc71">HAZIR</span>`;
      playersEl.appendChild(row);
    }
    showMatchReady(statusRes, 'btn-start-matched');
  };

  trackEvent('matchmaking_started');
  const res = await apiService.joinLobby();
  if (!document.getElementById('lobby-modal')) return;
  if (res.error) {
    showLobbyError('Lobiye katılım hatası: ' + res.error);
    return;
  }
  if (res.status === 'matched') {
    handleMatched(res);
    return;
  }

  const statusEl = document.getElementById('lobby-status');
  if (statusEl) statusEl.textContent = 'Rakip aranıyor...';
  pollLobby({
    onMatched: handleMatched,
    // Rakip eşleşmeden hemen sonra ayrıldıysa otomatik olarak yeniden kuyruğa girilir.
    onCancelled: async () => {
      const el = document.getElementById('lobby-status');
      if (el) el.textContent = 'Rakip ayrıldı, yeniden rakip aranıyor...';
      const again = await apiService.joinLobby();
      if (again?.status === 'matched') {
        stopLobbyPolling();
        handleMatched(again);
      }
    }
  });
}

// Oyun modu seçim ekranı göster/gizle
export function showGameModeSelection() {
  const mainMenuCards = document.getElementById('menu-left-cards');
  const gameModeScreen = document.getElementById('game-mode-screen');
  if (mainMenuCards) mainMenuCards.style.display = 'none';
  if (gameModeScreen) gameModeScreen.style.display = 'flex';
}

export function hideGameModeSelection() {
  window.location.href = '/';
}

// Sosyal panel kontrolleri
export function toggleSocialPanel() {
  const panel = document.getElementById('social-panel');
  const arrow = document.getElementById('social-toggle-arrow');
  if (!panel) return;

  // Kapalı durumda CSS oku 180° döndürür: metin '>' iken ekranda '<' (aç) görünür.
  if (panel.classList.contains('collapsed')) {
    panel.classList.remove('collapsed');
    if (arrow) arrow.textContent = '>';
  } else {
    panel.classList.add('collapsed');
    if (arrow) arrow.textContent = '>';
  }
  panel.querySelector('.social-toggle-btn')?.setAttribute('aria-expanded', String(!panel.classList.contains('collapsed')));
}

export function switchSocialTab(tabName, el) {
  document.querySelectorAll('.social-tab').forEach(t => {
    t.classList.remove('active');
    t.setAttribute('aria-selected', 'false');
  });
  if (el) {
    el.classList.add('active');
    el.setAttribute('aria-selected', 'true');
  }

  document.querySelectorAll('.social-tab-content').forEach(c => c.classList.remove('active'));

  if (tabName === 'lobby') {
    const lobbyContent = document.getElementById('social-lobby-content');
    if (lobbyContent) lobbyContent.classList.add('active');
  } else if (tabName === 'friends') {
    const friendsContent = document.getElementById('social-friends-content');
    if (friendsContent) friendsContent.classList.add('active');
    // Arkadaş listesi React tarafından çizilir. Eskiden bu içerik innerHTML ile
    // eziliyordu ve React'in DOM'u bozuluyordu; artık sadece yenileme istenir.
    window.dispatchEvent(new CustomEvent('ft26:refresh-friends'));
  }
}

export function toggleOfflineAccordion() {
  const list = document.getElementById('offline-friends-list');
  const arrow = document.getElementById('accordion-arrow');
  if (!list) return;

  if (list.classList.contains('open')) {
    list.classList.remove('open');
    if (arrow) arrow.textContent = '▶';
  } else {
    list.classList.add('open');
    if (arrow) arrow.textContent = '▼';
  }
}

function navigateWithTransition(href) {
  if (typeof window.triggerPageTransition === 'function') {
    window.triggerPageTransition(() => { window.location.href = href; });
  } else {
    window.location.href = href;
  }
}

// Navigasyon fonksiyonları
export function showHome() { navigateWithTransition('/'); }
export function showProfile() { navigateWithTransition('/profile'); }
export function showBattlePass() { navigateWithTransition('/battlepass'); }
export function showStore() { navigateWithTransition('/store'); }
export function showAchievements() { navigateWithTransition('/achievements'); }
export function showMatchHistory() { navigateWithTransition('/history'); }

// Özel oyun kur / katıl seçim ekranı
export function showPrivateRoomSelection() {
  if (!apiService.isLoggedIn()) {
    showNotif('Özel oyun kurmak veya katılmak için giriş yapmalısınız!');
    window.location.href = '/auth';
    return;
  }

  closeModal('private-room-modal');

  const div = document.createElement('div');
  div.className = 'modal-backdrop';
  div.id = 'private-room-modal';
  div.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="private-room-title" style="width: 360px; max-width: calc(100vw - 32px); background: rgba(20, 24, 33, 0.95); border: 1px solid rgba(41, 182, 246, 0.2); box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(41, 182, 246, 0.1); border-radius: 12px; padding: 24px;">
      <div class="modal-head" style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; margin-bottom: 20px;">
        <div class="modal-city" id="private-room-title" style="font-size: 20px; font-weight: bold; color: #29b6f6; letter-spacing: 1px;">🎮 ÖZEL OYUN YÖNETİMİ</div>
        <div class="modal-league" style="font-size: 11px; color: #aaa; margin-top: 4px;">Arkadaşlarınla Oyna</div>
      </div>
      <div class="modal-body" style="display: flex; flex-direction: column; gap: 15px; margin-top: 15px;">

        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; text-align: center;">
          <div style="font-size: 14px; font-weight: bold; color: #fff; margin-bottom: 8px;">Oda Kur (Host)</div>
          <p style="font-size: 11px; color: #aaa; margin-bottom: 12px;">Sizin oda kodunuz kendi kullanıcı adınız olacaktır.</p>
          <button class="mbtn mbtn-buy" onclick="window.createPrivateRoomAction()" style="width: 100%; margin: 0; padding: 10px;">Oda Oluştur</button>
        </div>

        <form onsubmit="event.preventDefault(); window.joinPrivateRoomAction();" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 15px; border-radius: 8px;">
          <label for="host-code-input" style="display: block; font-size: 14px; font-weight: bold; color: #fff; margin-bottom: 8px; text-align: center;">Odaya Katıl (Guest)</label>
          <input type="text" id="host-code-input" autocomplete="off" maxlength="24" aria-describedby="host-code-error" placeholder="Arkadaşının Kullanıcı Adı (Oda Kodu)" class="search-input-field" style="width: 100%; box-sizing: border-box; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 10px; border-radius: 6px; font-size: 13px; text-align: center; margin-bottom: 6px;" />
          <div id="host-code-error" role="alert" style="min-height: 16px; font-size: 11px; color: #ff7070; text-align: center; margin-bottom: 6px;"></div>
          <button type="submit" class="mbtn mbtn-upgrade" style="width: 100%; margin: 0; padding: 10px;">Odaya Bağlan</button>
        </form>

      </div>
      <div class="modal-btns" style="margin-top: 20px; border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 16px;">
        <button class="mbtn mbtn-pass" onclick="window.closeModal('private-room-modal')" style="width: 100%; padding: 10px; margin: 0;">Geri Dön</button>
      </div>
    </div>
  `;
  document.body.appendChild(div);
}

// Özel oda oluşturma aksiyonu (Host). Oda kurulduysa true döner.
export async function createPrivateRoomAction() {
  closeModal('private-room-modal');
  if (!apiService.isLoggedIn()) {
    showNotif('Özel oda kurmak için giriş yapmalısınız!');
    return false;
  }

  const myUsername = apiService.getUser()?.username;
  openLobbyModal({
    title: '🎮 ÖZEL ODA KURULDU',
    subtitle: 'Arkadaşının Katılması Bekleniyor',
    body: `<div style="text-align: center; margin: 15px 0;">
      <div style="font-size: 12px; color: #aaa;">Arkadaşınızın girmesi gereken Oda Kodu:</div>
      <div style="font-size: 24px; font-weight: bold; color: #29b6f6; letter-spacing: 2px; margin: 10px 0; background: rgba(41, 182, 246, 0.1); padding: 10px; border-radius: 6px; border: 1px dashed #29b6f6; word-break: break-all;">
        ${escapeHtml(myUsername)}
      </div>
    </div>`,
    status: 'Arkadaşınız bekleniyor...'
  });

  window.closeLobbyQueue = async () => {
    stopLobbyPolling();
    closeModal('lobby-modal');
    await apiService.leaveLobby();
    showNotif('Özel oda iptal edildi.');
  };

  const res = await apiService.createPrivateLobby();
  if (res.error) {
    showLobbyError('Hata: ' + res.error);
    return false;
  }
  trackEvent('private_room_created');

  pollLobby({
    onMatched: statusRes => showMatchReady(statusRes, 'btn-start-private-matched'),
    onCancelled: () => {
      stopLobbyPolling();
      showLobbyError('Oda kapandı. Yeni bir oda kurabilirsiniz.');
    }
  });
  return true;
}

// Özel odaya katılma aksiyonu (Guest) — oda kodu formu
export async function joinPrivateRoomAction() {
  const input = document.getElementById('host-code-input');
  const errorEl = document.getElementById('host-code-error');
  const hostUsername = input?.value.trim() || '';
  if (!/^[A-Za-z0-9_]{3,24}$/.test(hostUsername)) {
    if (errorEl) errorEl.textContent = 'Geçerli bir oda kodu girin (3-24 harf, rakam veya _).';
    if (input) {
      input.setAttribute('aria-invalid', 'true');
      input.focus();
    }
    return false;
  }
  closeModal('private-room-modal');
  return joinPrivateRoomByHost(hostUsername);
}

// Oda koduyla veya arkadaş davetinden özel odaya bağlanır.
export async function joinPrivateRoomByHost(hostUsername) {
  if (!apiService.isLoggedIn()) {
    window.location.href = '/auth';
    return false;
  }

  openLobbyModal({
    title: '🔌 ODAYA BAĞLANILIYOR',
    subtitle: `${escapeHtml(hostUsername)} odasına bağlantı kuruluyor`,
    status: 'Bağlantı isteği gönderiliyor...'
  });

  window.closeLobbyQueue = async () => {
    stopLobbyPolling();
    closeModal('lobby-modal');
    await apiService.leaveLobby();
  };

  const res = await apiService.joinPrivateLobby(hostUsername);
  if (res.error) {
    showLobbyError('Bağlanılamadı: ' + res.error);
    return false;
  }

  trackEvent('private_room_joined');
  showMatchReady(res, 'btn-start-private-matched');
  return true;
}
