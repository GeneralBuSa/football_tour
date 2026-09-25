// ==========================================
// API SERVICE — Backend HTTP İstemcisi
// Tüm backend REST API çağrılarını merkezi olarak yönetir
// ==========================================

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api';
const REQUEST_TIMEOUT_MS = 15000;

// Kullanıcıya gösterilecek, ne olduğunu ve ne yapılabileceğini anlatan hata metinleri.
// Sunucu kendi anlaşılır mesajını döndürdüyse o tercih edilir; 5xx iç detayları gösterilmez.
function describeHttpError(status, serverMessage) {
  if (status >= 500) return 'Sunucuda geçici bir sorun oluştu. Birkaç saniye sonra tekrar dene.';
  if (serverMessage) return serverMessage;
  if (status === 401) return 'Oturumunun süresi doldu. Lütfen tekrar giriş yap.';
  if (status === 403) return 'Bu işlem için yetkin yok.';
  if (status === 404) return 'İstenen kayıt bulunamadı.';
  if (status === 429) return 'Çok fazla istek gönderildi. Lütfen biraz bekleyip tekrar dene.';
  return `İstek tamamlanamadı (${status}). Lütfen tekrar dene.`;
}

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
      try {
        this._user = JSON.parse(localStorage.getItem('ft26_user') || 'null');
      } catch {
        this._user = null;
      }
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

  // Ortak HTTP isteği. Hata durumunda her zaman { error, status } nesnesi döner.
  async _request(method, endpoint, data) {
    let res;
    // Yavaş/kopuk bağlantıda isteğin sonsuza kadar asılı kalmasını önler.
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;
    try {
      res = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers: this._headers(data !== undefined),
        body: data === undefined ? undefined : JSON.stringify(data),
        signal: controller?.signal
      });
    } catch (err) {
      console.warn(`[ApiService] ${method} ${endpoint} hatası:`, err);
      const timedOut = err?.name === 'AbortError';
      return {
        error: timedOut
          ? 'Sunucu zamanında yanıt vermedi. Bağlantını kontrol edip tekrar dene.'
          : 'Sunucuya bağlanılamadı. İnternet bağlantını kontrol edip tekrar dene.',
        status: 0,
        network: true
      };
    } finally {
      if (timeout) clearTimeout(timeout);
    }

    let resData = null;
    try {
      resData = await res.json();
    } catch {
      resData = null;
    }

    // Yalnızca 401 oturumu sonlandırır. Eskiden hata metninde "token" geçen her
    // yanıt (ör. geçersiz şifre sıfırlama token'ı) kullanıcıyı çıkış yaptırıyordu.
    if (res.status === 401 && this.token) {
      this.clearToken();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ft26:session-expired'));
      }
    }

    if (!res.ok) {
      const serverMessage = resData && typeof resData === 'object' && typeof resData.error === 'string' ? resData.error : '';
      const error = describeHttpError(res.status, serverMessage);
      return { ...(resData && typeof resData === 'object' && !Array.isArray(resData) ? resData : {}), error, status: res.status };
    }
    return resData;
  }

  async _get(endpoint) {
    return this._request('GET', endpoint);
  }

  async _post(endpoint, data) {
    return this._request('POST', endpoint, data ?? {});
  }

  async _put(endpoint, data) {
    return this._request('PUT', endpoint, data ?? {});
  }

  async _delete(endpoint) {
    return this._request('DELETE', endpoint);
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

  // Hesabı kalıcı olarak sil (şifre ile yeniden doğrulama gerekir)
  async deleteAccount(password) {
    return await this._request('DELETE', '/auth/account', { password });
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

  async redeemPromoCode(code) {
    if (!this.getUser()) return { error: 'Promosyon kodu kullanmak için giriş yapın.' };
    return await this._post('/promo/redeem', { code });
  }

  // Oyunda kullanılacak karakteri (3D model) seçer; null varsayılana döndürür.
  async selectCharacter(characterKey) {
    if (!this.getUser()) return { error: 'Giriş yapılmadı' };
    const res = await this._put('/store/characters/selected', { character_key: characterKey });
    if (res && !res.error) {
      const user = this.getUser();
      if (user) this.setUser({ ...user, selected_character: res.selected_character });
    }
    return res;
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

  async rejectFriendRequest(friendId) {
    if (!this.getUser()) return { error: 'Giriş yapılmadı' };
    return await this._post('/friends/reject', { friend_id: friendId });
  }

  // Arkadaşı çıkarır veya gönderilmiş isteği geri çeker
  async removeFriend(friendId) {
    if (!this.getUser()) return { error: 'Giriş yapılmadı' };
    return await this._delete(`/friends/${encodeURIComponent(friendId)}`);
  }

  // ==========================================
  // MESAJLAŞMA API
  // ==========================================

  async getConversation(friendId, limit = 50) {
    if (!this.getUser()) return { error: 'Giriş yapılmadı' };
    return await this._get(`/messages/${encodeURIComponent(friendId)}?limit=${limit}`);
  }

  async sendMessage(friendId, body) {
    if (!this.getUser()) return { error: 'Giriş yapılmadı' };
    return await this._post('/messages', { friend_id: friendId, body });
  }

  async sendGameInvite(friendId) {
    if (!this.getUser()) return { error: 'Giriş yapılmadı' };
    return await this._post('/messages/invite', { friend_id: friendId });
  }

  async getUnreadCounts() {
    if (!this.getUser()) return { error: 'Giriş yapılmadı' };
    return await this._get('/messages/unread');
  }

  getMessageStreamUrl() {
    const token = this.token;
    return token ? `${API_BASE}/messages/stream?token=${encodeURIComponent(token)}` : null;
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
export { ApiService, API_BASE, describeHttpError };
export default apiService;

