// ==========================================
// MENÜ VE NAVİGASYON FONKSİYONLARI
// ==========================================

import { PLAYERS, gameTime, setTutorialText, timerId, setTimerId, setGameTime } from '../engine/state.js';
import { buildBoard } from '../engine/board.js';
import { openCityModal, closeModal } from './modal.js';
import { showNotif, updateTutorialHUD } from './panel.js';
import { renderPlayers } from '../engine/player.js';
import { startTimer } from './settings.js';
import apiService from '../../services/ApiService.js';

// Yerel oyun başlatma
export function playLocalGame() {
  if (typeof window.triggerPageTransition === 'function') {
    window.triggerPageTransition(() => {
      const mainMenu = document.getElementById('main-menu');
      const appElement = document.getElementById('app');
      const gameModeScreen = document.getElementById('game-mode-screen');

      if (mainMenu) mainMenu.style.display = 'none';
      if (gameModeScreen) gameModeScreen.style.display = 'none';
      if (appElement) appElement.style.display = 'flex';

      // Zaman sayacını başlat
      startTimer();

      // Piyon konumlarını güncelle
      if (window.update3DPawnsTargetPositions) window.update3DPawnsTargetPositions();

      showNotif('Oyun Başladı! Sıra Messi\'de ⚽');

      // Loading ekranını tekrar kapat
      const overlay = document.querySelector('.loading-transition-overlay');
      if (overlay) {
        overlay.classList.add('fade-out');
      }
    });
  } else {
    const mainMenu = document.getElementById('main-menu');
    const appElement = document.getElementById('app');
    const gameModeScreen = document.getElementById('game-mode-screen');

    if (mainMenu) mainMenu.style.display = 'none';
    if (gameModeScreen) gameModeScreen.style.display = 'none';
    if (appElement) appElement.style.display = 'flex';

    startTimer();
    if (window.update3DPawnsTargetPositions) window.update3DPawnsTargetPositions();
    showNotif('Oyun Başladı! Sıra Messi\'de ⚽');
  }
}

// Çevrimiçi lobi
export async function showOnlineLobby() {
  if (!apiService.isLoggedIn()) {
    showNotif('Çevrimiçi lobiye katılmak için lütfen giriş yapın!');
    window.location.href = '/auth';
    return;
  }

  closeModal('lobby-modal');

  const div = document.createElement('div');
  div.className = 'modal-backdrop';
  div.id = 'lobby-modal';
  div.innerHTML = `
    <div class="modal" style="width: 340px;">
      <div class="modal-head">
        <div class="modal-city">🌐 ÇEVRİMİÇİ LOBİ</div>
        <div class="modal-league">Gerçek Zamanlı Eşleştirme</div>
      </div>
      <div class="modal-body lobby-modal-body">
        <div class="lobby-spinner"></div>
        <div class="lobby-sim-status" id="lobby-status">Sıraya giriliyor...</div>
        <div class="lobby-players-list" id="lobby-players">
          <div class="lobby-player-row"><span>Siz (${apiService.getUser()?.username})</span><span style="color:#2ecc71">ARANIYOR</span></div>
        </div>
      </div>
      <div class="modal-btns">
        <button class="mbtn mbtn-pass" id="btn-lobby-cancel" onclick="window.closeLobbyQueue()" style="width: 100%">İptal Et</button>
      </div>
    </div>
  `;
  document.body.appendChild(div);

  try {
    const res = await apiService.joinLobby();
    const statusEl = document.getElementById('lobby-status');
    
    if (res.error) {
      statusEl.textContent = 'Lobiye katılım hatası: ' + res.error;
      const spinner = document.querySelector('.lobby-spinner');
      if (spinner) spinner.style.display = 'none';
      return;
    }

    statusEl.textContent = 'Rakip aranıyor...';

    const lobbyInterval = setInterval(async () => {
      if (!document.getElementById('lobby-modal')) {
        clearInterval(lobbyInterval);
        return;
      }

      const statusRes = await apiService.getLobbyStatus();
      if (statusRes.status === 'matched') {
        clearInterval(lobbyInterval);
        statusEl.textContent = `Eşleşme Sağlandı! ${statusRes.matched_with} ile oyun başlıyor...`;
        statusEl.style.background = 'rgba(46, 204, 113, 0.1)';
        statusEl.style.color = '#2ecc71';

        const playersEl = document.getElementById('lobby-players');
        const row = document.createElement('div');
        row.className = 'lobby-player-row';
        row.innerHTML = `<span>${statusRes.matched_with} (Rakip)</span><span style="color:#2ecc71">HAZIR</span>`;
        playersEl.appendChild(row);

        const spinner = document.querySelector('.lobby-spinner');
        if (spinner) spinner.style.display = 'none';

        const modalBtns = document.querySelector('#lobby-modal .modal-btns');
        if (modalBtns) {
          modalBtns.innerHTML = `
            <button class="mbtn mbtn-buy" onclick="window.closeModal('lobby-modal'); window.playLocalGame();" style="width: 100%">Oyunu Başlat</button>
          `;
        }
      }
    }, 2000);

    window.closeLobbyQueue = async () => {
      clearInterval(lobbyInterval);
      await apiService.leaveLobby();
      closeModal('lobby-modal');
      showNotif('Eşleştirme iptal edildi.');
    };

  } catch (e) {
    console.error("Lobi eşleştirme hatası:", e);
  }
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

  if (panel.classList.contains('collapsed')) {
    panel.classList.remove('collapsed');
    if (arrow) arrow.textContent = '<';
  } else {
    panel.classList.add('collapsed');
    if (arrow) arrow.textContent = '>';
  }
}

export function switchSocialTab(tabName, el) {
  document.querySelectorAll('.social-tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');

  document.querySelectorAll('.social-tab-content').forEach(c => c.classList.remove('active'));

  if (tabName === 'lobby') {
    const lobbyContent = document.getElementById('social-lobby-content');
    if (lobbyContent) lobbyContent.classList.add('active');
  } else if (tabName === 'friends') {
    const friendsContent = document.getElementById('social-friends-content');
    if (friendsContent) friendsContent.classList.add('active');
    loadFriendsUI();
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

// Navigasyon fonksiyonları
export function showHome() { 
  if (typeof window.triggerPageTransition === 'function') {
    window.triggerPageTransition(() => { window.location.href = '/'; });
  } else {
    window.location.href = '/'; 
  }
}
export function showProfile() { 
  if (typeof window.triggerPageTransition === 'function') {
    window.triggerPageTransition(() => { window.location.href = '/profile'; });
  } else {
    window.location.href = '/profile'; 
  }
}
export function showBattlePass() { 
  if (typeof window.triggerPageTransition === 'function') {
    window.triggerPageTransition(() => { window.location.href = '/battlepass'; });
  } else {
    window.location.href = '/battlepass'; 
  }
}
export function showStore() { 
  if (typeof window.triggerPageTransition === 'function') {
    window.triggerPageTransition(() => { window.location.href = '/store'; });
  } else {
    window.location.href = '/store'; 
  }
}
export function showAchievements() { 
  if (typeof window.triggerPageTransition === 'function') {
    window.triggerPageTransition(() => { window.location.href = '/achievements'; });
  } else {
    window.location.href = '/achievements'; 
  }
}
export function showMatchHistory() { 
  if (typeof window.triggerPageTransition === 'function') {
    window.triggerPageTransition(() => { window.location.href = '/history'; });
  } else {
    window.location.href = '/history'; 
  }
}

// Sosyal panel dinamik arkadaş yükleme
export async function loadFriendsUI() {
  if (!apiService.isLoggedIn()) {
    const friendsContent = document.getElementById('social-friends-content');
    if (friendsContent) {
      friendsContent.innerHTML = `<div style="font-size: 12px; color: #aaa; padding: 20px; text-align: center;">Arkadaşlarınızı görmek için lütfen giriş yapın.</div>`;
    }
    return;
  }
  
  const friendsContent = document.getElementById('social-friends-content');
  if (!friendsContent) return;

  try {
    const list = await apiService.getFriends();
    
    let html = `
      <div class="friends-search" style="display: flex; gap: 8px; padding: 10px;">
        <input type="text" id="friend-search-input" placeholder="Kullanıcı Adı" class="search-input-field" style="flex: 1; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 4px 8px; border-radius: 4px;" />
        <button onclick="window.addFriendAction()" class="mbtn mbtn-buy" style="padding: 6px 12px; margin: 0; font-size: 12px; height: auto;">Ekle</button>
      </div>
      <div class="friends-list-wrapper" style="max-height: 300px; overflow-y: auto;">
    `;

    const pendingRequests = list.filter(f => f.status === 'pending');
    const acceptedFriends = list.filter(f => f.status === 'accepted');

    if (pendingRequests.length > 0) {
      html += `<div style="font-size: 11px; color: #ff7043; padding: 8px 10px; font-weight: bold;">BEKLEYEN İSTEKLER (${pendingRequests.length})</div>`;
      pendingRequests.forEach(f => {
        html += `
          <div class="friend-row" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <div style="display: flex; align-items: center; gap: 8px;">
              <div class="friend-avatar" style="background: #ff7043; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px;">👤</div>
              <div class="friend-name" style="font-size: 13px; color: #fff;">${f.username}</div>
            </div>
            ${!f.is_sender ? `
              <button onclick="window.acceptFriendAction('${f.friend_id}')" class="mbtn mbtn-buy" style="padding: 4px 8px; margin: 0; font-size: 10px; height: auto;">Kabul Et</button>
            ` : `
              <span style="font-size: 10px; color: #aaa;">Gönderildi</span>
            `}
          </div>
        `;
      });
    }

    html += `<div style="font-size: 11px; color: #2ecc71; padding: 8px 10px; font-weight: bold; margin-top: 10px;">ARKADAŞLAR (${acceptedFriends.length})</div>`;
    if (acceptedFriends.length === 0) {
      html += `<div style="font-size: 12px; color: #aaa; padding: 10px; text-align: center;">Henüz arkadaşınız yok.</div>`;
    } else {
      acceptedFriends.forEach(f => {
        html += `
          <div class="friend-row" style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <div class="friend-avatar" style="background: #2ecc71; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px;">👤</div>
            <div>
              <div class="friend-name" style="font-size: 13px; color: #fff;">${f.username}</div>
              <div class="friend-status" style="font-size: 10px; color: #aaa;">Çevrimdışı</div>
            </div>
          </div>
        `;
      });
    }

    html += `</div>`;
    friendsContent.innerHTML = html;
  } catch (e) {
    console.error("Sosyal panel yükleme hatası:", e);
  }
}

window.addFriendAction = async () => {
  const input = document.getElementById('friend-search-input');
  if (!input || !input.value) return;
  
  const res = await apiService.addFriend(input.value.trim());
  if (res.error) {
    showNotif("Hata: " + res.error);
  } else {
    showNotif("Arkadaşlık isteği gönderildi! ✉️");
    loadFriendsUI();
  }
};

window.acceptFriendAction = async (friendId) => {
  const res = await apiService.acceptFriendRequest(friendId);
  if (res.error) {
    showNotif("Hata: " + res.error);
  } else {
    showNotif("Arkadaşlık isteği kabul edildi! 🎉");
    loadFriendsUI();
  }
};
