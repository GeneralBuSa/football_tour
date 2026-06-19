// ==========================================
// ZAR ATMA VE PİYON HAREKETİ
// ==========================================

import { CITIES, SPECIAL_CELLS } from '../data/cities.js';
import { BOARD_SIZE } from '../data/boardLayout.js';
import {
  PLAYERS, currentPlayer, diceRolled, turnCount,
  setDice, setDiceRolled, setTutorialText
} from './state.js';
import { boardCells, buildBoard } from './board.js';
import { addLog, showNotif, updateTutorialHUD } from '../ui/panel.js';
import { openCityModal } from '../ui/modal.js';
import { renderPlayers } from './player.js';
import { renderPanel } from '../ui/panel.js';
import { openLootBox } from './economy.js';
import gameService from '../../services/GameService.js';

// Zar atma
export function rollDice() {
  if (diceRolled) return;

  const rollBtn = document.getElementById('btn-roll');
  if (rollBtn) {
    rollBtn.disabled = true;
    rollBtn.style.display = 'none';
  }

  const d1 = Math.ceil(Math.random() * 6);
  const d2 = Math.ceil(Math.random() * 6);
  setDice(d1, d2);
  const totalSteps = d1 + d2;

  setTutorialText(`${PLAYERS[currentPlayer].name} zar atıyor... Sonuç: 🎲 ${d1} + 🎲 ${d2} = ${totalSteps} adım!`);
  updateTutorialHUD();

  setTimeout(() => {
    setDiceRolled(true);
    movePlayer(totalSteps);
  }, 800);
}

// Piyon hareketi
export function movePlayer(steps) {
  const p = PLAYERS[currentPlayer];
  const oldPos = p.pos;
  const newPos = (p.pos + steps) % BOARD_SIZE;
  if (newPos < oldPos) {
    p.money += 100000;
    addLog(p, `Başlangıç'tan geçti`, '+₺100K', 'good');
    showNotif(`${p.name} başlangıçtan geçti! +₺100K`);
  }
  p.pos = newPos;
  const cell = boardCells[newPos];
  buildBoard(openCityModal);
  setTimeout(() => {
    handleCell(p, cell, newPos);

    const endBtn = document.getElementById('btn-end');
    if (endBtn) endBtn.style.display = '';

    renderPlayers();
    renderPanel();
  }, 300);
}

// Hücre kuralları
export function handleCell(p, cell, pos) {
  if (cell.type === 'city') {
    const c = cell.city;
    const cIdx = cell.cityIdx;
    const owner = PLAYERS.find(pl => pl.ownedProps.includes(cIdx));
    if (!owner) {
      setTutorialText(`${p.name}, sahipsiz ${c.name} şehrine geldi. Satın almak ister misiniz?`);
      openCityModal(cIdx, true);
    } else if (owner !== p) {
      const rent = c.rent * (1 + (owner.stadiums && owner.stadiums[cIdx] ? owner.stadiums[cIdx] : 0) * 0.5);
      const actual = Math.min(p.money, Math.round(rent));
      p.money -= actual;
      owner.money += actual;
      addLog(p, `${c.name}'da kira ödedi →`, `−₺${actual} → ${owner.name}`, 'bad');
      showNotif(`${p.name} ${c.name}'da ₺${actual} kira ödedi!`);

      setTutorialText(`${p.name}, ${owner.name} oyuncusuna ait ${c.name} şehrinde ₺${actual} kira ödedi!`);

      if (p.money <= 0) {
        gameService.achievement.unlock('BANKRUPT');
        setTutorialText(`${p.name} iflas etti! Oyun bitti.`);
      }
      buildBoard(openCityModal);
    } else {
      setTutorialText(`${p.name}, kendi mülkü olan ${c.name} şehrinde dinleniyor.`);
      addLog(p, `Kendi mülkü ${c.name}`, '🏟️', 'good');
    }
  } else if (cell.type === 'special') {
    const s = cell.special;
    setTutorialText(`${p.name}, ${s.name} alanına geldi: ${s.action}`);

    if (s.type === 'tax') {
      p.money = Math.max(0, p.money - 50000);
      addLog(p, 'Vergi ödedi', '−₺50K', 'bad');
      showNotif(`${p.name} ₺50K vergi ödedi!`);
    } else if (s.type === 'bonus') {
      p.money += 40000;
      addLog(p, 'Gol bonusu aldı', '+₺40K', 'good');
      showNotif(`${p.name} ₺40K gol bonusu aldı! ⚽`);
    } else if (s.type === 'penalty') {
      p.money += 60000;
      addLog(p, 'Penaltı golü attı', '+₺60K', 'good');
      showNotif(`${p.name} penaltıdan gol attı! +₺60K 🎯`);
    } else if (s.type === 'loot') {
      openLootBox();
    } else if (s.type === 'jail') {
      addLog(p, 'Kırmızı kart yedi!', '🟥 Sıra kaybı', 'bad');
      showNotif(`${p.name} kırmızı kart yedi! Sıra kaybı.`);
    } else if (s.type === 'foul') {
      p.money = Math.max(0, p.money - 30000);
      addLog(p, 'Faul cezası', '−₺30K', 'bad');
    } else if (s.type === 'wc') {
      p.money += 150000;
      addLog(p, 'Şampiyona! Büyük ödül', '+₺150K', 'good');
      showNotif(`${p.name} Şampiyonayı kazandı! +₺150K 🏆`);
      gameService.achievement.unlock('WIN_WORLD_CUP');
    }
    buildBoard(openCityModal);
  } else if (cell.type === 'corner') {
    setTutorialText(`${p.name}, ${cell.html.includes('START') ? 'Başlangıç' : 'Köşe'} noktasına geldi.`);
    addLog(p, `Köşeye geldi`, cell.html.includes('Dünya Turu') ? '✈️ Dünya Turu' : '📍', '');
  }
  updateTutorialHUD();
}
