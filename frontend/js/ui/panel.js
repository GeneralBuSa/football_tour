// ==========================================
// PANEL VE LOG YÖNETİMİ
// ==========================================

import {
  PLAYERS, currentPlayer, turnCount, gameLog, activeTab, currentTutorialText,
  setActiveTab, addLogEntry
} from '../engine/state.js';
import { boardCells } from '../engine/board.js';

// Tutorial HUD güncelleme
export function updateTutorialHUD() {
  const el = document.getElementById('tutorial-text');
  if (el) el.textContent = currentTutorialText;
}

// Log ekleme
export function addLog(player, action, val, type) {
  addLogEntry({ player: player.name, color: player.color, action, val, type, turn: turnCount });
  if (activeTab === 'log') renderPanel();
}

// Bildirim gösterme
export function showNotif(msg) {
  const old = document.querySelector('.notification');
  if (old) old.remove();
  const div = document.createElement('div');
  div.className = 'notification';
  div.textContent = msg;
  document.body.appendChild(div);
  setTimeout(() => { if (div.parentNode) div.remove(); }, 2800);
}

// Sekme geçişi
export function switchTab(tab, el) {
  setActiveTab(tab);
  document.querySelectorAll('.ptab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderPanel();
}

// Sağ panel çizimi
export function renderPanel() {
  const body = document.getElementById('panel-body');
  if (!body) return;
  if (activeTab === 'props') {
    let html = '';
    boardCells.forEach((cell) => {
      if (cell.type !== 'city') return;
      const c = cell.city;
      const i = cell.cityIdx;
      const owner = PLAYERS.find(p => p.ownedProps.includes(i));
      const stadLevel = owner && owner.stadiums[i] ? owner.stadiums[i] : 0;
      html += `<div class="prop-card ${owner ? 'prop-card-owned' : 'prop-card-free'}" onclick="window.openCityModal(${i})" style="--glow-color: ${owner ? owner.color : '#f5d061'}">
        <div class="prop-header">
          <div class="prop-color" style="background:${c.color}"></div>
          <div class="prop-city">${c.name}</div>
          ${owner ? `<div style="width:8px;height:8px;border-radius:50%;background:${owner.color};margin-left:auto"></div>` : ''}
        </div>
        <div class="prop-row"><span>${c.league}</span><span class="prop-val">₺${(c.price / 1000).toFixed(0)}K</span></div>
        ${owner ? `<div class="prop-row"><span>Sahip: <span style="color:${owner.color}">${owner.name}</span></span><span>${'🏟️'.repeat(stadLevel)}</span></div>` : '<div class="prop-row"><span style="color:#7f8c8d">Sahipsiz</span></div>'}
      </div>`;
    });
    body.innerHTML = html;
  } else if (activeTab === 'log') {
    if (!gameLog.length) { body.innerHTML = '<div style="font-size:11px;color:#7f8c8d;text-align:center;padding:20px">Henüz olay yok</div>'; return; }
    body.innerHTML = gameLog.map(l => `
      <div class="log-item">
        <span class="log-player" style="color:${l.color}">${l.player}</span>
        <span class="log-action"> ${l.action} </span>
        <span class="log-${l.type || ''}${l.type ? '' : ''}">${l.val}</span>
      </div>`).join('');
  }
}
