// ==========================================
// API SERVICE — Backend HTTP İstemcisi
// Tüm backend REST API çağrılarını merkezi olarak yönetir
// ==========================================

const API_BASE = 'http://localhost:3000/api';

class ApiService {
  constructor() {
    if (typeof window !== 'undefined') {
      this._token = localStorage.getItem('ft26_auth_token') || null;
      this._user = JSON.parse(localStorage.getItem('ft26_user') || 'null');
    } else {
      this._token = null;
      this._user = null;
    }
  }

  // ==========================================
  // TOKEN YÖNETİMİ
  // ==========================================

  // JWT token'ı kaydet
  setToken(token) {
    this._token = token;
    localStorage.setItem('ft26_auth_token', token);
  }

  // JWT token'ı sil
  clearToken() {
    this._token = null;
    this._user = null;
    localStorage.removeItem('ft26_auth_token');
    localStorage.removeItem('ft26_user');
  }

  // Kullanıcı bilgisini kaydet
  setUser(user) {
    this._user = user;
    localStorage.setItem('ft26_user', JSON.stringify(user));
  }

  // Mevcut kullanıcıyı döndür
  getUser() {
    return this._user;
  }

  // Giriş yapılmış mı?
  isLoggedIn() {
    return !!this._token;
  }

  // ==========================================
  // HTTP YARDIMCI FONKSİYONLARI
  // ==========================================

  // Yetkilendirilmiş istek header'ları
  _headers(isJson = true) {
    const headers = {};
    if (isJson) headers['Content-Type'] = 'application/json';
    if (this._token) headers['Authorization'] = `Bearer ${this._token}`;
    return headers;
  }

  // GET isteği
  async _get(endpoint) {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'GET',
        headers: this._headers()
      });
      return await res.json();
    } catch (err) {
      console.warn(`[ApiService] GET ${endpoint} hatası:`, err);
      return { error: 'Bağlantı hatası. Sunucu çalışıyor mu?' };
    }
  }

  // POST isteği
  async _post(endpoint, data) {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify(data)
      });
      return await res.json();
    } catch (err) {
      console.warn(`[ApiService] POST ${endpoint} hatası:`, err);
      return { error: 'Bağlantı hatası. Sunucu çalışıyor mu?' };
    }
  }

  // PUT isteği
  async _put(endpoint, data) {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'PUT',
        headers: this._headers(),
        body: JSON.stringify(data)
      });
      return await res.json();
    } catch (err) {
      console.warn(`[ApiService] PUT ${endpoint} hatası:`, err);
      return { error: 'Bağlantı hatası. Sunucu çalışıyor mu?' };
    }
  }

  // ==========================================
  // AUTH API
  // ==========================================

  // Kayıt ol
  async register(username, email, password) {
    const result = await this._post('/auth/register', { username, email, password });
    if (result.token) {
      this.setToken(result.token);
      this.setUser(result.user);
    }
    return result;
  }

  // Giriş yap
  async login(username, password) {
    const result = await this._post('/auth/login', { username, password });
    if (result.token) {
      this.setToken(result.token);
      this.setUser(result.user);
    }
    return result;
  }

  // Mevcut kullanıcı bilgisi
  async getMe() {
    return await this._get('/auth/me');
  }

  // Çıkış yap
  logout() {
    this.clearToken();
  }

  // ==========================================
  // STATS API
  // ==========================================

  async getStats(userId) {
    return await this._get(`/stats/${userId}`);
  }

  async updateStats(userId, stats) {
    return await this._put(`/stats/${userId}`, stats);
  }

  // ==========================================
  // ACHIEVEMENTS API
  // ==========================================

  async getAchievements(userId) {
    return await this._get(`/achievements/${userId}`);
  }

  async unlockAchievement(achievementId) {
    const user = this.getUser();
    if (!user) return { error: 'Giriş yapılmadı' };
    return await this._post(`/achievements/${user.id}`, { achievement_id: achievementId });
  }

  // ==========================================
  // GAMES API
  // ==========================================

  async getGameHistory(userId) {
    return await this._get(`/games/${userId}`);
  }

  async getLeaderboard() {
    return await this._get('/stats');
  }

  async saveGameResult(players) {
    const user = this.getUser();
    if (!user) return { error: 'Giriş yapılmadı' };
    return await this._post('/games', { user_id: user.id, result_data: { players } });
  }

  // ==========================================
  // STORE API
  // ==========================================

  async getStoreItems() {
    return await this._get('/store/items');
  }

  async purchaseItem(itemId) {
    const user = this.getUser();
    if (!user) return { error: 'Giriş yapılmadı' };
    return await this._post('/store/purchase', { user_id: user.id, item_id: itemId });
  }

  async getMyPurchases() {
    const user = this.getUser();
    if (!user) return { error: 'Giriş yapılmadı' };
    return await this._get(`/store/purchases/${user.id}`);
  }

  // ==========================================
  // SAĞLIK KONTROLÜ
  // ==========================================

  async healthCheck() {
    return await this._get('/health');
  }

  // ==========================================
  // LOBBY API
  // ==========================================

  async joinLobby() {
    const user = this.getUser();
    if (!user) return { error: 'Giriş yapılmadı' };
    return await this._post('/lobby/join', { user_id: user.id });
  }

  async leaveLobby() {
    const user = this.getUser();
    if (!user) return { error: 'Giriş yapılmadı' };
    return await this._post('/lobby/leave', { user_id: user.id });
  }

  async getLobbyStatus() {
    const user = this.getUser();
    if (!user) return { error: 'Giriş yapılmadı' };
    return await this._get(`/lobby/status/${user.id}`);
  }

  // ==========================================
  // FRIENDS API
  // ==========================================

  async getFriends() {
    const user = this.getUser();
    if (!user) return [];
    return await this._get(`/friends/${user.id}`);
  }

  async addFriend(friendUsername) {
    const user = this.getUser();
    if (!user) return { error: 'Giriş yapılmadı' };
    return await this._post('/friends/add', { user_id: user.id, friend_username: friendUsername });
  }

  async acceptFriendRequest(friendId) {
    const user = this.getUser();
    if (!user) return { error: 'Giriş yapılmadı' };
    return await this._post('/friends/accept', { user_id: user.id, friend_id: friendId });
  }

  // ==========================================
  // CLOUD SAVE API
  // ==========================================

  async saveGame(saveData) {
    const user = this.getUser();
    if (!user) return { error: 'Giriş yapılmadı' };
    return await this._post('/saves', { user_id: user.id, save_data: saveData });
  }

  async loadGame() {
    const user = this.getUser();
    if (!user) return { error: 'Giriş yapılmadı' };
    return await this._get(`/saves/${user.id}`);
  }
}

// Singleton olarak dışarıya ver
const apiService = new ApiService();
export default apiService;
