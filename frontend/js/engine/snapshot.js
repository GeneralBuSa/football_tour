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
      characterKey: p.characterKey,
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

const CHARACTER_KEYS = ['architect', 'king', 'rocket', 'viking', 'wizard'];
const clampInt = (value, min, max, fallback) => {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) ? Math.min(Math.max(number, min), max) : fallback;
};
const cleanText = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '');

// Çevrimiçi maçta durum rakibin istemcisinden gelir: türleri ve sınırları doğrulanmadan
// uygulanmaz (XSS, bozuk state ve absürt değerlere karşı).
export function sanitizeGameSnapshot(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.players)) return null;
  const players = data.players.slice(0, 4).map((p, index) => {
    const source = p && typeof p === 'object' ? p : {};
    const stadiums = {};
    if (source.stadiums && typeof source.stadiums === 'object') {
      Object.entries(source.stadiums).forEach(([cityIdx, level]) => {
        const idx = clampInt(cityIdx, 0, 23, null);
        if (idx !== null) stadiums[idx] = clampInt(level, 0, 3, 0);
      });
    }
    return {
      name: cleanText(source.name, 24) || `Oyuncu ${index + 1}`,
      characterKey: CHARACTER_KEYS.includes(source.characterKey) ? source.characterKey : undefined,
      avatar: cleanText(source.avatar, 2000) || '👤',
      avatarImg: null,
      color: /^#[0-9a-fA-F]{6}$/.test(source.color) ? source.color : '#94a3b8',
      money: clampInt(source.money, -1e9, 1e10, 0),
      pos: clampInt(source.pos, 0, 31, 0),
      ownedProps: Array.isArray(source.ownedProps)
        ? [...new Set(source.ownedProps.map(v => clampInt(v, 0, 23, null)).filter(v => v !== null))]
        : [],
      stadiums,
      theme: source.theme === 'pink-theme' ? 'pink-theme' : 'blue-theme'
    };
  });
  if (!players.length) return null;
  return {
    players,
    currentPlayer: clampInt(data.currentPlayer, 0, players.length - 1, 0),
    turnCount: clampInt(data.turnCount, 1, 100000, 1),
    gameTime: clampInt(data.gameTime, 0, 1800, 1800),
    gameLog: Array.isArray(data.gameLog)
      ? data.gameLog.slice(0, 15).map(entry => ({
        player: cleanText(entry?.player, 24),
        color: /^#[0-9a-fA-F]{6}$/.test(entry?.color) ? entry.color : '#94a3b8',
        action: cleanText(entry?.action, 120),
        val: cleanText(entry?.val, 60),
        type: entry?.type === 'good' || entry?.type === 'bad' ? entry.type : '',
        turn: clampInt(entry?.turn, 0, 100000, 0)
      }))
      : []
  };
}

export function applyGameSnapshot(rawData) {
  const data = sanitizeGameSnapshot(rawData);
  if (!data) return false;

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
