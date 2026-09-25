// Oyun ekranı yardımcıları: kaydet/yükle, tema, menüye dönüş, bildirimler ve
// ana menüde 3D model indirmelerinin ertelenmesi.
import './setup/dom.js';
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// pawns.js modül yüklenirken indirme zamanlayıcısını kurar; boşta kalma geri çağrısı
// testte yakalanabilsin diye içe aktarmadan önce tanımlanır.
const idleCallbacks = [];
globalThis.requestIdleCallback = fn => { idleCallbacks.push(fn); return idleCallbacks.length; };

const state = await import('../js/engine/state.js');
const { boardCells } = await import('../js/engine/board.js');
const { buyCity } = await import('../js/engine/economy.js');
const settings = await import('../js/ui/settings.js');
const { showNotif } = await import('../js/ui/panel.js');
const { modelDownloadsStarted, update3DPawnsTargetPositions } = await import('../js/3d/pawns.js');
const multiplayerService = (await import('../services/MultiplayerService.js')).default;
const apiService = (await import('../services/ApiService.js')).default;

const cityCell = cityIdx => boardCells.findIndex(cell => cell.type === 'city' && cell.cityIdx === cityIdx);

beforeEach(() => {
  apiService.logout();
  state.resetState();
  state.setPlayers(state.PLAYERS.slice(0, 2));
  multiplayerService.stop();
  localStorage.clear();
  document.__reset();
  document.body.classList._set.clear();
  ['btn-roll', 'btn-end', 'turn-badge', 'phase-label', 'timer-val'].forEach(id => document.__register(id));
});

test('3D models are not downloaded while the main menu is loading', () => {
  // Sayfa "load" olmadan boşta kalma zamanlayıcısı bile kurulmaz.
  assert.equal(modelDownloadsStarted(), false);
  assert.equal(idleCallbacks.length, 0);

  // Menü açıkken (tahta görünmez) piyon güncellemesi indirmeyi başlatmaz.
  update3DPawnsTargetPositions();
  assert.equal(modelDownloadsStarted(), false);

  // Sayfa yüklendikten sonra tarayıcı boşa çıkınca indirme başlar.
  window.dispatchEvent({ type: 'load' });
  assert.equal(idleCallbacks.length, 1);
  idleCallbacks[0]();
  assert.equal(modelDownloadsStarted(), true);
});

test('guest save/load restores money, ownership and turn from browser storage', async () => {
  const notifications = [];
  const originalAppend = document.body.appendChild;
  document.body.appendChild = child => {
    if (child.className === 'notification') notifications.push(child.textContent);
    return originalAppend(child);
  };

  try {
    state.PLAYERS[0].pos = cityCell(0);
    buyCity(0);
    const savedMoney = state.PLAYERS[0].money;
    await settings.saveGame();
    assert.ok(localStorage.getItem('football_tour_save'), 'kayıt tarayıcı belleğine yazılmalı');

    state.PLAYERS[0].money = 1;
    state.PLAYERS[0].ownedProps = [];
    state.setCurrentPlayer(1);

    await settings.loadGame();
    assert.equal(state.PLAYERS[0].money, savedMoney);
    assert.deepEqual(state.PLAYERS[0].ownedProps, [0]);
    assert.equal(state.currentPlayer, 0);
    assert.deepEqual(notifications.slice(-2), ['Oyun tarayıcı belleğine kaydedildi!', 'Kayıt başarıyla yüklendi!']);
  } finally {
    document.body.appendChild = originalAppend;
  }
});

test('loading without a save reports it instead of changing the game', async () => {
  const before = JSON.stringify(state.PLAYERS.map(p => p.money));
  await settings.loadGame();
  assert.equal(JSON.stringify(state.PLAYERS.map(p => p.money)), before);
  const notif = document.body.children.find(c => c.className === 'notification');
  assert.match(notif.textContent, /bulunamadı/i);
});

test('corrupted save data is rejected with a message', () => {
  settings.applySaveData('{not json');
  const notif = document.body.children.find(c => c.className === 'notification');
  assert.equal(notif.textContent, 'Veri yüklenemedi!');
});

test('theme toggle persists and initTheme restores it', () => {
  const btn = document.__register('btn-theme');
  settings.toggleTheme();
  assert.equal(document.body.classList.contains('light-theme'), true);
  assert.equal(localStorage.getItem('game_theme'), 'light');
  assert.equal(btn.textContent, '☀️');

  document.body.classList.remove('light-theme');
  settings.initTheme();
  assert.equal(document.body.classList.contains('light-theme'), true);

  settings.toggleTheme();
  assert.equal(localStorage.getItem('game_theme'), 'dark');
  assert.equal(btn.textContent, '🌙');
});

test('exit to main menu stops the timer, resets the clock and shows the menu', () => {
  const menu = document.__register('main-menu');
  const app = document.__register('app');
  menu.style.display = 'none';
  app.style.display = 'flex';

  settings.startTimer();
  assert.ok(state.timerId, 'sayaç çalışmalı');
  state.setGameTime(42);

  settings.exitToMainMenu();
  assert.equal(state.timerId, null);
  assert.equal(state.gameTime, 1800);
  assert.equal(state.gameEnded, false);
  assert.equal(menu.style.display, 'flex');
  assert.equal(app.style.display, 'none');
});

test('a new notification replaces the previous one', () => {
  let current = null;
  const originalQuery = document.querySelector;
  document.querySelector = selector => (selector === '.notification' ? current : null);
  const originalAppend = document.body.appendChild;
  document.body.appendChild = child => { current = child; return originalAppend(child); };
  try {
    showNotif('ilk');
    const first = current;
    showNotif('ikinci');
    assert.equal(first.parentNode.children.includes(first), false, 'eski bildirim kaldırılmalı');
    assert.equal(current.textContent, 'ikinci');
  } finally {
    document.querySelector = originalQuery;
    document.body.appendChild = originalAppend;
  }
});

test('login redirect (?next=) only allows same-site paths (open redirect regression)', async () => {
  const { safeNextPath } = await import('../src/app/shared/safeRedirect.js');
  assert.equal(safeNextPath('/store'), '/store');
  assert.equal(safeNextPath('/store?payment=success#top'), '/store?payment=success#top');
  assert.equal(safeNextPath('/starter?next=/profile'), '/starter?next=/profile');

  const attacks = [
    '//evil.example', '/\\evil.example', '/\\/evil.example', '\\\\evil.example',
    // Adres çubuğundaki ?next=/%5Cevil.example, URLSearchParams ile "/\evil.example" olur.
    new URLSearchParams('next=/%5Cevil.example').get('next'),
    'https://evil.example', 'javascript:alert(1)', '/\tevil', '/\nevil', '', null, undefined, 42
  ];
  attacks.forEach(value => assert.equal(safeNextPath(value), null, JSON.stringify(value)));

  // Giriş sayfasına geri dönüş döngüsü engellenir.
  assert.equal(safeNextPath('/auth?next=/store', { excludePrefixes: ['/auth'] }), null);
  assert.equal(safeNextPath('/profile', { excludePrefixes: ['/auth'] }), '/profile');
});
