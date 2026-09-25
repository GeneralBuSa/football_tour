// innerHTML ile çizilen her kullanıcı/rakip kaynaklı değer bu yardımcılardan geçmelidir.
// Çevrimiçi maçta oyun durumu rakibin istemcisinden gelir; güvenilmez veridir.

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

// Yalnızca #rrggbb biçimindeki renkler stil içine yazılır; aksi halde güvenli varsayılan.
export function safeColor(value, fallback = '#94a3b8') {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}
