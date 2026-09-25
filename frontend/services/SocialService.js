// Arkadaş listesi ve mesajlaşma için canlı bildirim akışı (SSE) + yardımcılar.
import apiService from './ApiService.js';

export const MAX_MESSAGE_LENGTH = 500;

// Mesaj listesine yeni mesajı id'ye göre tekilleştirerek ve zamana göre sıralı ekler.
export function mergeMessages(list, incoming) {
  const byId = new Map(list.map(message => [message.id, message]));
  [].concat(incoming).forEach(message => {
    if (message && message.id) byId.set(message.id, { ...byId.get(message.id), ...message });
  });
  return [...byId.values()].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
}

// Bir mesajın hangi arkadaşla olan konuşmaya ait olduğunu bulur.
export function conversationPartnerId(message, localUserId) {
  if (!message) return null;
  return message.sender_id === localUserId ? message.recipient_id : message.sender_id;
}

export function validateMessageBody(text) {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed) return { ok: false, error: 'Mesaj boş olamaz.' };
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: `Mesaj en fazla ${MAX_MESSAGE_LENGTH} karakter olabilir.` };
  }
  return { ok: true, value: trimmed };
}

// Arkadaş listesini arayüzde gösterilecek gruplara ayırır.
export function groupFriends(list) {
  const entries = Array.isArray(list) ? list : [];
  return {
    accepted: entries.filter(f => f.status === 'accepted'),
    incoming: entries.filter(f => f.status === 'pending' && !f.is_sender),
    outgoing: entries.filter(f => f.status === 'pending' && f.is_sender)
  };
}

export class SocialStream {
  constructor({ api = apiService } = {}) {
    this._api = api;
    this._source = null;
    this._listeners = new Set();
    this._retry = 0;
    this._timer = null;
    this._active = false;
  }

  subscribe(listener) {
    this._listeners.add(listener);
    if (!this._active) this.connect();
    return () => {
      this._listeners.delete(listener);
      if (this._listeners.size === 0) this.disconnect();
    };
  }

  connect() {
    if (typeof EventSource === 'undefined') return;
    const url = this._api.getMessageStreamUrl();
    if (!url) return;
    this._active = true;
    this._source = new EventSource(url);
    this._source.onopen = () => { this._retry = 0; };
    this._source.onmessage = event => {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      if (payload.type === 'heartbeat') return;
      this._listeners.forEach(listener => {
        try {
          listener(payload);
        } catch (e) {
          console.warn('[SocialStream] listener hatası', e);
        }
      });
    };
    this._source.onerror = () => {
      if (this._source) this._source.close();
      this._source = null;
      if (!this._active) return;
      const delay = Math.min(1000 * 2 ** this._retry, 30000);
      this._retry += 1;
      clearTimeout(this._timer);
      this._timer = setTimeout(() => {
        if (this._active && this._api.isLoggedIn()) this.connect();
      }, delay);
    };
  }

  disconnect() {
    this._active = false;
    clearTimeout(this._timer);
    if (this._source) this._source.close();
    this._source = null;
  }
}

const socialStream = new SocialStream();
export default socialStream;
