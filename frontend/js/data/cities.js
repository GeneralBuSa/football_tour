// ==========================================
// ŞEHİR VE ÖZEL ALAN VERİLERİ
// ==========================================

export const CITIES = [
  // Türkiye 🇹🇷 (Group 0)
  { name: "İstanbul", flag: "🇹🇷", league: "Türkiye Ligi", price: 100000, rent: 13000, color: "#c62828", group: 0 },
  { name: "Samsun", flag: "🇹🇷", league: "Türkiye Ligi", price: 70000, rent: 9000, color: "#c62828", group: 0 },
  { name: "Trabzon", flag: "🇹🇷", league: "Türkiye Ligi", price: 80000, rent: 10000, color: "#c62828", group: 0 },
  // Portekiz 🇵🇹 (Group 1)
  { name: "Lizbon", flag: "🇵🇹", league: "Portekiz Ligi", price: 130000, rent: 16000, color: "#03a9f4", group: 1 },
  { name: "Porto", flag: "🇵🇹", league: "Portekiz Ligi", price: 120000, rent: 15000, color: "#03a9f4", group: 1 },
  { name: "Braga", flag: "🇵🇹", league: "Portekiz Ligi", price: 110000, rent: 14000, color: "#03a9f4", group: 1 },
  // İtalya 🇮🇹 (Group 2)
  { name: "Roma", flag: "🇮🇹", league: "İtalya Ligi", price: 140000, rent: 18000, color: "#388e3c", group: 2 },
  { name: "Milano", flag: "🇮🇹", league: "İtalya Ligi", price: 160000, rent: 20000, color: "#388e3c", group: 2 },
  { name: "Torino", flag: "🇮🇹", league: "İtalya Ligi", price: 170000, rent: 21000, color: "#388e3c", group: 2 },
  // Hollanda 🇳🇱 (Group 3)
  { name: "Rotterdam", flag: "🇳🇱", league: "Hollanda Ligi", price: 190000, rent: 24000, color: "#795548", group: 3 },
  { name: "Amsterdam", flag: "🇳🇱", league: "Hollanda Ligi", price: 210000, rent: 26000, color: "#795548", group: 3 },
  { name: "Eindhoven", flag: "🇳🇱", league: "Hollanda Ligi", price: 220000, rent: 28000, color: "#795548", group: 3 },
  // Fransa 🇫🇷 (Group 4)
  { name: "Marsilya", flag: "🇫🇷", league: "Fransa Ligi", price: 240000, rent: 30000, color: "#ffd600", group: 4 },
  { name: "Lyon", flag: "🇫🇷", league: "Fransa Ligi", price: 250000, rent: 32000, color: "#ffd600", group: 4 },
  { name: "Paris", flag: "🇫🇷", league: "Fransa Ligi", price: 270000, rent: 34000, color: "#ffd600", group: 4 },
  // Almanya 🇩🇪 (Group 5)
  { name: "Leipzig", flag: "🇩🇪", league: "Almanya Ligi", price: 260000, rent: 33000, color: "#1565c0", group: 5 },
  { name: "Dortmund", flag: "🇩🇪", league: "Almanya Ligi", price: 280000, rent: 35000, color: "#1565c0", group: 5 },
  { name: "Münih", flag: "🇩🇪", league: "Almanya Ligi", price: 300000, rent: 38000, color: "#1565c0", group: 5 },
  // İspanya 🇪🇸 (Group 6)
  { name: "Sevilla", flag: "🇪🇸", league: "İspanya Ligi", price: 320000, rent: 40000, color: "#f57c00", group: 6 },
  { name: "Barselona", flag: "🇪🇸", league: "İspanya Ligi", price: 380000, rent: 48000, color: "#f57c00", group: 6 },
  { name: "Madrid", flag: "🇪🇸", league: "İspanya Ligi", price: 400000, rent: 50000, color: "#f57c00", group: 6 },
  // İngiltere 🏴󠁧󠁢󠁥󠁮󠁧󠁿 (Group 7)
  { name: "Londra", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", league: "İngiltere Ligi", price: 420000, rent: 52000, color: "#7b1fa2", group: 7 },
  { name: "Liverpool", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", league: "İngiltere Ligi", price: 430000, rent: 54000, color: "#7b1fa2", group: 7 },
  { name: "Manchester", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", league: "İngiltere Ligi", price: 450000, rent: 56000, color: "#7b1fa2", group: 7 },
];

export const SPECIAL_CELLS = [
  { type: "tax", name: "Vergi", icon: "💸", action: "Vergi öde! -₺50K" },
  { type: "bonus", name: "Gol Bonusu", icon: "⚽", action: "+₺40K bonus!" },
  { type: "loot", name: "Kutu Aç", icon: "📦", action: "Sürpriz kutu!" },
  { type: "penalty", name: "Penaltı", icon: "🎯", action: "Penaltı golü! +₺60K" },
  { type: "jail", name: "Kayıp Ada", icon: "🌴", action: "Sıra kaybı!" },
  { type: "transfer", name: "Dünya Turu", icon: "✈️", action: "Rastgele taşın!" },
  { type: "wc", name: "Şampiyona", icon: "🏆", action: "En büyük ödül!" },
  { type: "foul", name: "Faul", icon: "🦵", action: "-₺30K ceza" },
];

// Başlangıç oyuncu verileri
export const DEFAULT_PLAYERS = [
  { name: "Messi", avatar: "🐐", avatarImg: "assets/messi.png", color: "#29b6f6", money: 1000000, pos: 0, ownedProps: [], stadiums: {}, theme: "blue-theme" },
  { name: "Ronaldo", avatar: "🦁", avatarImg: "assets/ronaldo.png", color: "#f57c00", money: 1000000, pos: 0, ownedProps: [], stadiums: {}, theme: "pink-theme" },
  { name: "Mbappé", avatar: "⚡", avatarImg: "assets/mbappe.png", color: "#ab47bc", money: 1000000, pos: 0, ownedProps: [], stadiums: {}, theme: "blue-theme" },
  { name: "Haaland", avatar: "🔨", avatarImg: "assets/haaland.png", color: "#66bb6a", money: 1000000, pos: 0, ownedProps: [], stadiums: {}, theme: "pink-theme" },
];
