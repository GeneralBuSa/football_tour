// Oyun motoru kuralları: tahta yerleşimi, hücre etkileri, satın alma, sıra ve oyun sonu.
import './setup/dom.js';
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { CITIES, SPECIAL_CELLS, DEFAULT_PLAYERS } from '../js/data/cities.js';
import { boardLayout, BOARD_SIZE } from '../js/data/boardLayout.js';
import { PLAYER_CATALOG, COIN_PACKS, STARTER_CHARACTER_KEYS, getPlayerByKey } from '../js/data/playerCatalog.js';
import * as state from '../js/engine/state.js';
import { boardCells, getBoardIndex } from '../js/engine/board.js';
import { handleCell, movePlayer } from '../js/engine/dice.js';
import { buyCity, upgradeStadium } from '../js/engine/economy.js';
import { endTurn, finishGameIfNeeded } from '../js/engine/player.js';
import { getGameSnapshot, applyGameSnapshot } from '../js/engine/snapshot.js';
import multiplayerService from '../services/MultiplayerService.js';

function startGame(playerCount = 2) {
  state.resetState();
  state.setPlayers(state.PLAYERS.slice(0, playerCount));
  multiplayerService.stop();
  document.__reset();
  document.__register('btn-roll');
  document.__register('btn-end');
  document.__register('turn-badge');
  document.__register('phase-label');
}

const cityCell = cityIdx => boardCells.findIndex(cell => cell.type === 'city' && cell.cityIdx === cityIdx);
const specialCell = type => boardCells.findIndex(cell => cell.type === 'special' && cell.special.type === type);

beforeEach(() => startGame());

test('board has 32 cells and every city appears exactly once', () => {
  assert.equal(boardLayout.length, BOARD_SIZE);
  assert.equal(boardCells.length, BOARD_SIZE);
  const cityIndexes = boardLayout.filter(c => c.type === 'city').map(c => c.idx).sort((a, b) => a - b);
  assert.deepEqual(cityIndexes, CITIES.map((_, i) => i));
  boardLayout.filter(c => c.type === 'special').forEach(c => assert.ok(SPECIAL_CELLS[c.idx], `special ${c.idx}`));
  assert.equal(boardLayout[0].type, 'corner');
});

test('grid mapping covers each board index exactly once around the 9x9 frame', () => {
  const seen = new Set();
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const index = getBoardIndex(row, col);
      if (row === 0 || row === 8 || col === 0 || col === 8) {
        assert.ok(index >= 0 && index < BOARD_SIZE, `(${row},${col}) -> ${index}`);
        seen.add(index);
      } else {
        assert.equal(index, null);
      }
    }
  }
  assert.equal(seen.size, BOARD_SIZE);
});

test('catalog data is consistent (starter characters, coin packs)', () => {
  assert.equal(PLAYER_CATALOG.length, DEFAULT_PLAYERS.length);
  STARTER_CHARACTER_KEYS.forEach(key => assert.ok(getPlayerByKey(key)?.starterEligible));
  assert.equal(getPlayerByKey('nope'), null);
  assert.deepEqual(COIN_PACKS.map(p => p.key), ['coins_100', 'coins_300', 'coins_500', 'coins_1000']);
});

test('passing start pays 100K and wraps the position', () => {
  const p = state.PLAYERS[0];
  p.pos = BOARD_SIZE - 2;
  const before = p.money;
  movePlayer(4);
  assert.equal(p.pos, 2);
  assert.equal(p.money, before + 100000);
});

test('buying a city deducts the price and records ownership', () => {
  const p = state.PLAYERS[0];
  buyCity(0);
  assert.deepEqual(p.ownedProps, [0]);
  assert.equal(p.money, 1000000 - CITIES[0].price);
});

test('cannot buy a city without enough money', () => {
  const p = state.PLAYERS[0];
  p.money = 10;
  buyCity(0);
  assert.deepEqual(p.ownedProps, []);
  assert.equal(p.money, 10);
});

test('rent grows 50% per stadium level and is transferred to the owner', () => {
  const [owner, visitor] = state.PLAYERS;
  owner.ownedProps.push(7);
  owner.stadiums[7] = 2;
  const idx = cityCell(7);
  handleCell(visitor, boardCells[idx], idx);
  const expected = Math.round(CITIES[7].rent * (1 + 2 * 0.5));
  assert.equal(visitor.money, 1000000 - expected);
  assert.equal(owner.money, 1000000 + expected);
});

test('rent never takes more money than the visitor has', () => {
  const [owner, visitor] = state.PLAYERS;
  owner.ownedProps.push(23);
  visitor.money = 1000;
  const idx = cityCell(23);
  handleCell(visitor, boardCells[idx], idx);
  assert.equal(visitor.money, 0);
  assert.equal(owner.money, 1001000);
});

test('stadium upgrade costs 40% of the price and caps at level 3', () => {
  const p = state.PLAYERS[0];
  p.ownedProps.push(0);
  for (let i = 0; i < 4; i++) upgradeStadium(0);
  assert.equal(p.stadiums[0], 3);
  assert.equal(p.money, 1000000 - 3 * Math.round(CITIES[0].price * 0.4));
});

test('special cells apply their money effects', () => {
  const p = state.PLAYERS[0];
  const cases = [['tax', -50000], ['penalty', 60000], ['foul', -30000]];
  for (const [type, delta] of cases) {
    const idx = specialCell(type);
    if (idx === -1) continue;
    p.money = 500000;
    handleCell(p, boardCells[idx], idx);
    assert.equal(p.money, 500000 + delta, type);
  }
});

test('endTurn rotates players and increments the round after the last player', () => {
  assert.equal(state.currentPlayer, 0);
  endTurn();
  assert.equal(state.currentPlayer, 1);
  assert.equal(state.turnCount, 1);
  endTurn();
  assert.equal(state.currentPlayer, 0);
  assert.equal(state.turnCount, 2);
});

test('in an online match only the local player may act on their own turn', async () => {
  multiplayerService.prepare('session-1');
  const p = state.PLAYERS[0];
  buyCity(0);
  endTurn();
  assert.deepEqual(p.ownedProps, [], 'rol belli değilken satın alma engellenmeli');
  assert.equal(state.currentPlayer, 0, 'rol belli değilken sıra geçilememeli');
  multiplayerService.stop();
});

test('bankruptcy ends the game exactly once', () => {
  state.PLAYERS[1].money = 0;
  assert.equal(finishGameIfNeeded('bankruptcy'), true);
  assert.equal(state.gameEnded, true);
  assert.equal(finishGameIfNeeded('bankruptcy'), false);
});

test('snapshot round-trip restores players, turn and log without 3D objects', () => {
  const p = state.PLAYERS[0];
  p.ownedProps.push(3);
  p.money = 777;
  state.setCurrentPlayer(1);
  state.setTurnCount(4);
  const snapshot = JSON.parse(JSON.stringify(getGameSnapshot()));
  assert.equal(snapshot.players[0].threeGroup, undefined);

  startGame();
  applyGameSnapshot(snapshot);
  assert.equal(state.PLAYERS[0].money, 777);
  assert.deepEqual(state.PLAYERS[0].ownedProps, [3]);
  assert.equal(state.currentPlayer, 1);
  assert.equal(state.turnCount, 4);
  assert.equal(state.gameEnded, false);
  assert.equal(applyGameSnapshot({ nope: true }), false);
});

test('malicious opponent state cannot inject HTML/CSS (stored XSS regression)', async () => {
  const { sanitizeGameSnapshot } = await import('../js/engine/snapshot.js');
  const { renderPanel, switchTab } = await import('../js/ui/panel.js');
  const evil = '<img src=x onerror="alert(1)">';
  const clean = sanitizeGameSnapshot({
    players: [
      { name: evil, color: 'red;"><script>alert(1)</script>', money: 'NaN', pos: 999, ownedProps: [0, 0, 99, 'x'], stadiums: { 0: 9 }, characterKey: 'dragon' },
      { name: 'b', color: '#00ff00', money: 5, pos: 3, ownedProps: [], stadiums: {} },
      {}, {}, {}, {}
    ],
    currentPlayer: 7,
    gameLog: [{ player: evil, action: '<b>x</b>', val: '<i>1</i>', color: 'url(javascript:1)', type: '"><script>' }]
  });
  assert.equal(clean.players.length, 4, 'en fazla 4 oyuncu');
  assert.equal(clean.players[0].color, '#94a3b8');
  assert.equal(clean.players[0].pos, 31);
  assert.deepEqual(clean.players[0].ownedProps, [0, 23]);
  assert.equal(clean.players[0].stadiums[0], 3);
  assert.equal(clean.players[0].characterKey, undefined);
  assert.equal(clean.currentPlayer, 3);
  assert.equal(clean.gameLog[0].type, '');
  assert.equal(sanitizeGameSnapshot({ players: 'x' }), null);

  // Render katmanı da kaçış yapmalı
  state.setPlayers([{ ...state.PLAYERS[0], name: evil, color: 'red"><b>', ownedProps: [0], stadiums: {} }]);
  const body = document.__register('panel-body');
  renderPanel();
  assert.doesNotMatch(body.innerHTML, /<img src=x/);
  assert.doesNotMatch(body.innerHTML, /red"><b>/);
  state.setActiveTab('log');
  state.addLogEntry({ player: evil, action: '<b>x</b>', val: '1', color: 'x"><b>', type: 'good' });
  renderPanel();
  assert.doesNotMatch(body.innerHTML, /<img src=x|<b>x<\/b>|x"><b>/);
  state.setActiveTab('props');
});
