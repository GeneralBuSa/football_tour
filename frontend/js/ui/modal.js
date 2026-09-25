// ==========================================
// MODAL YÖNETİMİ
// ==========================================

import { CITIES } from '../data/cities.js';
import { PLAYERS, currentPlayer } from '../engine/state.js';
import gameService from '../../services/GameService.js';
import { escapeHtml } from '../utils/html.js';

// Modal kapatma
export function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    if (id === 'settings-modal') {
      el.style.display = 'none';
    } else {
      el.remove();
    }
  }
}

// Ülke bayrağı görseli. Windows bayrak emojilerini "PT", "TR" gibi harflerle çizdiği için
// emoji yerine SVG kullanılır.
export function flagImage(city, width = 28) {
  if (!city?.country) return '';
  const height = Math.round((width * 2) / 3);
  return `<img class="flag-img" src="/assets/flags/${city.country}.svg" alt="${city.league} bayrağı" width="${width}" height="${height}" />`;
}

// Şehir bilgi modalı
export function openCityModal(cIdx, canBuy = false) {
  const c = CITIES[cIdx % CITIES.length];
  const owner = PLAYERS.find(p => p.ownedProps.includes(cIdx));
  const currentP = PLAYERS[currentPlayer];
  const stadLevel = owner && owner.stadiums[cIdx] ? owner.stadiums[cIdx] : 0;
  const isMine = owner === currentP;

  closeModal('city-modal');

  const div = document.createElement('div');
  div.className = 'modal-backdrop';
  div.id = 'city-modal';
  div.innerHTML = `
    <div class="modal city-modal" role="dialog" aria-modal="true" aria-labelledby="city-modal-title">
      <div class="modal-head">
        <div class="city-modal-title">
          ${flagImage(c, 36)}
          <div>
            <div class="modal-city" id="city-modal-title">${c.name}</div>
            <div class="modal-league">${c.league}</div>
          </div>
        </div>
      </div>
      <div class="modal-body">
        <div class="modal-stats-grid">
          <div class="modal-mini-stat"><div class="modal-mini-label">Fiyat</div><div class="modal-mini-val">₺${c.price.toLocaleString('tr-TR')}</div></div>
          <div class="modal-mini-stat"><div class="modal-mini-label">Kira</div><div class="modal-mini-val">₺${c.rent.toLocaleString('tr-TR')}</div></div>
          <div class="modal-mini-stat"><div class="modal-mini-label">Stadyum</div><div class="modal-mini-val">${stadLevel}/3</div></div>
          <div class="modal-mini-stat"><div class="modal-mini-label">Grup</div><div class="modal-mini-val" style="font-size:10px">${c.league.split(' ')[0]}</div></div>
        </div>
        ${owner ? `<div style="font-size:11px;text-align:center;color:${isMine ? '#27ae60' : '#e74c3c'}">${isMine ? '✅ Senin mülkün' : '🔴 ' + escapeHtml(owner.name) + ' bu şehre sahip'}</div>` : '<div style="font-size:11px;text-align:center;color:#7f8c8d">🏙️ Sahipsiz şehir</div>'}
      </div>
      <div class="modal-btns">
        ${canBuy && !owner && currentP.money >= c.price ? `<button class="mbtn mbtn-buy" onclick="window.buyCity(${cIdx})">Satın Al ₺${c.price.toLocaleString()}</button>` : ''}
        ${isMine && stadLevel < 3 && currentP.money >= Math.round(c.price * 0.4) ? `<button class="mbtn mbtn-upgrade" onclick="window.upgradeStadium(${cIdx})">Stadyum Yap ₺${Math.round(c.price * 0.4).toLocaleString()}</button>` : ''}
        <button class="mbtn mbtn-pass" onclick="window.closeModal('city-modal')">Kapat</button>
      </div>
    </div>`;
  document.body.appendChild(div);
}

// Başarım modalı
export function showAchievementsModal() {
  const achievements = gameService.achievement.getAll();

  closeModal('achievements-modal');

  const div = document.createElement('div');
  div.className = 'modal-backdrop';
  div.id = 'achievements-modal';

  const cardsHtml = achievements.map(ach => {
    let unlockedDateStr = '';
    if (ach.unlocked && ach.unlockedAt) {
      const date = new Date(ach.unlockedAt);
      unlockedDateStr = `<div class="ach-date">Açılış: ${date.toLocaleDateString('tr-TR')} ${date.toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}</div>`;
    }

    return `
      <div class="achievement-card ${ach.unlocked ? 'unlocked' : ''}">
        <div class="ach-icon-box">${ach.icon}</div>
        <div class="ach-details">
          <div class="ach-name">${ach.name}</div>
          <div class="ach-desc">${ach.desc}</div>
          ${unlockedDateStr}
        </div>
      </div>
    `;
  }).join('');

  div.innerHTML = `
    <div class="modal" style="width: 360px;">
      <div class="modal-head">
        <div class="modal-city">🏆 BAŞARIMLAR</div>
        <div class="modal-league">Kulüp Başarıları ve Kupalar</div>
      </div>
      <div class="modal-body">
        <div class="achievements-modal-body">
          ${cardsHtml}
        </div>
      </div>
      <div class="modal-btns">
        <button class="mbtn mbtn-pass" onclick="window.closeModal('achievements-modal')" style="width: 100%">Kapat</button>
      </div>
    </div>
  `;
  document.body.appendChild(div);
}
