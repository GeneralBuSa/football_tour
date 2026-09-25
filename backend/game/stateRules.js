// Çevrimiçi maç durumu için sunucu tarafı kural denetimi.
//
// Oyun motoru istemcide çalışır; her hamleden sonra istemci tüm durumu gönderir. Sunucu
// bu durumu körü körüne kabul etmek yerine, son kabul ettiği durumdan geçişin oyun
// kurallarıyla mümkün olup olmadığını denetler. Böylece bir istemci kendine para
// yazamaz, rakibinin parasını/şehrini alamaz, bedelini ödemeden şehir/stadyum alamaz
// ve sırayı atlayamaz. Maç sonucu da yalnızca bu şekilde kabul edilmiş durumdan çıkar.
//
// Kurallar frontend/js/engine (dice.js, economy.js, player.js) ile birebir uyumludur;
// frontend/test/stateRules.test.js gerçek oyun motoruyla oynanan rastgele oyunların her
// hamlesinin burada kabul edildiğini doğrular.

export const START_MONEY = 1_000_000;
export const ONLINE_PLAYER_COUNT = 2;
export const BOARD_SIZE = 32;
export const MAX_STADIUM_LEVEL = 3;
export const GAME_DURATION_SECONDS = 1800;

// Şehir fiyatları (frontend/js/data/cities.js ile aynı sırada).
export const CITY_PRICES = [
  100000, 70000, 80000,
  130000, 120000, 110000,
  140000, 160000, 170000,
  190000, 210000, 220000,
  240000, 250000, 270000,
  260000, 280000, 300000,
  320000, 380000, 400000,
  420000, 430000, 450000
];

// Bankadan para kazandırabilen tahta hücreleri (frontend/js/data/boardLayout.js):
// 4 = Kutu Aç (en büyük ödül +₺200K), 20 = Penaltı (+₺60K). Diğer hücreler para vermez
// ya da yalnızca para aldırır (vergi, faul, kira).
export const CELL_MAX_GAIN = Object.freeze({ 4: 200_000, 20: 60_000 });
export const PASS_START_BONUS = 100_000;
// Zar: iki zar, 2-12 kare ileri.
const MIN_STEPS = 2;
const MAX_STEPS = 12;
const MAX_MONEY = 10_000_000_000;

export const stadiumCost = cityIdx => Math.round(CITY_PRICES[cityIdx] * 0.4);

export function initialState(playerCount = ONLINE_PLAYER_COUNT) {
  return {
    players: Array.from({ length: playerCount }, () => ({ money: START_MONEY, pos: 0, ownedProps: [], stadiums: {} })),
    currentPlayer: 0,
    turnCount: 1
  };
}

export function hasGameState(state) {
  return !!state && typeof state === 'object' && Array.isArray(state.players) && state.players.length > 0;
}

const isInt = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;

function readStadiums(stadiums) {
  if (stadiums === undefined || stadiums === null) return new Map();
  if (typeof stadiums !== 'object' || Array.isArray(stadiums)) return null;
  const levels = new Map();
  for (const [key, level] of Object.entries(stadiums)) {
    const cityIdx = Number(key);
    if (!isInt(cityIdx, 0, CITY_PRICES.length - 1) || String(cityIdx) !== key) return null;
    if (!isInt(level, 0, MAX_STADIUM_LEVEL)) return null;
    if (level > 0) levels.set(cityIdx, level);
  }
  return levels;
}

// Durumun kendi içinde tutarlı olup olmadığını denetler ve karşılaştırma için normalize eder.
function readState(state, expectedPlayers) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return { error: 'state must be an object' };
  if (!Array.isArray(state.players) || state.players.length !== expectedPlayers) return { error: 'invalid player count' };
  if (!isInt(state.currentPlayer, 0, expectedPlayers - 1)) return { error: 'invalid currentPlayer' };
  if (!isInt(state.turnCount, 1, 1_000_000)) return { error: 'invalid turnCount' };

  const owners = new Map();
  const players = [];
  for (let i = 0; i < state.players.length; i++) {
    const p = state.players[i];
    if (!p || typeof p !== 'object') return { error: 'invalid player' };
    if (!isInt(p.money, 0, MAX_MONEY)) return { error: 'invalid money' };
    if (!isInt(p.pos, 0, BOARD_SIZE - 1)) return { error: 'invalid position' };
    if (!Array.isArray(p.ownedProps)) return { error: 'invalid ownedProps' };
    const owned = new Set();
    for (const cityIdx of p.ownedProps) {
      if (!isInt(cityIdx, 0, CITY_PRICES.length - 1) || owned.has(cityIdx)) return { error: 'invalid ownedProps' };
      if (owners.has(cityIdx)) return { error: 'city owned by two players' };
      owned.add(cityIdx);
      owners.set(cityIdx, i);
    }
    const stadiums = readStadiums(p.stadiums);
    if (!stadiums) return { error: 'invalid stadiums' };
    for (const cityIdx of stadiums.keys()) {
      if (!owned.has(cityIdx)) return { error: 'stadium on a city that is not owned' };
    }
    players.push({ money: p.money, pos: p.pos, owned, stadiums });
  }
  return { players, currentPlayer: state.currentPlayer, turnCount: state.turnCount };
}

// prev: sunucunun son kabul ettiği durum (maç başında initialState()), next: istemcinin
// gönderdiği durum. Hamleyi yapan oyuncu prev.currentPlayer'dır.
export function validateStateTransition(prevState, nextState) {
  const count = Array.isArray(prevState?.players) ? prevState.players.length : 0;
  const prev = readState(prevState, count);
  if (prev.error) return { ok: false, reason: `stored state: ${prev.error}` };
  const next = readState(nextState, count);
  if (next.error) return { ok: false, reason: next.error };

  const actor = prev.currentPlayer;

  // Sıra: ya aynı oyuncuda kalır ya da bir sonrakine geçer; tur sayısı yalnızca sıra
  // ilk oyuncuya döndüğünde bir artar.
  if (next.currentPlayer === actor) {
    if (next.turnCount !== prev.turnCount) return { ok: false, reason: 'turnCount changed without a turn change' };
  } else if (next.currentPlayer === (actor + 1) % count) {
    const expected = next.currentPlayer === 0 ? prev.turnCount + 1 : prev.turnCount;
    if (next.turnCount !== expected) return { ok: false, reason: 'invalid turnCount' };
  } else {
    return { ok: false, reason: 'turn order violated' };
  }

  let received = 0;
  let cost = 0;
  for (let i = 0; i < count; i++) {
    const before = prev.players[i];
    const after = next.players[i];
    const moneyDelta = after.money - before.money;

    if (i !== actor) {
      // Sırası olmayan oyuncu yalnızca kira alabilir; yeri, şehirleri ve stadyumları değişmez.
      if (moneyDelta < 0) return { ok: false, reason: 'opponent money decreased' };
      if (after.pos !== before.pos) return { ok: false, reason: 'opponent moved' };
      if (after.owned.size !== before.owned.size || [...before.owned].some(c => !after.owned.has(c))) {
        return { ok: false, reason: 'opponent properties changed' };
      }
      if (after.stadiums.size !== before.stadiums.size ||
          [...before.stadiums].some(([c, level]) => after.stadiums.get(c) !== level)) {
        return { ok: false, reason: 'opponent stadiums changed' };
      }
      received += moneyDelta;
      continue;
    }

    // Şehir satılamaz; stadyum seviyesi düşmez. Yeni şehir ve stadyumların bedeli ödenir.
    for (const cityIdx of before.owned) {
      if (!after.owned.has(cityIdx)) return { ok: false, reason: 'property removed' };
    }
    for (const cityIdx of after.owned) {
      if (!before.owned.has(cityIdx)) cost += CITY_PRICES[cityIdx];
    }
    for (const [cityIdx, level] of after.stadiums) {
      const oldLevel = before.stadiums.get(cityIdx) || 0;
      if (level < oldLevel) return { ok: false, reason: 'stadium level decreased' };
      cost += (level - oldLevel) * stadiumCost(cityIdx);
    }
    for (const [cityIdx] of before.stadiums) {
      if (!after.stadiums.has(cityIdx)) return { ok: false, reason: 'stadium removed' };
    }
  }

  // Piyon yalnızca zar kadar (2-12 kare) ileri gider; bankadan kazanç, başlangıçtan geçiş
  // ve gelinen hücreyle sınırlıdır. Piyon yer değiştirmediyse (satın alma, tur devri)
  // bankadan hiç para gelmez.
  const fromPos = prev.players[actor].pos;
  const toPos = next.players[actor].pos;
  let maxBankGain = 0;
  if (toPos !== fromPos) {
    const steps = (toPos - fromPos + BOARD_SIZE) % BOARD_SIZE;
    if (steps < MIN_STEPS || steps > MAX_STEPS) return { ok: false, reason: 'invalid move distance' };
    maxBankGain = (toPos < fromPos ? PASS_START_BONUS : 0) + (CELL_MAX_GAIN[toPos] || 0);
  }

  // Hamle yapanın bankadan aldığı = kendi para farkı + harcadığı + rakibe ödediği kira.
  const actorDelta = next.players[actor].money - prev.players[actor].money;
  if (actorDelta + cost + received > maxBankGain) {
    return { ok: false, reason: 'money gain exceeds game rules' };
  }
  return { ok: true };
}
