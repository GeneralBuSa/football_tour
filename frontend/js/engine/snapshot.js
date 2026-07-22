import {
  PLAYERS, currentPlayer, turnCount, gameLog, gameTime,
  setPlayers, setCurrentPlayer, setTurnCount, setGameLog, setGameTime,
  setTutorialText, setDiceRolled, setGameEnded
} from './state.js';
import { buildBoard } from './board.js';
import { openCityModal } from '../ui/modal.js';
import { renderPanel, updateTutorialHUD } from '../ui/panel.js';
import { renderPlayers } from './player.js';
import { updateStadiums3D } from '../3d/stadiums.js';
import multiplayerService from '../../services/MultiplayerService.js';

export function getGameSnapshot() {
  return {
    players: PLAYERS.map(p => ({
      name: p.name,
      avatar: p.avatar,
      avatarImg: p.avatarImg,
      color: p.color,
      money: p.money,
      pos: p.pos,
      ownedProps: p.ownedProps,
      stadiums: p.stadiums,
      theme: p.theme
    })),
    currentPlayer,
    turnCount,
    gameLog,
    gameTime
  };
}

export function applyGameSnapshot(data) {
  if (!data || !Array.isArray(data.players)) return false;

  setPlayers(data.players);
  setCurrentPlayer(data.currentPlayer || 0);
  setTurnCount(data.turnCount || 1);
  setGameLog(data.gameLog || []);
  setGameTime(typeof data.gameTime === 'number' ? data.gameTime : 1800);
  setDiceRolled(false);
  setGameEnded(false);

  const turnBadge = document.getElementById('turn-badge');
  const phaseLabel = document.getElementById('phase-label');
  if (turnBadge) turnBadge.textContent = `TUR ${data.turnCount || 1}`;
  if (phaseLabel) phaseLabel.textContent = `${data.players[data.currentPlayer || 0]?.name || 'Oyuncu'}'nin sırası`;

  setTutorialText(`Oyun durumu senkronize edildi. Sıradaki oyuncu: ${data.players[data.currentPlayer || 0]?.name || 'Oyuncu'}`);
  updateTutorialHUD();

  const rollBtn = document.getElementById('btn-roll');
  const endBtn = document.getElementById('btn-end');
  if (rollBtn) {
    rollBtn.disabled = !multiplayerService.canControlTurn(data.currentPlayer || 0);
    rollBtn.style.display = '';
  }
  if (endBtn) endBtn.style.display = 'none';

  buildBoard(openCityModal);
  renderPlayers();
  renderPanel();
  setTimeout(() => updateStadiums3D(), 300);
  return true;
}
