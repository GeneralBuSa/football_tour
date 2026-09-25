// 3D piyon/model eşleştirmesi, hücre konumları ve tahta metin boyutlandırma testleri.
import './setup/dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CHARACTER_KEYS, resolveCharacterKey, getCell3DPosition, getCellInwardDirection, getStadium3DPosition
} from '../js/3d/pawns.js';
import { nameSizeClass } from '../js/engine/board.js';
import { CITIES } from '../js/data/cities.js';
import { flagImage } from '../js/ui/modal.js';
import { ApiService } from '../services/ApiService.js';

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');

test('each character has an optimized in-game model under 2 MB', () => {
  CHARACTER_KEYS.forEach(key => {
    const file = path.join(publicDir, 'assets/players/game', `${key}.glb`);
    assert.ok(existsSync(file), `${key}.glb eksik`);
    assert.ok(statSync(file).size < 2 * 1024 * 1024, `${key}.glb oyun için fazla büyük`);
    assert.equal(readFileSync(file).subarray(0, 4).toString(), 'glTF', `${key}.glb geçerli bir GLB değil`);
  });
});

test('model selection: chosen character > name match > index default', () => {
  assert.equal(resolveCharacterKey({ characterKey: 'wizard', name: 'The King' }, 0), 'wizard');
  assert.equal(resolveCharacterKey({ name: 'The Viking' }, 0), 'viking');
  assert.equal(resolveCharacterKey({ name: 'kullanici_42' }, 1), 'king');
  assert.equal(resolveCharacterKey({ characterKey: 'dragon', name: 'x' }, 2), 'rocket');
});

test('cell positions are symmetric around the board center and corners are furthest', () => {
  const start = getCell3DPosition(0);
  const opposite = getCell3DPosition(16);
  assert.ok(Math.abs(start.x + opposite.x) < 1e-9 && Math.abs(start.z + opposite.z) < 1e-9);
  const middleEdge = getCell3DPosition(4);
  assert.ok(Math.hypot(start.x, start.z) > Math.hypot(middleEdge.x, middleEdge.z));
});

test('stadiums sit on the inner half of the cell (toward the pitch), not under the pawn', () => {
  for (const index of [2, 11, 19, 27]) {
    const cell = getCell3DPosition(index);
    const stadium = getStadium3DPosition(index);
    const inward = getCellInwardDirection(index);
    const moved = (stadium.x - cell.x) * inward.x + (stadium.z - cell.z) * inward.z;
    assert.ok(moved > 0.2, `hücre ${index}`);
    assert.ok(Math.hypot(stadium.x, stadium.z) < Math.hypot(cell.x, cell.z), `hücre ${index} merkeze yaklaşmalı`);
  }
});

test('long city names get a smaller font class so they never overflow', () => {
  assert.equal(nameSizeClass('Roma'), '');
  assert.equal(nameSizeClass('Rotterdam'), 'name-lg');
  assert.equal(nameSizeClass('Manchester'), 'name-xl');
  CITIES.filter(c => c.name.length >= 8).forEach(c => assert.notEqual(nameSizeClass(c.name), '', c.name));
});

test('every city has an SVG flag (no emoji letters like "PT" on Windows)', () => {
  CITIES.forEach(city => {
    assert.ok(city.country, `${city.name} ülke kodu eksik`);
    assert.ok(existsSync(path.join(publicDir, 'assets/flags', `${city.country}.svg`)), `${city.country}.svg eksik`);
    assert.match(flagImage(city), new RegExp(`/assets/flags/${city.country}\\.svg`));
  });
});

test('promo and character selection API calls', async () => {
  localStorage.clear();
  const api = new ApiService();
  api.setToken('t');
  api.setUser({ id: 'me', selected_character: null });
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    const body = url.endsWith('/store/characters/selected') ? { selected_character: 'king' } : { coins: 500, balance: 2500 };
    return { ok: true, status: 200, json: async () => body };
  };
  const promo = await api.redeemPromoCode('FT26-DEMO');
  assert.equal(promo.coins, 500);
  await api.selectCharacter('king');
  assert.equal(api.getUser().selected_character, 'king', 'seçim yerel kullanıcıya da yazılmalı');
  assert.deepEqual(calls.map(c => `${c.options.method} ${c.url.replace(/^.*\/api/, '')}`), ['POST /promo/redeem', 'PUT /store/characters/selected']);
  assert.deepEqual(JSON.parse(calls[0].options.body), { code: 'FT26-DEMO' });

  api.clearToken();
  assert.ok((await api.redeemPromoCode('X')).error, 'giriş yapmadan kullanılamaz');
});
