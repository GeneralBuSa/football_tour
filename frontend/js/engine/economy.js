// ==========================================
// EKONOMİ — Satın alma, stadyum, kutu açma
// ==========================================

import { CITIES } from '../data/cities.js';
import { PLAYERS, currentPlayer, setTutorialText } from './state.js';
import { buildBoard } from './board.js';
import { addLog, showNotif, updateTutorialHUD } from '../ui/panel.js';
import { closeModal, openCityModal } from '../ui/modal.js';
import { renderPlayers, syncMultiplayerState } from './player.js';
import { renderPanel } from '../ui/panel.js';
import { updateStadiums3D } from '../3d/stadiums.js';
import gameService from '../../services/GameService.js';
import multiplayerService from '../../services/MultiplayerService.js';

// Şehir satın al
export function buyCity(cIdx) {
  if (!multiplayerService.canControlTurn(currentPlayer)) {
    showNotif('Bu tur rakibinizin. Satın alma yapamazsınız.');
    return;
  }
  const c = CITIES[cIdx % CITIES.length];
  const p = PLAYERS[currentPlayer];
  if (p.money < c.price) return;
  p.money -= c.price;
  p.ownedProps.push(cIdx);
  addLog(p, `${c.name} satın aldı`, `−₺${c.price.toLocaleString()}`, 'bad');
  showNotif(`${p.name}, ${c.name}'ı satın aldı! 🏙️`);
  closeModal('city-modal');

  setTutorialText(`${p.name}, ${c.name} şehrini satın aldı!`);
  updateTutorialHUD();

  renderPlayers();
  renderPanel();
  buildBoard(openCityModal);
  updateStadiums3D();

  if (p.ownedProps.length >= 5) {
    gameService.achievement.unlock('PROPERTIES_5');
  }

  // Liga hakimliği kontrolü
  const boughtCity = CITIES[cIdx];
  const groupCities = CITIES.map((c, i) => ({ ...c, idx: i })).filter(c => c.group === boughtCity.group);
  const allOwned = groupCities.every(c => p.ownedProps.includes(c.idx));
  if (allOwned) {
    gameService.achievement.unlock('FULL_GROUP');
  }

  // Multiplayer: Şehir satın alma sonrası sync
  syncMultiplayerState('buy_city');
}

// Stadyum yap
export function upgradeStadium(cIdx) {
  if (!multiplayerService.canControlTurn(currentPlayer)) {
    showNotif('Bu tur rakibinizin. Stadyum yükseltemezsiniz.');
    return;
  }
  const c = CITIES[cIdx % CITIES.length];
  const p = PLAYERS[currentPlayer];
  const cost = Math.round(c.price * 0.4);
  if (p.money < cost) { showNotif('Yeterli para yok!'); return; }
  if (!p.stadiums) p.stadiums = {};
  if (!p.stadiums[cIdx]) p.stadiums[cIdx] = 0;
  if (p.stadiums[cIdx] >= 3) return;
  p.money -= cost;
  p.stadiums[cIdx]++;
  addLog(p, `${c.name} stadyum yükseltti`, `Seviye ${p.stadiums[cIdx]}`, 'good');
  showNotif(`${c.name} stadyumu Seviye ${p.stadiums[cIdx]}'e yükseltildi! 🏟️`);
  closeModal('city-modal');

  setTutorialText(`${p.name}, ${c.name} stadyumunu Seviye ${p.stadiums[cIdx]}'e yükseltti!`);
  updateTutorialHUD();

  renderPlayers();
  renderPanel();
  updateStadiums3D();

  if (p.stadiums[cIdx] === 3) {
    gameService.achievement.unlock('MAX_STADIUM');
  }

  // Multiplayer: Stadyum yükseltme sonrası sync
  syncMultiplayerState('upgrade_stadium');
}

// Kutu açma
export function openLootBox() {
  if (!multiplayerService.canControlTurn(currentPlayer)) {
    showNotif('Bu tur rakibinizin. Kutu açamazsınız.');
    return;
  }
  const rewards = [
    { icon: '💰', desc: 'Büyük para ödülü!', reward: '+₺120K', val: 120000, good: true },
    { icon: '⚽', desc: 'Gol attın!', reward: '+₺60K', val: 60000, good: true },
    { icon: '🏆', desc: 'Kupa bonusu!', reward: '+₺200K', val: 200000, good: true },
    { icon: '🦵', desc: 'Faul yapıldı!', reward: '−₺40K', val: -40000, good: false },
    { icon: '🟥', desc: 'Kırmızı kart!', reward: 'Sıra Kaybı', val: 0, good: false },
    { icon: '🌟', desc: 'Yıldız oyuncu bonusu!', reward: '+₺90K', val: 90000, good: true },
    { icon: '💸', desc: 'Vergi geldi!', reward: '−₺80K', val: -80000, good: false },
    { icon: '🎯', desc: 'Penaltı kazandın!', reward: '+₺50K', val: 50000, good: true },
  ];
  const r = rewards[Math.floor(Math.random() * rewards.length)];
  const p = PLAYERS[currentPlayer];
  if (r.val !== 0) p.money = Math.max(0, p.money + r.val);
  addLog(p, `Kutu açtı: ${r.desc}`, r.reward, r.good ? 'good' : 'bad');

  closeLoot();

  const div = document.createElement('div');
  div.className = 'loot-overlay';
  div.id = 'loot-overlay';
  div.innerHTML = `
    <div class="loot-box">
      <div class="loot-title">📦 KUTU AÇILDI!</div>
      <div class="loot-icon">${r.icon}</div>
      <div class="loot-desc">${r.desc}</div>
      <div class="loot-reward ${r.good ? '' : 'bad'}">${r.reward}</div>
      <button class="loot-close" onclick="window.closeLoot()">Devam Et</button>
    </div>`;
  document.body.appendChild(div);

  setTutorialText(`${p.name} sürpriz kutu açtı ve kazandı: ${r.reward}`);
  updateTutorialHUD();

  renderPlayers();

  if (r.val === 200000) {
    gameService.achievement.unlock('GOLD_LOOT');
  }

  // Multiplayer: Sürpriz kutu açma sonrası sync
  syncMultiplayerState('open_lootbox');
}

export function closeLoot() {
  const el = document.getElementById('loot-overlay');
  if (el) el.remove();
  renderPanel();
}
