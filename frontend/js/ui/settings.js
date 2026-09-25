// ==========================================
// AYARLAR, TEMA, KAYIT/YÜKLEME
// ==========================================

import {
  PLAYERS, gameTime, timerId, gameEnded,
  setGameTime, setTimerId, setGameEnded
} from '../engine/state.js';
import { closeModal } from './modal.js';
import { showNotif } from './panel.js';
import { finishGame, renderPlayers } from '../engine/player.js';
import gameService from '../../services/GameService.js';
import { applyGameSnapshot, getGameSnapshot } from '../engine/snapshot.js';
import multiplayerService from '../../services/MultiplayerService.js';
import apiService from '../../services/ApiService.js';

// Zaman sayacı
export function startTimer() {
  if (timerId) clearInterval(timerId);
  const id = setInterval(() => {
    if (gameTime > 0) {
      const nextTime = gameTime - 1;
      setGameTime(nextTime);
      if (nextTime <= 0) {
        clearInterval(id);
        setTimerId(null);
        finishGame('time');
      }
    }
    const min = String(Math.floor(gameTime / 60)).padStart(2, '0');
    const sec = String(gameTime % 60).padStart(2, '0');
    const timerEl = document.getElementById('timer-val');
    if (timerEl) timerEl.textContent = `${min}:${sec}`;
  }, 1000);
  setTimerId(id);
}

// Ayarlar modalı
export function openSettings() {
  const el = document.getElementById('settings-modal');
  if (el) el.style.display = 'flex';
}

// Steam başlatma
export async function initSteam() {
  const env = gameService.getEnvironment();
  const statusEl = document.getElementById('steam-status');
  if (env.isSteamConnected) {
    PLAYERS[0].name = env.steamName;
    if (statusEl) statusEl.textContent = `Steam: Çevrimiçi (${env.steamName})`;
    renderPlayers();
  } else if (statusEl) {
    statusEl.textContent = 'Steam: Çevrimdışı Mod';
  }
}

// Oyun kaydetme
export async function saveGame() {
  const saveData = getGameSnapshot();
  const result = await gameService.saveGame(saveData);
  showNotif(result.message);

  // Zengin oyuncu başarımı
  PLAYERS.forEach(p => {
    if (p.money >= 3000000) {
      gameService.achievement.unlock('RICH_PLAYER');
    }
  });
}

// Oyun yükleme
export async function loadGame() {
  const result = await gameService.loadGame();
  if (result.success && result.data) {
    applySaveData(JSON.stringify(result.data));
    showNotif('Kayıt başarıyla yüklendi!');
    closeModal('settings-modal');
  } else {
    showNotif(result.message || 'Kayıt bulunamadı!');
  }
}

// Kayıt verisini uygula
export function applySaveData(dataStr) {
  try {
    applyGameSnapshot(JSON.parse(dataStr));
  } catch (e) {
    showNotif("Veri yüklenemedi!");
  }
}

// Tema değiştirme
export function toggleTheme() {
  const body = document.body;
  const btn = document.getElementById('btn-theme');

  if (body.classList.contains('light-theme')) {
    body.classList.remove('light-theme');
    if (btn) btn.textContent = '🌙';
    localStorage.setItem('game_theme', 'dark');
  } else {
    body.classList.add('light-theme');
    if (btn) btn.textContent = '☀️';
    localStorage.setItem('game_theme', 'light');
  }
}

export function initTheme() {
  const savedTheme = localStorage.getItem('game_theme');
  const body = document.body;
  const btn = document.getElementById('btn-theme');

  if (savedTheme === 'light') {
    body.classList.add('light-theme');
    if (btn) btn.textContent = '☀️';
  } else {
    body.classList.remove('light-theme');
    if (btn) btn.textContent = '🌙';
  }
}

// Tam ekran geçişi
export async function toggleFullscreen() {
  await gameService.toggleFullscreen();
}

// Uygulama kapatma
export async function closeApp() {
  await gameService.closeApp();
}

// Çıkış onay modalı
export function confirmExitToMenu() {
  const settingsModal = document.getElementById('settings-modal');
  if (settingsModal) settingsModal.style.display = 'none';

  closeModal('exit-confirm-modal');

  const div = document.createElement('div');
  div.className = 'modal-backdrop';
  div.id = 'exit-confirm-modal';
  div.innerHTML = `
    <div class="modal">
      <div class="modal-head">
        <div class="modal-city">⚠️ UYARI</div>
        <div class="modal-league">Emin misiniz?</div>
      </div>
      <div class="modal-body" style="text-align: center; font-size: 14px;">
        Oyundan çıkıp ana menüye dönmek istediğinize emin misiniz? Mevcut ilerlemeniz kaybolacaktır.
      </div>
      <div class="modal-btns">
        <button class="mbtn mbtn-buy" onclick="window.exitToMainMenu()">Evet, Çık</button>
        <button class="mbtn mbtn-pass" onclick="window.closeModal('exit-confirm-modal')">Vazgeç</button>
      </div>
    </div>
  `;
  document.body.appendChild(div);
}

// Ana menüye dön
export function exitToMainMenu() {
  closeModal('exit-confirm-modal');

  if (timerId) {
    clearInterval(timerId);
    setTimerId(null);
  }

  // Çevrimiçi maçtan çıkarken canlı bağlantı kapatılır ve lobi kaydı temizlenir;
  // henüz hamle yapılmamışsa rakibe maçın iptal edildiği bildirilir.
  if (multiplayerService.sessionId) {
    const sessionId = multiplayerService.sessionId;
    const started = multiplayerService.version !== null;
    multiplayerService.stop();
    if (started && !gameEnded) {
      // Başlamış maçı terk etmek hükmen yenilgidir; rakibe canlı olarak bildirilir.
      apiService.finishMultiplayerSession(sessionId, getGameSnapshot(), { reason: 'forfeit' }).catch(() => {});
    }
    apiService.leaveLobby().catch(() => {});
  }

  setGameTime(1800);
  setGameEnded(false);

  const mainMenu = document.getElementById('main-menu');
  const appElement = document.getElementById('app');
  if (mainMenu) mainMenu.style.display = 'flex';
  if (appElement) appElement.style.display = 'none';

  showNotif('Ana menüye dönüldü.');
}

