import apiService from './ApiService.js';

const IGNORED_EVENTS = new Set(['connected', 'heartbeat', 'player_joined']);

export class MultiplayerService {
  constructor({ api = apiService } = {}) {
    this._api = api;
    this._sessionId = null;
    this._events = null;
    this._applyingRemoteState = false;
    this._onState = null;
    this._onClosed = null;
    this._version = null;
    this._localPlayerIndex = null;
    this._reconnectAttempts = 0;
    this._reconnectTimeout = null;
    this._syncChain = Promise.resolve();
  }

  get sessionId() {
    return this._sessionId;
  }

  get version() {
    return this._version;
  }

  isApplyingRemoteState() {
    return this._applyingRemoteState;
  }

  setApplyingRemoteState(value) {
    this._applyingRemoteState = value;
  }

  // Oturum bilgisi gelene kadar yerel oyuncunun hamle yapmasını engeller.
  prepare(sessionId) {
    this.stop();
    this._sessionId = sessionId;
    this._localPlayerIndex = null;
  }

  async start(sessionId, onState, localPlayerIndex, { onClosed } = {}) {
    this.stop();
    this._sessionId = sessionId;
    this._onState = onState;
    this._onClosed = typeof onClosed === 'function' ? onClosed : null;
    this._localPlayerIndex = Number.isInteger(localPlayerIndex) ? localPlayerIndex : null;
    this._reconnectAttempts = 0;

    await this._connect();
  }

  canControlTurn(currentPlayerIndex) {
    return !this._sessionId || this._localPlayerIndex === currentPlayerIndex;
  }

  _localUserId() {
    return this._api.getUser?.()?.id || null;
  }

  _applyRemoteState(stateData) {
    if (typeof this._onState !== 'function') return;
    this._applyingRemoteState = true;
    try {
      this._onState(stateData);
    } finally {
      this._applyingRemoteState = false;
    }
  }

  _rememberVersion(version) {
    // Postgres zaman damgaları aynı biçimde döner; sözlük sırası kronolojik sıradır.
    if (version && (!this._version || String(version) > String(this._version))) {
      this._version = version;
    }
  }

  // Sunucudaki son durumu çekip uygular (yeniden bağlanma ve sürüm çakışması sonrası).
  async resync() {
    if (!this._sessionId) return null;
    const session = await this._api.getMultiplayerSession(this._sessionId);
    if (!session || session.error) return null;

    if (session.status === 'cancelled' || session.status === 'finished') {
      this._notifyClosed({ reason: session.status, state_data: session.state_data, result_data: session.result_data });
      return session;
    }
    if (session.state_data && Object.keys(session.state_data).length > 0) {
      this._version = session.updated_at;
      this._applyRemoteState(session.state_data);
    }
    return session;
  }

  _notifyClosed(details) {
    const callback = this._onClosed;
    this._onClosed = null;
    if (typeof callback === 'function') callback(details);
  }

  handleEvent(payload) {
    if (!payload || IGNORED_EVENTS.has(payload.type)) return;

    if (payload.type === 'cancelled') {
      this._notifyClosed({ reason: 'cancelled' });
      return;
    }

    const fromSelf = payload.user_id && payload.user_id === this._localUserId();

    if (payload.type === 'finished') {
      if (!fromSelf) {
        this._notifyClosed({ reason: 'finished', state_data: payload.state_data, result_data: payload.result_data });
      }
      return;
    }

    if (!payload.state_data) return;
    this._rememberVersion(payload.version);
    // Kendi gönderdiğimiz hamlenin yankısını tekrar uygulamak zar butonunu yeniden açardı.
    if (fromSelf) return;
    this._applyRemoteState(payload.state_data);
  }

  async _connect() {
    const sessionId = this._sessionId;
    const token = this._api.token;
    if (!sessionId || !token || typeof EventSource === 'undefined') return;

    try {
      await this.resync();
    } catch (e) {
      console.warn('[MultiplayerService] son durum çekilemedi', e);
    }
    if (this._sessionId !== sessionId) return;

    // URL'de oturum token'ı yerine kısa ömürlü akış bileti taşınır.
    const url = await this._api.createStreamUrl(`/multiplayer/sessions/${sessionId}/events`);
    if (this._sessionId !== sessionId) return;
    if (!url) {
      this._scheduleReconnect(sessionId);
      return;
    }
    if (this._events) this._events.close();

    this._events = new EventSource(url);

    this._events.onmessage = event => {
      try {
        this.handleEvent(JSON.parse(event.data));
      } catch (e) {
        console.warn('[MultiplayerService] event parse hatası', e);
      }
    };

    this._events.onopen = () => {
      this._reconnectAttempts = 0;
    };

    this._events.onerror = () => {
      console.warn('[MultiplayerService] bağlantı koptu, yeniden bağlanılıyor...');
      if (this._events) this._events.close();
      this._events = null;
      this._scheduleReconnect(sessionId);
    };
  }

  _scheduleReconnect(sessionId) {
    const backoff = Math.min(1000 * Math.pow(2, this._reconnectAttempts), 16000);
    this._reconnectAttempts++;

    if (this._reconnectTimeout) clearTimeout(this._reconnectTimeout);
    this._reconnectTimeout = setTimeout(() => {
      if (this._sessionId === sessionId) this._connect();
    }, backoff);
  }

  stop() {
    if (this._events) this._events.close();
    this._events = null;
    if (this._reconnectTimeout) clearTimeout(this._reconnectTimeout);
    this._reconnectTimeout = null;
    this._sessionId = null;
    this._onState = null;
    this._onClosed = null;
    this._version = null;
    this._localPlayerIndex = null;
    this._reconnectAttempts = 0;
    this._applyingRemoteState = false;
    this._syncChain = Promise.resolve();
  }

  // Hamleler sırayla gönderilir; böylece her istek bir öncekinin döndürdüğü sürümü taşır.
  syncState(stateData, eventType = 'state_update') {
    if (!this._sessionId || this._applyingRemoteState) return Promise.resolve({ skipped: true });
    const sessionId = this._sessionId;
    const snapshot = JSON.parse(JSON.stringify(stateData));

    const run = async () => {
      if (this._sessionId !== sessionId) return { skipped: true };
      const res = await this._api.updateMultiplayerState(sessionId, snapshot, eventType, this._version);
      if (res && res.updated_at) {
        this._rememberVersion(res.updated_at);
      } else if (res && res.db_version) {
        // Başka bir hamle araya girdi: sunucudaki güncel durumu uygula.
        await this.resync();
      }
      return res;
    };

    const result = this._syncChain.then(run, run);
    this._syncChain = result.catch(() => {});
    return result;
  }
}

const multiplayerService = new MultiplayerService();
export default multiplayerService;
