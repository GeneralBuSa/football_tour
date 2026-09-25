// ==========================================
// 3D FUTBOLCU PİYON KARAKTERLERİ
// ==========================================

import * as THREE from 'three';
import { PLAYERS } from '../engine/state.js';

const CHARACTER_STYLES = {
  "The Architect": { skin: 0xb97852, hair: 0x241810, body: 0.92, hairStyle: "side", accent: 0xffffff },
  "The King": { skin: 0xc9875e, hair: 0x171311, body: 1.02, hairStyle: "short", accent: 0xf5c542 },
  "The Rocket": { skin: 0x7d4935, hair: 0x171717, body: 0.98, hairStyle: "crop", accent: 0xffffff },
  "The Viking": { skin: 0xf0bd91, hair: 0xc18a38, body: 1.18, hairStyle: "braids", accent: 0xf4e7d0 },
  "The Wizard": { skin: 0x75452f, hair: 0x2a1711, body: 0.94, hairStyle: "curls", accent: 0x168447 },
};

function mesh(geometry, material, position = [0, 0, 0], scale = [1, 1, 1]) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(...position);
  item.scale.set(...scale);
  return item;
}

function addHair(group, style, material) {
  const cap = new THREE.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58);
  if (style === "braids") {
    group.add(mesh(cap, material, [0, 0.91, -0.01], [1.05, 1.05, 1.05]));
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) group.add(mesh(new THREE.SphereGeometry(0.045, 8, 6), material, [side * (0.13 + i * 0.025), 0.91 - i * 0.045, -0.02]));
    }
    return;
  }
  const scale = style === "curls" ? [1.08, 1.08, 1.08] : style === "crop" ? [1, 0.78, 1] : [1, 0.9, 1];
  group.add(mesh(cap, material, [0, 0.91, -0.01], scale));
  if (style === "side") group.add(mesh(new THREE.SphereGeometry(0.045, 8, 6), material, [0.1, 0.97, 0.06], [1.4, 0.6, 0.8]));
  if (style === "curls") for (let i = 0; i < 6; i++) group.add(mesh(new THREE.SphereGeometry(0.045, 8, 6), material, [(i % 3 - 1) * 0.09, 0.99 + (i % 2) * 0.025, 0.02]));
}

export function createCharacter(p) {
  const style = CHARACTER_STYLES[p.name] || CHARACTER_STYLES["The Architect"];
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: style.skin, roughness: 0.72 });
  const kit = new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.48 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x17202a, roughness: 0.7 });
  const hair = new THREE.MeshStandardMaterial({ color: style.hair, roughness: 0.88 });
  const accent = new THREE.MeshStandardMaterial({ color: style.accent, roughness: 0.5 });
  // Proportions are intentionally stylised, but use clear football-kit
  // landmarks so each pawn reads as a designed character rather than a blob.
  group.add(mesh(new THREE.CylinderGeometry(0.18 * style.body, 0.22 * style.body, 0.12, 12), skin, [0, 0.47, 0]));
  group.add(mesh(new THREE.CapsuleGeometry(0.17 * style.body, 0.25 * style.body, 4, 12), kit, [0, 0.48, 0]));
  group.add(mesh(new THREE.CylinderGeometry(0.19 * style.body, 0.18 * style.body, 0.15, 12), dark, [0, 0.28, 0]));
  group.add(mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.06, 10), skin, [0, 0.66, 0]));
  group.add(mesh(new THREE.SphereGeometry(0.15, 14, 12), skin, [0, 0.79, 0]));
  group.add(mesh(new THREE.SphereGeometry(0.055, 8, 6), skin, [0, 0.67, 0.105], [1.25, 0.62, 0.8]));
  // Nose, ears and brows give the tiny face a readable silhouette at game zoom.
  group.add(mesh(new THREE.ConeGeometry(0.018, 0.055, 6), skin, [0, 0.785, 0.145], [1, 1, 0.7]));
  for (const side of [-1, 1]) {
    group.add(mesh(new THREE.SphereGeometry(0.025, 8, 6), skin, [side * 0.145, 0.79, 0]));
    group.add(mesh(new THREE.BoxGeometry(0.04, 0.012, 0.012), hair, [side * 0.055, 0.855, 0.125], [1.3, 1, 1]));
  }
  addHair(group, style.hairStyle, hair);
  const eye = new THREE.MeshBasicMaterial({ color: 0x17110e });
  for (const side of [-1, 1]) group.add(mesh(new THREE.SphereGeometry(0.019, 6, 5), eye, [side * 0.055, 0.80, 0.14]));
  group.add(mesh(new THREE.BoxGeometry(0.075, 0.018, 0.015), dark, [0, 0.735, 0.14]));
  const limb = new THREE.CylinderGeometry(0.045, 0.052, 0.28, 8);
  for (const side of [-1, 1]) {
    const arm = mesh(limb, kit, [side * 0.22, 0.48, 0], [0.9, 1.05, 0.9]);
    const forearm = mesh(limb, skin, [side * 0.22, 0.22, 0], [0.82, 0.82, 0.82]);
    group.add(arm, forearm);
    group.add(mesh(new THREE.SphereGeometry(0.045, 8, 6), skin, [side * 0.22, 0.07, 0]));
    const leg = mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.25, 8), skin, [side * 0.095, 0.13, 0]);
    group.add(leg);
    group.add(mesh(new THREE.CylinderGeometry(0.065, 0.06, 0.1, 8), accent, [side * 0.095, -0.02, 0]));
    group.add(mesh(new THREE.SphereGeometry(0.07, 8, 6), dark, [side * 0.095, -0.1, 0.045], [1.35, 0.55, 1.8]));
  }
  group.add(mesh(new THREE.TorusGeometry(0.19, 0.012, 6, 16), accent, [0, 0.37, 0]));

  // Distinctive non-licensed archetype poses: these improve recognition without
  // copying a real athlete's likeness or signature celebration.
  if (p.archetype === 'target') {
    group.children.filter((_, i) => i === 16 || i === 17).forEach((arm, i) => { arm.rotation.z = (i ? -1 : 1) * 0.95; });
  } else if (p.archetype === 'speedster') {
    group.rotation.z = -0.08;
  } else if (p.archetype === 'dribbler') {
    group.children.filter((_, i) => i === 16).forEach(arm => { arm.rotation.z = -0.55; });
  }
  group.userData.archetype = p.archetype;
  group.userData.characterName = p.name;
  return group;
}

// ==========================================
// OYUNCU MODELLERİ (Meshy GLB)
// ==========================================
// Oyun, tasarlanan futbolcu modellerini kullanır. Orijinal dosyalar (~30 MB, 3M üçgen)
// vitrin sayfası içindir; oyunda aynı modellerin optimize kopyaları
// (assets/players/game/*.glb, ~400 KB, ~31K üçgen, 1024px WebP doku, Draco) yüklenir.
// Model gelene kadar (veya yüklenemezse) prosedürel yedek figür gösterilir.

export const CHARACTER_KEYS = ['architect', 'king', 'rocket', 'viking', 'wizard'];
const GAME_MODEL_PATH = key => `/assets/players/game/${key}.glb`;
const PAWN_HEIGHT = 1.35; // tahta birimi (≈ 1.35 hücre genişliği)
// Beklerken modeller izometrik kameraya doğru bakar.
export const IDLE_FACING = -Math.PI / 4;

const modelCache = new Map();
let gltfLoaderPromise = null;

function getLoader() {
  if (!gltfLoaderPromise) {
    gltfLoaderPromise = Promise.all([
      import('three/examples/jsm/loaders/GLTFLoader.js'),
      import('three/examples/jsm/loaders/DRACOLoader.js')
    ]).then(([{ GLTFLoader }, { DRACOLoader }]) => {
      const draco = new DRACOLoader();
      draco.setDecoderPath('/draco/');
      const loader = new GLTFLoader();
      loader.setDRACOLoader(draco);
      return loader;
    });
  }
  return gltfLoaderPromise;
}

// Oyuncunun kullanacağı karakter: seçili karakter > isimden eşleşme > sıraya göre varsayılan.
export function resolveCharacterKey(player, index = 0) {
  if (player?.characterKey && CHARACTER_KEYS.includes(player.characterKey)) return player.characterKey;
  const byName = String(player?.name || '').toLowerCase().replace(/^the\s+/, '');
  if (CHARACTER_KEYS.includes(byName)) return byName;
  return CHARACTER_KEYS[index % CHARACTER_KEYS.length];
}

// Modeli bir kez yükler, ayağı y=0'da ve yüksekliği PAWN_HEIGHT olacak şekilde normalleştirir.
export function loadCharacterModel(key) {
  if (!modelCache.has(key)) {
    const promise = getLoader().then(loader => new Promise((resolve, reject) => {
      loader.load(GAME_MODEL_PATH(key), gltf => {
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const scale = PAWN_HEIGHT / Math.max(size.y, 0.001);
        model.scale.setScalar(scale);
        const fitted = new THREE.Box3().setFromObject(model);
        const center = fitted.getCenter(new THREE.Vector3());
        model.position.x -= center.x;
        model.position.z -= center.z;
        model.position.y -= fitted.min.y;
        model.traverse(child => {
          if (child.isMesh) {
            child.frustumCulled = false;
            if (child.material) child.material.side = THREE.FrontSide;
          }
        });
        const holder = new THREE.Group();
        holder.add(model);
        resolve(holder);
      }, undefined, reject);
    }));
    promise.catch(() => modelCache.delete(key));
    modelCache.set(key, promise);
  }
  return modelCache.get(key);
}

// Oyuncunun rengindeki zemin halkası: aynı karakteri iki oyuncu seçse de ayırt edilir.
function createBaseRing(color) {
  const group = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.34, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false })
  );
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.3, 0.38, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false })
  );
  [disc, ring].forEach(item => {
    item.rotation.x = -Math.PI / 2;
    item.position.y = 0.01;
    group.add(item);
  });
  group.userData.isBaseRing = true;
  return group;
}

function setPawnCharacter(wrapper, player, index) {
  const key = resolveCharacterKey(player, index);
  const color = player.color || '#29b6f6';
  if (wrapper.userData.characterKey === key && wrapper.userData.color === color) return;
  wrapper.userData.characterKey = key;
  wrapper.userData.color = color;

  // Önceki içeriği temizle, halkayı ve yedek figürü hemen göster.
  wrapper.clear();
  wrapper.add(createBaseRing(color));
  const fallback = createCharacter({ ...player, name: player.name, color });
  fallback.scale.setScalar(1.1);
  fallback.position.y = 0.12;
  wrapper.add(fallback);

  loadCharacterModel(key).then(template => {
    if (wrapper.userData.characterKey !== key) return; // bu arada karakter değişti
    wrapper.remove(fallback);
    const model = template.clone(true);
    model.userData.isCharacterModel = true;
    wrapper.add(model);
  }).catch(error => {
    console.warn(`[3D] ${key} modeli yüklenemedi, yedek figür kullanılıyor`, error);
  });
}

// ==========================================
// PİYON YÖNETİMİ
// ==========================================
// Piyonlar oyuncu sırasına (index) göre tutulur. PLAYERS dizisi yeni oyun başlatıldığında
// (resetState) veya çevrimiçi durum senkronize edildiğinde yeni nesnelerle değiştiği için
// piyon her senkronizasyonda ilgili oyuncu nesnesine yeniden bağlanır.
const pawnGroups = [];
let pawnParent = null;

function syncPawnsWithPlayers() {
  if (!pawnParent) return;
  PLAYERS.forEach((p, index) => {
    let group = pawnGroups[index];
    if (!group) {
      group = new THREE.Group();
      const startPos = getPlayer3DPosition(index, p.pos);
      group.position.set(startPos.x, 0, startPos.z);
      group.rotation.y = IDLE_FACING;
      pawnParent.add(group);
      pawnGroups[index] = group;
    }
    setPawnCharacter(group, p, index);
    group.visible = true;
    if (p.threeGroup !== group) {
      Object.defineProperty(p, 'threeGroup', { value: group, writable: true, configurable: true, enumerable: false });
    }
  });
  // Maçta olmayan oyuncuların piyonlarını gizle (ör. 2 kişilik çevrimiçi maç).
  for (let index = PLAYERS.length; index < pawnGroups.length; index++) {
    if (pawnGroups[index]) pawnGroups[index].visible = false;
  }
}

export function create3DPlayers(parent) {
  pawnParent = parent;
  syncPawnsWithPlayers();
  update3DPawnsTargetPositions();
  // Modelleri arka planda önceden indir (oyun başladığında hazır olsun).
  CHARACTER_KEYS.forEach(key => loadCharacterModel(key).catch(() => {}));
}

// ==========================================
// HÜCRE KONUMLARI
// ==========================================
const BOARD_PX = 680;
const UNIT_PX = 74; // scene.js BOARD_UNIT_PX ile aynı

function cellGridPosition(cellIndex) {
  if (cellIndex >= 0 && cellIndex <= 8) return { col: 0, row: 8 - cellIndex };
  if (cellIndex > 8 && cellIndex <= 16) return { row: 0, col: cellIndex - 8 };
  if (cellIndex > 16 && cellIndex <= 24) return { col: 8, row: cellIndex - 16 };
  return { row: 8, col: 8 - (cellIndex - 24) };
}

// DOM'daki hücrenin tahta içindeki merkezini ölçer; tahta henüz yerleşmediyse
// grid tanımından (1.5fr 7×1fr 1.5fr, 6px padding, 3px boşluk) hesaplar.
export function getCell3DPosition(cellIndex) {
  const el = typeof document !== 'undefined' ? document.querySelector(`[data-cell-index="${cellIndex}"]`) : null;
  let cx;
  let cy;
  if (el && el.offsetWidth) {
    cx = el.offsetLeft + el.offsetWidth / 2;
    cy = el.offsetTop + el.offsetHeight / 2;
  } else {
    const { row, col } = cellGridPosition(cellIndex);
    const fr = (BOARD_PX - 12 - 8 * 3) / 10;
    const widths = [1.5, 1, 1, 1, 1, 1, 1, 1, 1.5].map(w => w * fr);
    const start = i => 6 + widths.slice(0, i).reduce((a, b) => a + b, 0) + i * 3;
    cx = start(col) + widths[col] / 2;
    cy = start(row) + widths[row] / 2;
  }
  return { x: (cx - BOARD_PX / 2) / UNIT_PX, y: 0, z: (cy - BOARD_PX / 2) / UNIT_PX };
}

// Hücrenin sahaya (tahta merkezine) bakan yönü: kenar hücrelerinde uzun eksen boyunca.
export function getCellInwardDirection(cellIndex) {
  const { row, col } = cellGridPosition(cellIndex);
  const x = col === 0 ? 1 : col === 8 ? -1 : 0;
  const z = row === 0 ? 1 : row === 8 ? -1 : 0;
  const length = Math.hypot(x, z) || 1;
  return { x: x / length, z: z / length };
}

// Stadyum hücrenin iç yarısına, piyonlar dış yarısına yerleşir; üst üste binmezler.
export function getStadium3DPosition(cellIndex) {
  const pos = getCell3DPosition(cellIndex);
  const inward = getCellInwardDirection(cellIndex);
  return { x: pos.x + inward.x * 0.32, y: 0, z: pos.z + inward.z * 0.32 };
}

// Aynı hücredeki oyuncular üst üste binmesin diye küçük ofsetler.
const PLAYER_OFFSETS = [
  [-0.22, -0.18],
  [0.22, 0.18],
  [0.22, -0.18],
  [-0.22, 0.18]
];

export function getPlayer3DPosition(playerIndex, cellIndex) {
  const pos = getCell3DPosition(cellIndex);
  const inward = getCellInwardDirection(cellIndex);
  pos.x -= inward.x * 0.2;
  pos.z -= inward.z * 0.2;
  const [ox, oz] = PLAYER_OFFSETS[playerIndex % PLAYER_OFFSETS.length];
  const shared = PLAYERS.filter(p => p.pos === cellIndex).length > 1;
  if (shared) {
    pos.x += ox;
    pos.z += oz;
  }
  return pos;
}

// Piyon pozisyonlarını güncelle
export function update3DPawnsTargetPositions() {
  syncPawnsWithPlayers();
  PLAYERS.forEach((p, index) => {
    if (p.threeGroup) p.target3DPosition = getPlayer3DPosition(index, p.pos);
  });
}
