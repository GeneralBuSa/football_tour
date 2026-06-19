// ==========================================
// GAME SERVICE — Backend Servis Katmanı
// Tauri (masaüstü) ve Web (tarayıcı) ortamları
// arasında soyutlama sağlayan merkezi servis.
// ==========================================

const invoke = typeof window !== 'undefined' && window.__TAURI__ ? window.__TAURI__.invoke : null;
const isTauri = !!invoke;
import apiService from './ApiService.js';

// ==========================================
// EVENT BUS — Servisler arası olay iletişimi
// ==========================================
class EventBus {
  constructor() {
    this._listeners = {};
  }

  // Olaya abone ol
  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
  }

  // Aboneliği kaldır
  off(event, callback) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
  }

  // Olay yayınla
  emit(event, data) {
    if (!this._listeners[event]) return;
    this._listeners[event].forEach(cb => {
      try {
        cb(data);
      } catch (e) {
        console.warn(`[EventBus] '${event}' olayında hata:`, e);
      }
    });
  }
}

// ==========================================
// STORAGE SERVICE — Kayıt/Yükleme Servisi
// ==========================================
class StorageService {
  constructor(eventBus) {
    this._eventBus = eventBus;
    this._prefix = 'football_tour_';
  }

  // Veriyi kaydet
  async save(key, data) {
    const dataStr = JSON.stringify(data);
    const fullKey = this._prefix + key;

    if (isTauri) {
      try {
        await invoke('save_game_file', { data: dataStr });
        this._eventBus.emit('storage:saved', { key, success: true });
        return { success: true, message: 'Oyun yerel dosyaya kaydedildi!' };
      } catch (e) {
        this._eventBus.emit('storage:error', { key, error: e });
        return { success: false, message: 'Kayıt hatası: ' + e };
      }
    } else {
      try {
        localStorage.setItem(fullKey, dataStr);
        this._eventBus.emit('storage:saved', { key, success: true });
        return { success: true, message: 'Oyun tarayıcı belleğine kaydedildi!' };
      } catch (e) {
        this._eventBus.emit('storage:error', { key, error: e });
        return { success: false, message: 'Kayıt hatası: ' + e };
      }
    }
  }

  // Veriyi yükle
  async load(key) {
    const fullKey = this._prefix + key;

    if (isTauri) {
      try {
        const dataStr = await invoke('load_game_file');
        this._eventBus.emit('storage:loaded', { key, success: true });
        return { success: true, data: JSON.parse(dataStr) };
      } catch (e) {
        this._eventBus.emit('storage:error', { key, error: e });
        return { success: false, data: null, message: 'Kayıt dosyası bulunamadı!' };
      }
    } else {
      const dataStr = localStorage.getItem(fullKey);
      if (dataStr) {
        this._eventBus.emit('storage:loaded', { key, success: true });
        return { success: true, data: JSON.parse(dataStr) };
      }
      return { success: false, data: null, message: 'Kayıt bulunamadı!' };
    }
  }

  // Veriyi sil
  async remove(key) {
    const fullKey = this._prefix + key;
    if (!isTauri) {
      localStorage.removeItem(fullKey);
    }
    this._eventBus.emit('storage:removed', { key });
  }

  // Verinin var olup olmadığını kontrol et
  async exists(key) {
    const fullKey = this._prefix + key;
    if (!isTauri) {
      return localStorage.getItem(fullKey) !== null;
    }
    // Tauri tarafında yüklemeyi deneyerek kontrol et
    try {
      await invoke('load_game_file');
      return true;
    } catch {
      return false;
    }
  }
}

// ==========================================
// PLAYER SERVICE — Oyuncu İstatistik Servisi
// ==========================================
class PlayerService {
  constructor(eventBus, storageService) {
    this._eventBus = eventBus;
    this._storage = storageService;
    this._statsKey = 'player_stats';
    this._stats = {};
    this._loaded = false;
  }

  // İstatistikleri yükle
  async init() {
    const result = await this._storage.load(this._statsKey);
    if (result.success && result.data) {
      this._stats = result.data;
    } else {
      this._stats = {};
    }
    this._loaded = true;
    this._eventBus.emit('player:stats_loaded', this._stats);
  }

  // Oyuncu istatistiğini getir
  getStats(playerName) {
    if (!this._stats[playerName]) {
      this._stats[playerName] = {
        totalEarnings: 0,
        totalProperties: 0,
        gamesPlayed: 0,
        highestMoney: 0,
        wins: 0,
        totalTurns: 0,
        xp: 0
      };
    }
    return { ...this._stats[playerName] };
  }

  // Oyuncu istatistiğini güncelle
  updateStats(playerName, updates) {
    if (!this._stats[playerName]) {
      this.getStats(playerName);
    }
    Object.assign(this._stats[playerName], updates);
    this._eventBus.emit('player:stats_updated', { playerName, stats: this._stats[playerName] });
  }

  // Oyun sonu istatistik kaydı
  recordGameEnd(players, turnCount) {
    players.forEach(p => {
      const current = this.getStats(p.name);
      this.updateStats(p.name, {
        totalEarnings: current.totalEarnings + p.money,
        totalProperties: current.totalProperties + p.ownedProps.length,
        gamesPlayed: current.gamesPlayed + 1,
        highestMoney: Math.max(current.highestMoney, p.money),
        totalTurns: current.totalTurns + turnCount
      });
    });

    // En zengin oyuncuya galibiyet ver
    const winner = [...players].sort((a, b) => b.money - a.money)[0];
    if (winner) {
      const ws = this.getStats(winner.name);
      this.updateStats(winner.name, { wins: ws.wins + 1 });
    }

    this._saveStats();

    // Supabase API entegrasyonu
    if (apiService.isLoggedIn()) {
      const currentUser = apiService.getUser();
      apiService.saveGameResult(players).catch(console.error);
      
      const userPlayer = players.find(p => p.name === currentUser.username) || players[0];
      if (userPlayer) {
        const userStats = this.getStats(userPlayer.name);
        const isUserWinner = winner && winner.name === userPlayer.name;
        const xpEarned = 500 + (isUserWinner ? 500 : 0);
        const newXp = (userStats.xp || 0) + xpEarned;

        // Yerelde de güncelle
        this.updateStats(userPlayer.name, { xp: newXp });
        this._saveStats();

        apiService.updateStats(currentUser.id, {
          total_earnings: userStats.totalEarnings,
          total_properties: userStats.totalProperties,
          games_played: userStats.gamesPlayed,
          highest_money: userStats.highestMoney,
          wins: userStats.wins,
          total_turns: userStats.totalTurns,
          xp: newXp
        }).catch(console.error);
      }
    }
  }

  // İstatistikleri kaydet
  async _saveStats() {
    await this._storage.save(this._statsKey, this._stats);
  }
}

// ==========================================
// LEADERBOARD SERVICE — Skor Tablosu Servisi
// ==========================================
class LeaderboardService {
  constructor(eventBus, storageService) {
    this._eventBus = eventBus;
    this._storage = storageService;
    this._leaderboardKey = 'leaderboard';
    this._maxEntries = 10;
    this._entries = [];
  }

  // Skor tablosunu yükle
  async init() {
    if (apiService.isLoggedIn()) {
      try {
        const serverEntries = await apiService.getLeaderboard();
        if (Array.isArray(serverEntries)) {
          this._entries = serverEntries;
          this._eventBus.emit('leaderboard:loaded', this._entries);
          return;
        }
      } catch (e) {
        console.warn("[LeaderboardService] Supabase liderlik tablosu yüklenemedi, yerel verilere dönülüyor:", e);
      }
    }

    const result = await this._storage.load(this._leaderboardKey);
    if (result.success && result.data) {
      this._entries = result.data;
    } else {
      this._entries = [];
    }
    this._eventBus.emit('leaderboard:loaded', this._entries);
  }

  // Yeni skor ekle
  async addScore(playerName, score, properties, turns) {
    const entry = {
      playerName,
      score,
      properties,
      turns,
      date: new Date().toISOString()
    };

    this._entries.push(entry);
    // Skora göre azalan sırada sırala
    this._entries.sort((a, b) => b.score - a.score);
    // Maksimum kayıt sayısına sınırla
    if (this._entries.length > this._maxEntries) {
      this._entries = this._entries.slice(0, this._maxEntries);
    }

    await this._storage.save(this._leaderboardKey, this._entries);
    this._eventBus.emit('leaderboard:updated', this._entries);
    return this._entries;
  }

  // Skor tablosunu getir
  getEntries() {
    return [...this._entries];
  }

  // Sıralama bul
  getRank(score) {
    const rank = this._entries.findIndex(e => score >= e.score);
    return rank === -1 ? this._entries.length + 1 : rank + 1;
  }
}

// ==========================================
// ACHIEVEMENT SERVICE — Başarım Servisi
// ==========================================
class AchievementService {
  constructor(eventBus, storageService) {
    this._eventBus = eventBus;
    this._storage = storageService;
    this._achievementKey = 'achievements';
    this._unlocked = {};
    this._steamName = null;

    // Başarım tanımları
    this.DEFINITIONS = {
      PROPERTIES_5: { name: '5 Şehir Fatihi', desc: '5 farklı şehir satın al', icon: '🏙️' },
      MAX_STADIUM: { name: 'Mega Stadyum', desc: 'Bir stadyumu Seviye 3\'e yükselt', icon: '🏟️' },
      WIN_WORLD_CUP: { name: 'Dünya Şampiyonu', desc: 'Şampiyona alanına gel', icon: '🏆' },
      GOLD_LOOT: { name: 'Altın Kutu', desc: 'Sürpriz kutudan en büyük ödülü kazan', icon: '💰' },
      BANKRUPT: { name: 'İflas', desc: 'Paran tamamen tükensin', icon: '💸' },
      FIRST_WIN: { name: 'İlk Zafer', desc: 'İlk oyununu kazan', icon: '🥇' },
      RICH_PLAYER: { name: 'Zengin Kulüp', desc: '₺50.000 biriktir', icon: '💎' },
      FULL_GROUP: { name: 'Liga Hakimi', desc: 'Bir liganın tüm şehirlerini satın al', icon: '⚽' }
    };
  }

  // Servisi başlat ve Steam durumunu kontrol et
  async init() {
    // Yerel başarımları yükle
    const result = await this._storage.load(this._achievementKey);
    if (result.success && result.data) {
      this._unlocked = result.data;
    }

    // Supabase başarımlarını çek
    if (apiService.isLoggedIn()) {
      try {
        const user = apiService.getUser();
        const apiAchievements = await apiService.getAchievements(user.id);
        if (Array.isArray(apiAchievements)) {
          apiAchievements.forEach(ach => {
            this._unlocked[ach.achievement_id] = {
              unlockedAt: ach.unlocked_at
            };
          });
          await this._storage.save(this._achievementKey, this._unlocked);
        }
      } catch (e) {
        console.warn(`[AchievementService] Supabase başarım yükleme hatası: ${e}`);
      }
    }

    // Steam bağlantısını kontrol et
    if (isTauri) {
      try {
        this._steamName = await invoke('get_steam_name');
        this._eventBus.emit('steam:connected', { name: this._steamName });
      } catch (e) {
        this._eventBus.emit('steam:disconnected');
      }
    }

    this._eventBus.emit('achievement:loaded', this._unlocked);
  }

  // Steam oyuncu adını döndür
  getSteamName() {
    return this._steamName;
  }

  // Steam bağlı mı?
  isSteamConnected() {
    return this._steamName !== null;
  }

  // Başarım kilidini aç
  async unlock(achievementId) {
    if (this._unlocked[achievementId]) return; // Zaten açık

    this._unlocked[achievementId] = {
      unlockedAt: new Date().toISOString()
    };

    // Steam varsa Steam'de de aç
    if (isTauri) {
      try {
        await invoke('unlock_achievement', { name: achievementId });
      } catch (e) {
        console.warn(`[AchievementService] Steam başarım hatası: ${e}`);
      }
    }

    // Supabase API entegrasyonu
    if (apiService.isLoggedIn()) {
      apiService.unlockAchievement(achievementId).catch(console.error);
    }

    // Yerel kaydet
    await this._storage.save(this._achievementKey, this._unlocked);
    this._eventBus.emit('achievement:unlocked', {
      id: achievementId,
      def: this.DEFINITIONS[achievementId]
    });
  }

  // Başarım açık mı?
  isUnlocked(achievementId) {
    return !!this._unlocked[achievementId];
  }

  // Tüm başarımları getir (açık/kapalı durumlarıyla)
  getAll() {
    return Object.entries(this.DEFINITIONS).map(([id, def]) => ({
      id,
      ...def,
      unlocked: !!this._unlocked[id],
      unlockedAt: this._unlocked[id]?.unlockedAt || null
    }));
  }
}

// ==========================================
// GAME SERVICE — Ana Servis Merkezi
// ==========================================
class GameService {
  constructor() {
    this.eventBus = new EventBus();
    this.storage = new StorageService(this.eventBus);
    this.player = new PlayerService(this.eventBus, this.storage);
    this.leaderboard = new LeaderboardService(this.eventBus, this.storage);
    this.achievement = new AchievementService(this.eventBus, this.storage);
    this._initialized = false;
  }

  // Tüm servisleri başlat
  async init() {
    if (this._initialized) return;
    await this.player.init();
    await this.leaderboard.init();
    await this.achievement.init();
    this._initialized = true;
    this.eventBus.emit('game:services_ready');
  }

  // Oyunu kaydet (buluta / yerel yedekli)
  async saveGame(gameState) {
    if (apiService.isLoggedIn()) {
      try {
        const res = await apiService.saveGame(gameState);
        if (res && !res.error) {
          await this.storage.save('save', gameState);
          return { success: true, message: 'Oyun buluta başarıyla kaydedildi! ☁️' };
        }
      } catch (e) {
        console.warn("[GameService] Bulut kayıt hatası, yerel depolamaya geçiliyor:", e);
      }
    }
    return await this.storage.save('save', gameState);
  }

  // Oyunu yükle (buluttan / yerel yedekli)
  async loadGame() {
    if (apiService.isLoggedIn()) {
      try {
        const res = await apiService.loadGame();
        if (res && res.save_data) {
          return { success: true, data: res.save_data };
        }
      } catch (e) {
        console.warn("[GameService] Buluttan yükleme hatası, yerel depolamaya geçiliyor:", e);
      }
    }
    return await this.storage.load('save');
  }

  // Tam ekran geçişi
  async toggleFullscreen() {
    if (isTauri) {
      try {
        await invoke('toggle_fullscreen');
      } catch (e) {
        return { success: false, message: 'Ekran modu değiştirilemedi!' };
      }
    } else {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen().catch(() => {});
      } else {
        await document.exitFullscreen();
      }
    }
    return { success: true };
  }

  // Uygulamayı kapat
  async closeApp() {
    if (isTauri) {
      try {
        await invoke('close_app');
      } catch (e) {
        window.close();
      }
    }
  }

  // Ortam bilgisini döndür
  getEnvironment() {
    return {
      isTauri,
      isSteamConnected: this.achievement.isSteamConnected(),
      steamName: this.achievement.getSteamName()
    };
  }
}

// Singleton olarak dışarıya ver
const gameService = new GameService();
export default gameService;
