// Sunucunun çevrimiçi maç kural denetimi (backend/game/stateRules.js) ile istemcideki
// gerçek oyun motorunun uyumu. Motor rastgele oyunlar oynar; her hamleden sonra istemcinin
// sunucuya göndereceği durum sunucu kurallarınca KABUL edilmelidir. Aksi halde dürüst
// oyuncuların hamleleri reddedilir. Kurallar veya motor değişince bu test uyarır.
import './setup/dom.js';
import test, { mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as state from '../js/engine/state.js';
import { CITIES, SPECIAL_CELLS } from '../js/data/cities.js';
import { boardLayout, BOARD_SIZE } from '../js/data/boardLayout.js';
import { boardCells } from '../js/engine/board.js';
import { movePlayer } from '../js/engine/dice.js';
import { buyCity, upgradeStadium } from '../js/engine/economy.js';
import { endTurn } from '../js/engine/player.js';
import { getGameSnapshot } from '../js/engine/snapshot.js';
import multiplayerService from '../services/MultiplayerService.js';
import {
  BOARD_SIZE as SERVER_BOARD_SIZE, CELL_MAX_GAIN, CITY_PRICES, PASS_START_BONUS, START_MONEY,
  initialState, validateStateTransition
} from '../../backend/game/stateRules.js';

const snapshot = () => JSON.parse(JSON.stringify(getGameSnapshot()));

function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const originalRandom = Math.random;
beforeEach(() => {
  mock.timers.enable({ apis: ['setTimeout'] });
  multiplayerService.stop();
});
afterEach(() => {
  mock.timers.reset();
  Math.random = originalRandom;
});

function startOnlineLikeGame() {
  state.resetState();
  state.setPlayers(state.PLAYERS.slice(0, 2));
  document.__reset();
  ['btn-roll', 'btn-end', 'turn-badge', 'phase-label', 'timer-val'].forEach(id => document.__register(id));
}

test('server rule tables match the client game data', () => {
  assert.deepEqual(CITY_PRICES, CITIES.map(c => c.price));
  assert.equal(SERVER_BOARD_SIZE, BOARD_SIZE);
  assert.equal(START_MONEY, state.PLAYERS[0].money);

  // Para kazandıran her tahta hücresi sunucu tablosunda olmalı (ve yalnızca onlar).
  const gains = { loot: 200_000, penalty: 60_000, bonus: 40_000, wc: 150_000 };
  const expected = {};
  boardLayout.forEach((cell, pos) => {
    if (cell.type !== 'special') return;
    const gain = gains[SPECIAL_CELLS[cell.idx].type];
    if (gain) expected[pos] = gain;
  });
  assert.deepEqual({ ...CELL_MAX_GAIN }, expected);
  assert.equal(PASS_START_BONUS, 100_000);
});

test('the first online move is validated from the canonical starting state', () => {
  startOnlineLikeGame();
  const start = snapshot();
  const canonical = initialState(2);
  start.players.forEach((p, i) => {
    assert.equal(p.money, canonical.players[i].money);
    assert.deepEqual(p.ownedProps, canonical.players[i].ownedProps);
  });
  assert.equal(validateStateTransition(canonical, start).ok, true);
});

test('every move of hundreds of real games is accepted by the server rules', () => {
  let moves = 0;
  for (let seed = 1; seed <= 150; seed++) {
    Math.random = seededRandom(seed);
    startOnlineLikeGame();
    let prev = initialState(2);
    const check = label => {
      const next = snapshot();
      const result = validateStateTransition(prev, next);
      assert.ok(result.ok, `seed ${seed}, ${label}: ${result.reason}\n${JSON.stringify({ prev: prev.players, next: next.players })}`);
      prev = next;
      moves += 1;
    };

    for (let turn = 0; turn < 120 && !state.gameEnded; turn++) {
      const p = state.PLAYERS[state.currentPlayer];
      const steps = 2 + Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6);
      movePlayer(steps);
      mock.timers.tick(300);
      check(`zar (${steps})`);
      if (state.gameEnded) break;

      const cell = boardCells[p.pos];
      if (cell.type === 'city' && !state.PLAYERS.some(pl => pl.ownedProps.includes(cell.cityIdx)) && Math.random() < 0.8) {
        buyCity(cell.cityIdx);
        check('şehir satın alma');
      }
      for (const cityIdx of p.ownedProps) {
        if (Math.random() < 0.25) {
          upgradeStadium(cityIdx);
          check('stadyum');
        }
      }
      endTurn();
      check('tur devri');
    }
  }
  assert.ok(moves > 10_000, `yeterli hamle oynanmadı: ${moves}`);
});
