import apiService from './ApiService.js';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api';

class MultiplayerService {
  constructor() {
    this._sessionId = null;
    this._events = null;
    this._applyingRemoteState = false;
    this._onState = null;
    this._version = null;
    this._localPlayerIndex = null;
    this._reconnectAttempts = 0;
    this._reconnectTimeout = null;
  }

  get sessionId() {
    return this._sessionId;
  }

  isApplyingRemoteState() {
    return this._applyingRemoteState;
  }

  setApplyingRemoteState(value) {
    this._applyingRemoteState = value;
  }

  async start(sessionId, onState, localPlayerIndex) {
    this.stop();
    this._sessionId = sessionId;
    this._onState = onState;
    this._localPlayerIndex = Number.isInteger(localPlayerIndex) ? localPlayerIndex : null;
    this._reconnectAttempts = 0;

    await this._connect();
  }

  canControlTurn(currentPlayerIndex) {
    return !this._sessionId || this._localPlayerIndex === currentPlayerIndex;
  }

  async _connect() {
    const sessionId = this._sessionId;
    const token = apiService.token;
    if (!sessionId || !token || typeof window === 'undefined') return;

    // 1. Yeniden bağlanırken son durumu çek ve eşle
    try {
      const session = await apiService.getMultiplayerSession(sessionId);
      if (session && session.state_data && Object.keys(session.state_data).length > 0) {
        this._version = session.updated_at;
        if (typeof this._onState === 'function') {
          this._onState(session.state_data);
        }
      }
    } catch (e) {
      console.warn('[MultiplayerService] son durum çekilemedi', e);
    }

    // 2. EventSource bağlantısını aç
    const url = `${API_BASE}/multiplayer/sessions/${sessionId}/events?token=${encodeURIComponent(token)}`;
    if (this._events) this._events.close();

    this._events = new EventSource(url);

    this._events.onmessage = event => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'state_update' && payload.state_data && typeof this._onState === 'function') {
          this._version = payload.version; // En güncel sürümü sakla
          this._onState(payload.state_data);
        }
      } catch (e) {
        console.warn('[MultiplayerService] event parse hatası', e);
      }
    };

    this._events.onopen = () => {
      this._reconnectAttempts = 0; // Başarılı bağlantıda denemeleri sıfırla
    };

    this._events.onerror = () => {
      console.warn('[MultiplayerService] bağlantı koptu, yeniden bağlanılıyor...');
      this._events.close();
      this._events = null;

      // Exponential backoff reconnect (Max 16sn)
      const backoff = Math.min(1000 * Math.pow(2, this._reconnectAttempts), 16000);
      this._reconnectAttempts++;

      if (this._reconnectTimeout) clearTimeout(this._reconnectTimeout);
      this._reconnectTimeout = setTimeout(() => {
        if (this._sessionId) {
          this._connect();
        }
      }, backoff);
    };
  }

  stop() {
    if (this._events) this._events.close();
    this._events = null;
    if (this._reconnectTimeout) clearTimeout(this._reconnectTimeout);
    this._reconnectTimeout = null;
    this._sessionId = null;
    this._onState = null;
    this._version = null;
    this._localPlayerIndex = null;
    this._reconnectAttempts = 0;
    this._applyingRemoteState = false;
  }

  async syncState(stateData, eventType = 'state_update') {
    if (!this._sessionId || this._applyingRemoteState) return { skipped: true };
    const res = await apiService.updateMultiplayerState(this._sessionId, stateData, eventType, this._version);
    if (res && res.updated_at) {
      this._version = res.updated_at; // Kendi yaptığımız güncellemeden dönen sürümü al
    }
    return res;
  }
}

const multiplayerService = new MultiplayerService();
export default multiplayerService;
