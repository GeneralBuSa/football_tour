// ==========================================
// OYUN STATE YÖNETİMİ — Merkezi durum deposu
// Tüm modüller bu state'i import ederek okur/yazar
// ==========================================

import { DEFAULT_PLAYERS } from '../data/cities.js';

// Oyuncu dizisi (mutable — oyun boyunca değişir)
export let PLAYERS = DEFAULT_PLAYERS.map(p => ({ ...p, ownedProps: [...p.ownedProps], stadiums: { ...p.stadiums } }));

// Oyun durumu
export let currentPlayer = 0;
export let turnCount = 1;
export let dice1 = 1;
export let dice2 = 1;
export let diceRolled = false;
export let gameLog = [];
export let activeTab = 'props';
export let gameTime = 1800;
export let timerId = null;
export let currentTutorialText = "Oyunun amacı mülk satın almak ve zenginleşmektir. Eğer diğer oyuncuların önünde zenginleşebilirseniz şampiyon olursunuz.";

// State güncelleme fonksiyonları
export function setCurrentPlayer(val) { currentPlayer = val; }
export function setTurnCount(val) { turnCount = val; }
export function setDice(d1, d2) { dice1 = d1; dice2 = d2; }
export function setDiceRolled(val) { diceRolled = val; }
export function setActiveTab(val) { activeTab = val; }
export function setGameTime(val) { gameTime = val; }
export function setTimerId(val) { timerId = val; }
export function setTutorialText(val) { currentTutorialText = val; }

export function addLogEntry(entry) {
  gameLog.unshift(entry);
  if (gameLog.length > 15) gameLog.pop();
}

export function setGameLog(val) { gameLog = val; }

export function setPlayers(val) { PLAYERS = val; }

// Oyun sıfırlama
export function resetState() {
  PLAYERS = DEFAULT_PLAYERS.map(p => ({ ...p, ownedProps: [...p.ownedProps], stadiums: { ...p.stadiums } }));
  currentPlayer = 0;
  turnCount = 1;
  dice1 = 1;
  dice2 = 1;
  diceRolled = false;
  gameLog = [];
  activeTab = 'props';
  gameTime = 1800;
  timerId = null;
  currentTutorialText = "Oyunun amacı mülk satın almak ve zenginleşmektir. Eğer diğer oyuncuların önünde zenginleşebilirseniz şampiyon olursunuz.";
}
