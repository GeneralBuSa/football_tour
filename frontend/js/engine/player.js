// ==========================================
// OYUNCU YÖNETİMİ VE HUD KARTLARI
// ==========================================

import {
  PLAYERS, currentPlayer, turnCount, diceRolled,
  gameEnded,
  setCurrentPlayer, setTurnCount, setDiceRolled, setTutorialText, setGameEnded
} from './state.js';
import { updateTutorialHUD } from '../ui/panel.js';
import { renderPanel } from '../ui/panel.js';
import gameService from '../../services/GameService.js';

// Oyuncu HUD kartlarını çiz (ekran köşeleri)
export function renderPlayers() {
  const container = document.getElementById('hud-players');
  if (!container) return;

  let html = '';

  // Köşeler: 0: Sol-Alt, 1: Sol-Üst, 2: Sağ-Üst, 3: Sağ-Alt
  const positions = [
    'bottom: 0; left: 0;',
    'top: 0; left: 0;',
    'top: 0; right: 0;',
    'bottom: 0; right: 0;'
  ];

  PLAYERS.forEach((p, idx) => {
    const isActive = idx === currentPlayer;
    const cardTheme = idx % 2 === 0 ? 'blue-theme' : 'pink-theme';

    html += `
      <div class="hud-player-card ${cardTheme}" style="position: absolute; ${positions[idx]} ${isActive ? 'box-shadow: 0 0 20px ' + p.color + '; transform: scale(1.03);' : 'opacity: 0.85;'}">
        <div class="hud-avatar-box" style="background:${p.color}22; overflow: hidden; display: flex; align-items: center; justify-content: center; border-radius: 50%;">
          ${p.avatarImg ? `<img src="${p.avatarImg}" style="width: 100%; height: 100%; object-fit: cover;" />` : `<span style="font-size:32px">${p.avatar}</span>`}
        </div>
        <div class="hud-info">
          <span class="hud-name" style="color:${p.color}">${p.name}</span>
          <span class="hud-money-badge">💵 ₺${p.money.toLocaleString()}</span>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// Sıra bitirme
export function endTurn() {
  if (gameEnded) return;
  setCurrentPlayer((currentPlayer + 1) % PLAYERS.length);
  if (currentPlayer === 0) setTurnCount(turnCount + 1);
  setDiceRolled(false);

  const rollBtn = document.getElementById('btn-roll');
  if (rollBtn) {
    rollBtn.disabled = false;
    rollBtn.style.display = '';
  }

  document.getElementById('btn-end').style.display = 'none';
  document.getElementById('turn-badge').textContent = `TUR ${turnCount}`;
  document.getElementById('phase-label').textContent = `${PLAYERS[currentPlayer].name}'nin sırası`;

  setTutorialText(`Sıradaki Oyuncu: ${PLAYERS[currentPlayer].name}. Zarları atmak için ZAR AT butonuna basınız.`);
  updateTutorialHUD();

  renderPlayers();

  // Multiplayer: Sıra değişikliğini diğer oyuncuya bildir
  syncMultiplayerState('end_turn');
}

export function finishGame(reason = 'completed') {
  if (gameEnded) return false;
  setGameEnded(true);

  const winner = [...PLAYERS].sort((a, b) => b.money - a.money)[0];
  const phaseLabel = document.getElementById('phase-label');
  const rollBtn = document.getElementById('btn-roll');
  const endBtn = document.getElementById('btn-end');

  if (phaseLabel) phaseLabel.textContent = `Oyun bitti: ${winner?.name || 'Kazanan yok'}`;
  if (rollBtn) rollBtn.style.display = 'none';
  if (endBtn) endBtn.style.display = 'none';

  setTutorialText(`${winner?.name || 'Bir oyuncu'} oyunu kazandı! Sonuçlar kaydediliyor.`);
  updateTutorialHUD();
  gameService.player.recordGameEnd(PLAYERS, turnCount, reason);
  finishMultiplayerSession(reason);
  renderPlayers();
  renderPanel();
  return true;
}

export function finishGameIfNeeded(reason = 'completed') {
  const bankruptPlayers = PLAYERS.filter(p => p.money <= 0);
  if (bankruptPlayers.length > 0) {
    return finishGame(reason);
  }
  return false;
}

export async function syncMultiplayerState(eventType = 'state_update') {
  try {
    const [{ default: multiplayerService }, { getGameSnapshot }] = await Promise.all([
      import('../../services/MultiplayerService.js'),
      import('./snapshot.js')
    ]);
    await multiplayerService.syncState(getGameSnapshot(), eventType);
  } catch (e) {
    console.warn('[Multiplayer] state sync skipped', e);
  }
}

async function finishMultiplayerSession(reason) {
  try {
    const [{ default: multiplayerService }, { getGameSnapshot }] = await Promise.all([
      import('../../services/MultiplayerService.js'),
      import('./snapshot.js')
    ]);
    if (!multiplayerService.sessionId) return;
    const state = getGameSnapshot();
    await gameService.saveGameResult(state.players);
    await import('../../services/ApiService.js').then(({ default: apiService }) =>
      apiService.finishMultiplayerSession(multiplayerService.sessionId, state, { reason, players: state.players })
    );
  } catch (e) {
    console.warn('[Multiplayer] finish sync skipped', e);
  }
}

