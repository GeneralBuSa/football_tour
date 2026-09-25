// Satılabilir futbolcu kataloğu ve başlangıç hediyesi kuralları.
// Karakter fiyatları coin cinsindendir. Coin paketleri kademeli fiyatlandırılır.

export const PLAYER_CATALOG = [
  {
    key: 'architect',
    name: 'The Architect',
    priceCoins: 500,
    priceUsdCents: 500,
    archetype: 'playmaker',
    color: '#29b6f6',
    refImage: '/docs/ft26-architect.webp',
    modelPath: '/assets/players/architect.glb'
  },
  {
    key: 'king',
    name: 'The King',
    priceCoins: 500,
    priceUsdCents: 500,
    archetype: 'finisher',
    color: '#d92c4c',
    refImage: '/docs/ft26-king.webp',
    modelPath: '/assets/players/king.glb'
  },
  {
    key: 'viking',
    name: 'The Viking',
    priceCoins: 300,
    priceUsdCents: 300,
    archetype: 'target',
    color: '#a52b36',
    refImage: '/docs/ft26-viking.webp',
    modelPath: '/assets/players/viking.glb',
    starterEligible: true
  },
  {
    key: 'rocket',
    name: 'The Rocket',
    priceCoins: 300,
    priceUsdCents: 300,
    archetype: 'speedster',
    color: '#253b78',
    refImage: '/docs/ft26-rocket.webp',
    modelPath: '/assets/players/rocket.glb',
    starterEligible: true
  },
  {
    key: 'wizard',
    name: 'The Wizard',
    priceCoins: 300,
    priceUsdCents: 300,
    archetype: 'dribbler',
    color: '#f2c21b',
    refImage: '/docs/ft26-wizard.webp',
    modelPath: '/assets/players/wizard.glb'
  }
];

export const COIN_PACKS = [
  { key: 'coins_100', coins: 100, priceUsdCents: 150 },
  { key: 'coins_300', coins: 300, priceUsdCents: 400 },
  { key: 'coins_500', coins: 500, priceUsdCents: 500 },
  { key: 'coins_1000', coins: 1000, priceUsdCents: 800 }
];

export const STARTER_CHARACTER_KEYS = ['viking', 'rocket'];

export function getPlayerByKey(key) {
  return PLAYER_CATALOG.find(player => player.key === key) || null;
}
