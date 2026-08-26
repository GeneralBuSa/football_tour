// ==========================================
// API SERVICE — Backend HTTP İstemcisi
// Tüm backend REST API çağrılarını merkezi olarak yönetir
// ==========================================

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api';

class ApiService {
  constructor() {
    this._token = null;
    this._user = null;
  }

  // Dinamik Token Getter
  get token() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('ft26_auth_token');
      if (stored) return stored;
    }
    return this._token;
  }

  // Dinamik User Getter
  get user() {
    if (!this._user && typeof window !== 'undefined') {
      this._user = JSON.parse(localStorage.getItem('ft26_user') || 'null');
    }
    return this._user;
  }

  // ==========================================
  // TOKEN YÖNETİMİ
  // ==========================================

  // JWT token'ı kaydet
  setToken(token) {
    this._token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('ft26_auth_token', token);
    }
  }

  // JWT token'ı sil
  clearToken() {
    this._token = null;
    this._user = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ft26_auth_token');
      localStorage.removeItem('ft26_user');
    }
  }

  // Kullanıcı bilgisini kaydet
  setUser(user) {
    this._user = user;
    if (typeof window !== 'undefined') {
      localStorage.setItem('ft26_user', JSON.stringify(user));
    }
  }

  // Mevcut kullanıcıyı döndür
  getUser() {
    return this.user;
  }

  // Giriş yapılmış mı?
  isLoggedIn() {
    return !!this.token;
  }

  // ==========================================
  // HTTP YARDIMCI FONKSİYONLARI
  // ==========================================

  // Yetkilendirilmiş istek header'ları
  _headers(isJson = true) {
    const headers = {};
    if (isJson) headers['Content-Type'] = 'application/json';
    const token = this.token;
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  // GET isteği
  async _get(endpoint) {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'GET',
        headers: this._headers()
      });
      const data = await res.json();
      if (res.status === 401 || (data && data.error && data.error.includes('token'))) {
        this.clearToken();
      }
      return data;
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
      const resData = await res.json();
      if (res.status === 401 || (resData && resData.error && resData.error.includes('token'))) {
        this.clearToken();
      }
      return resData;
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
      const resData = await res.json();
      if (res.status === 401 || (resData && resData.error && resData.error.includes('token'))) {
        this.clearToken();
      }
      return resData;
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
    const res = await this._get('/auth/me');
    if (res && !res.error) {
      this.setUser(res);
    }
    return res;
  }

  // Profil fotoğrafını güncelle
  async updateAvatar(avatar) {
    const res = await this._put('/auth/avatar', { avatar });
    if (res && !res.error) {
      const currentUser = this.getUser();
      if (currentUser) {
        currentUser.avatar = avatar;
        this.setUser(currentUser);
      }
    }
    return res;
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
    return await this._post('/games', { result_data: { players } });
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
    return await this._post('/store/purchase', { item_id: itemId });
  }

  async getMyPurchases() {
    const user = this.getUser();
    if (!user) return { error: 'Giriş yapılmadı' };
    return await this._get(`/store/purchases/${user.id}`);
  }

  async getPlayerCatalog() {
    return await this._get('/store/players');
  }

  async claimStarterCharacter(characterKey) {
    return await this._post('/store/starter/claim', { character_key: characterKey });
  }

  async getCharacterEntitlements() {
    const user = this.getUser();
    if (!user) return { error: 'Giriş yapılmadı' };
    return await this._get(`/store/entitlements/${user.id}`);
  }

  async getCoinPacks() {
    return await this._get('/payments/coin-packs');
  }

  async createCoinCheckout(packKey) {
    return await this._post('/payments/coin-packs/checkout', { pack_key: packKey });
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
    return await this._post('/lobby/join', {});
  }

  async leaveLobby() {
    const user = this.getUser();
    if (!user) return { error: 'Giriş yapılmadı' };
    return await this._post('/lobby/leave', {});
  }

  async getLobbyStatus() {
    const user = this.getUser();
    if (!user) return { error: 'Giriş yapılmadı' };
    return await this._get(`/lobby/status/${user.id}`);
  }

  async createPrivateLobby() {
    const user = this.getUser();
    if (!user) return { error: 'Giriş yapılmadı' };
    return await this._post('/lobby/create-private', {});
  }

  async joinPrivateLobby(hostUsername) {
    const user = this.getUser();
    if (!user) return { error: 'Giriş yapılmadı' };
    return await this._post('/lobby/join-private', { host_username: hostUsername });
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
    return await this._post('/friends/add', { friend_username: friendUsername });
  }

  async acceptFriendRequest(friendId) {
    const user = this.getUser();
    if (!user) return { error: 'Giriş yapılmadı' };
    return await this._post('/friends/accept', { friend_id: friendId });
  }

  // ==========================================
  // CLOUD SAVE API
  // ==========================================

  async saveGame(saveData) {
    const user = this.getUser();
    if (!user) return { error: 'Giriş yapılmadı' };
    return await this._post('/saves', { save_data: saveData });
  }

  async loadGame() {
    const user = this.getUser();
    if (!user) return { error: 'Giriş yapılmadı' };
    return await this._get(`/saves/${user.id}`);
  }

  // ==========================================
  // ŞİFRE SIFIRLAMA API
  // ==========================================

  async forgotPassword(username, email) {
    return await this._post('/auth/forgot-password', { username, email });
  }

  async resetPassword(resetToken, newPassword) {
    return await this._post('/auth/reset-password', { resetToken, newPassword });
  }

  // ==========================================
  // MULTIPLAYER API
  // ==========================================

  async getMultiplayerSession(sessionId) {
    return await this._get(`/multiplayer/sessions/${sessionId}`);
  }

  async updateMultiplayerState(sessionId, stateData, eventType = 'state_update', version = null) {
    return await this._put(`/multiplayer/sessions/${sessionId}/state`, {
      state_data: stateData,
      event_type: eventType,
      version
    });
  }

  async finishMultiplayerSession(sessionId, stateData, resultData) {
    return await this._post(`/multiplayer/sessions/${sessionId}/finish`, { state_data: stateData, result_data: resultData });
  }
}

// Singleton olarak dışarıya ver
const apiService = new ApiService();
export default apiService;

