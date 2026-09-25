// ==========================================
// TAHTA OLUŞTURMA VE HESAPLAMA
// ==========================================

import { CITIES, SPECIAL_CELLS } from '../data/cities.js';
import { boardLayout } from '../data/boardLayout.js';
import { PLAYERS } from './state.js';

// Uzun şehir adları (ör. Rotterdam, Amsterdam, Eindhoven) hücreden taşmasın diye
// ada göre yazı boyutu sınıfı seçilir.
export function nameSizeClass(name) {
  const length = String(name).length;
  if (length >= 10) return 'name-xl';
  if (length >= 8) return 'name-lg';
  return '';
}

// Tahta hücrelerini hesapla
function getBoardCells() {
  const cells = [];

  boardLayout.forEach((item, i) => {
    let sideClass = '';
    let cornerClass = '';

    if (i > 0 && i < 8) {
      sideClass = 'cell-side-bl';
    } else if (i > 8 && i < 16) {
      sideClass = 'cell-side-tl';
    } else if (i > 16 && i < 24) {
      sideClass = 'cell-side-tr';
    } else if (i > 24) {
      sideClass = 'cell-side-br';
    }

    if (i === 0) cornerClass = 'corner-bottom';
    if (i === 8) cornerClass = 'corner-left';
    if (i === 16) cornerClass = 'corner-top';
    if (i === 24) cornerClass = 'corner-right';

    if (item.type === 'corner') {
      cells.push({
        type: 'corner',
        cls: 'cell cell-corner ' + cornerClass,
        html: `<div class="cell-content"><span class="city-flag" style="font-size:16px">${item.flag}</span><span class="city-name">${item.name}</span></div>`
      });
    } else if (item.type === 'special') {
      const s = SPECIAL_CELLS[item.idx];
      cells.push({
        type: 'special',
        cls: 'cell cell-special ' + sideClass,
        html: `<div class="cell-content"><span class="city-flag">${s.icon}</span><span class="city-name">${s.name}</span></div>`,
        special: s
      });
    } else if (item.type === 'city') {
      const c = CITIES[item.idx];
      cells.push({
        type: 'city',
        cls: 'cell cell-city ' + sideClass,
        label: `${c.name}, ${c.league}, fiyat ₺${c.price.toLocaleString('tr-TR')}`,
        html: `
          <div class="owner-color-bar" style="background:${c.color}"></div>
          <div class="cell-content">
            <span class="city-name ${nameSizeClass(c.name)}">${c.name}</span>
            <span class="city-price">₺${(c.price / 1000).toFixed(0)}K</span>
          </div>
        `,
        cityIdx: item.idx,
        city: c
      });
    }
  });

  return cells;
}

export const boardCells = getBoardCells();

// Grid indeks hesaplama (row, col -> board index)
export function getBoardIndex(row, col) {
  // Sol kenar: col=0, row=8 to 0 -> indices 0 to 8
  if (col === 0) return 8 - row;
  // Üst kenar: row=0, col=1 to 8 -> indices 9 to 16
  if (row === 0) return 8 + col;
  // Sağ kenar: col=8, row=1 to 8 -> indices 17 to 24
  if (col === 8) return 16 + row;
  // Alt kenar: row=8, col=7 to 1 -> indices 25 to 31
  if (row === 8) return 24 + (8 - col);
  return null;
}

export function getBoardLayout() {
  return boardCells;
}

// Tahtayı DOM'a çiz
export function buildBoard(openCityModalFn) {
  const grid = document.getElementById('board-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const cells = getBoardLayout();
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      // Dış çerçeve hücreleri
      if (row === 0 || row === 8 || col === 0 || col === 8) {
        const el = document.createElement('div');
        const idx = getBoardIndex(row, col);
        if (idx !== null) {
          const cd = cells[idx];
          el.className = 'cell ' + cd.cls;
          el.dataset.cellIndex = idx;
          if (cd.label) {
            el.title = cd.label;
            el.setAttribute('aria-label', cd.label);
          }
          el.style.background = cd.bg || '';
          if (cd.borderColor) el.style.borderColor = cd.borderColor;
          el.innerHTML = cd.html;

          if (cd.cityIdx !== undefined && openCityModalFn) {
            el.onclick = () => openCityModalFn(cd.cityIdx);
          }

          // Mülk sahiplik renk çubuğu
          const owner = PLAYERS.find(p => p.ownedProps.includes(cd.cityIdx));
          if (owner) {
            const ownerBar = document.createElement('div');
            ownerBar.className = 'owner-color-bar';
            ownerBar.style.background = owner.color;
            el.appendChild(ownerBar);
            el.classList.add('cell-owned');
            el.style.borderColor = owner.color;
          }
        }
        grid.appendChild(el);
      }
      // Merkez futbol sahası
      else if (row === 1 && col === 1) {
        const el = document.createElement('div');
        el.className = 'cell cell-center';
        el.style.gridColumn = '2 / 9';
        el.style.gridRow = '2 / 9';

        // Saha: çizgiler CSS ile; sayaç ve olay kartı artık ekran üstündeki HUD'da.
        el.innerHTML = `
          <div class="pitch-markings" aria-hidden="true">
            <span class="pitch-box pitch-box-left"></span>
            <span class="pitch-box pitch-box-right"></span>
            <span class="pitch-circle"></span>
            <img class="pitch-logo" src="/assets/logo.webp" alt="" width="120" height="120" />
          </div>
        `;
        grid.appendChild(el);
      }
    }
  }
  if (window.update3DPawnsTargetPositions) window.update3DPawnsTargetPositions();
}
