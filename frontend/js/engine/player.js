// ==========================================
// OYUNCU YÖNETİMİ VE HUD KARTLARI
// ==========================================

import {
  PLAYERS, currentPlayer, turnCount,
  gameEnded, timerId,
  setCurrentPlayer, setTurnCount, setDiceRolled, setTutorialText, setGameEnded, setTimerId
} from './state.js';
import { updateTutorialHUD, renderPanel, showNotif } from '../ui/panel.js';
import gameService from '../../services/GameService.js';
import multiplayerService from '../../services/MultiplayerService.js';
import { trackEvent } from '../../services/analytics.js';
import { resolveCharacterKey } from '../3d/pawns.js';
import { escapeHtml } from '../utils/html.js';

const isImageAvatar = value => typeof value === 'string' && /^(\/|data:image\/|https?:\/\/)/.test(value);

function avatarMarkup(p) {
  const src = p.avatarImg || (isImageAvatar(p.avatar) ? p.avatar : null);
  if (src) return `<img src="${escapeHtml(src)}" alt="" />`;
  return `<span aria-hidden="true">${escapeHtml(p.avatar || '👤')}</span>`;
}

// Üst HUD'daki tur ve sıra bilgisini günceller.
export function updateTurnHud() {
  const turnBadge = document.getElementById('turn-badge');
  const phaseLabel = document.getElementById('phase-label');
  const active = PLAYERS[currentPlayer];
  if (turnBadge) turnBadge.textContent = `TUR ${turnCount}`;
  // Maç bittiğinde finishGame kazananı yazar; üzerine yazılmaz.
  if (phaseLabel && active && !gameEnded) {
    phaseLabel.textContent = `${active.name} oynuyor`;
    phaseLabel.style.setProperty('--player-color', active.color);
  }
}

// Oyuncu HUD kartlarını çiz (ekran köşeleri): 0 sol-alt, 1 sol-üst, 2 sağ-üst, 3 sağ-alt
export function renderPlayers() {
  const container = document.getElementById('hud-players');
  if (!container) return;

  const corners = ['corner-bl', 'corner-tl', 'corner-tr', 'corner-br'];
  container.innerHTML = PLAYERS.map((p, idx) => {
    const isActive = idx === currentPlayer && !gameEnded;
    const stadiumCount = Object.values(p.stadiums || {}).reduce((sum, level) => sum + (level || 0), 0);
    return `
      <div class="hud-player-card ${corners[idx] || ''} ${isActive ? 'is-active' : ''} ${p.money <= 0 ? 'is-bankrupt' : ''}"
        style="--player-color:${escapeHtml(p.color)}" data-character="${resolveCharacterKey(p, idx)}" aria-current="${isActive ? 'true' : 'false'}">
        <div class="hud-avatar-box">${avatarMarkup(p)}</div>
        <div class="hud-info">
          <span class="hud-name">${escapeHtml(p.name)}</span>
          <span class="hud-money-badge">₺${Number(p.money || 0).toLocaleString('tr-TR')}</span>
          <span class="hud-sub">🏙️ ${p.ownedProps.length} şehir · 🏟️ ${stadiumCount}</span>
        </div>
        ${isActive ? '<span class="hud-turn-badge">SIRA</span>' : ''}
      </div>
    `;
  }).join('');
  updateTurnHud();
}

// Sıra bitirme
export function endTurn() {
  if (gameEnded) return;
  if (!multiplayerService.canControlTurn(currentPlayer)) {
    showNotif('Bu tur rakibinizin. Hamle yapabilmek için sıranızı bekleyin.');
    return;
  }
  setCurrentPlayer((currentPlayer + 1) % PLAYERS.length);
  if (currentPlayer === 0) setTurnCount(turnCount + 1);
  setDiceRolled(false);

  const rollBtn = document.getElementById('btn-roll');
  if (rollBtn) {
    rollBtn.disabled = !multiplayerService.canControlTurn(currentPlayer);
    rollBtn.style.display = '';
  }

  const endBtn = document.getElementById('btn-end');
  if (endBtn) endBtn.style.display = 'none';
  const diceResult = document.getElementById('dice-result');
  if (diceResult) diceResult.textContent = '';

  setTutorialText(`Sıradaki Oyuncu: ${PLAYERS[currentPlayer].name}. Zarları atmak için ZAR AT butonuna basınız.`);
  updateTutorialHUD();

  renderPlayers();

  // Multiplayer: Sıra değişikliğini diğer oyuncuya bildir
  syncMultiplayerState('end_turn');
}

// syncRemote=false: rakip oyunu bitirdiğinde (SSE 'finished') sonucu tekrar sunucuya göndermeyiz.
export function finishGame(reason = 'completed', { syncRemote = true } = {}) {
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
  try {
    gameService.player.recordGameEnd(PLAYERS, turnCount, reason);
  } catch (e) {
    console.warn('[Game] oyun sonu istatistikleri kaydedilemedi', e);
  }
  if (syncRemote) finishMultiplayerSession(reason);
  trackEvent('game_finished', { mode: multiplayerService.sessionId ? 'online' : 'local', reason, turns: turnCount });
  if (timerId) {
    clearInterval(timerId);
    setTimerId(null);
  }
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
    // Maç sonucu recordGameEnd içinde kaydedilir; burada sadece oturum kapatılır.
    await import('../../services/ApiService.js').then(({ default: apiService }) =>
      apiService.finishMultiplayerSession(multiplayerService.sessionId, state, { reason, players: state.players })
    );
  } catch (e) {
    console.warn('[Multiplayer] finish sync skipped', e);
  }
}

