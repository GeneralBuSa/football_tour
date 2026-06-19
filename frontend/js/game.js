// ==========================================
// FOOTBALL TOUR SIMULATOR — ANA GİRİŞ NOKTASI
// Tüm modülleri import eder ve window scope'a bağlar
// ==========================================

import gameService from '../services/GameService.js';

// Engine modülleri
import { buildBoard } from './engine/board.js';
import { rollDice } from './engine/dice.js';
import { renderPlayers, endTurn } from './engine/player.js';
import { buyCity, upgradeStadium, openLootBox, closeLoot } from './engine/economy.js';

// UI modülleri
import { switchTab, renderPanel } from './ui/panel.js';
import { openCityModal, closeModal, showAchievementsModal } from './ui/modal.js';
import {
  playLocalGame, showOnlineLobby, showGameModeSelection, hideGameModeSelection,
  toggleSocialPanel, switchSocialTab, toggleOfflineAccordion,
  showHome, showProfile, showBattlePass, showStore, showAchievements, showMatchHistory
} from './ui/menu.js';
import {
  openSettings, saveGame, loadGame, toggleTheme, initTheme,
  toggleFullscreen, closeApp, confirmExitToMenu, exitToMainMenu, initSteam
} from './ui/settings.js';

// 3D modülleri
import { initThreeJS } from './3d/scene.js';
import { update3DPawnsTargetPositions } from './3d/pawns.js';

// ==========================================
// GLOBAL SCOPE BAĞLANTILARI (onclick handler'ları için)
// ==========================================
window.rollDice = rollDice;
window.buyCity = buyCity;
window.upgradeStadium = upgradeStadium;
window.openLootBox = openLootBox;
window.closeLoot = closeLoot;
window.endTurn = endTurn;
window.switchTab = switchTab;
window.openCityModal = openCityModal;
window.closeModal = closeModal;
window.openSettings = openSettings;
window.saveGame = saveGame;
window.loadGame = loadGame;
window.toggleFullscreen = toggleFullscreen;
window.closeApp = closeApp;
window.playLocalGame = playLocalGame;
window.showOnlineLobby = showOnlineLobby;
window.toggleSocialPanel = toggleSocialPanel;
window.switchSocialTab = switchSocialTab;
window.showHome = showHome;
window.showProfile = showProfile;
window.showBattlePass = showBattlePass;
window.showStore = showStore;
window.showAchievements = showAchievements;
window.showMatchHistory = showMatchHistory;
window.toggleOfflineAccordion = toggleOfflineAccordion;
window.toggleTheme = toggleTheme;
window.confirmExitToMenu = confirmExitToMenu;
window.exitToMainMenu = exitToMainMenu;
window.showAchievementsModal = showAchievementsModal;
window.showGameModeSelection = showGameModeSelection;
window.hideGameModeSelection = hideGameModeSelection;
window.update3DPawnsTargetPositions = update3DPawnsTargetPositions;

// ==========================================
// OYUN BAŞLATMA
// ==========================================
async function initGame() {
  // Servisleri başlat
  await gameService.init();

  initTheme();
  
  if (document.getElementById('board-grid')) {
    buildBoard(openCityModal);
    renderPlayers();
    renderPanel();
    initSteam();
    initThreeJS();
  }

  // URL parametresinde play=true varsa oyun modu seçim ekranını aç
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('play') === 'true' && typeof window.showGameModeSelection === 'function') {
    window.showGameModeSelection();
  }
}

initGame();
