// ==========================================
// TAHTA YERLEŞİM VERİSİ
// ==========================================

export const BOARD_SIZE = 32;

// Tahta üzerindeki hücre sıralaması (0-31 indeks)
export const boardLayout = [
  { type: 'corner', name: 'START', flag: '🏁' }, // 0
  { type: 'city', idx: 1 }, // 1: Samsun (TR)
  { type: 'city', idx: 2 }, // 2: Trabzon (TR)
  { type: 'city', idx: 0 }, // 3: Istanbul (TR)
  { type: 'special', idx: 2 }, // 4: Kutu Aç
  { type: 'city', idx: 5 }, // 5: Braga (PT)
  { type: 'city', idx: 4 }, // 6: Porto (PT)
  { type: 'city', idx: 3 }, // 7: Lisboa (PT)
  { type: 'corner', name: 'Kayıp Ada', flag: '🌴' }, // 8
  { type: 'city', idx: 6 }, // 9: Roma (IT)
  { type: 'city', idx: 7 }, // 10: Milan (IT)
  { type: 'city', idx: 8 }, // 11: Juventus (IT)
  { type: 'special', idx: 7 }, // 12: Faul
  { type: 'city', idx: 9 }, // 13: Rotterdam (NL)
  { type: 'city', idx: 10 }, // 14: Amsterdam (NL)
  { type: 'city', idx: 11 }, // 15: Eindhoven (NL)
  { type: 'corner', name: 'Şampiyona', flag: '🏆' }, // 16
  { type: 'city', idx: 12 }, // 17: Marseille (FR)
  { type: 'city', idx: 13 }, // 18: Paris (FR)
  { type: 'city', idx: 14 }, // 19: Lyon (FR)
  { type: 'special', idx: 3 }, // 20: Penaltı
  { type: 'city', idx: 15 }, // 21: München (DE)
  { type: 'city', idx: 16 }, // 22: Dortmund (DE)
  { type: 'city', idx: 17 }, // 23: Leipzig (DE)
  { type: 'corner', name: 'Dünya Turu', flag: '✈️' }, // 24
  { type: 'city', idx: 18 }, // 25: Sevilla (ES)
  { type: 'city', idx: 19 }, // 26: Madrid (ES)
  { type: 'city', idx: 20 }, // 27: Barcelona (ES)
  { type: 'city', idx: 21 }, // 28: London (UK)
  { type: 'special', idx: 0 }, // 29: Vergi
  { type: 'city', idx: 22 }, // 30: Manchester (UK)
  { type: 'city', idx: 23 }, // 31: Liverpool (UK)
];
