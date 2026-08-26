// ==========================================
// 3D FUTBOLCU PİYON KARAKTERLERİ
// ==========================================

import * as THREE from 'three';
import { PLAYERS } from '../engine/state.js';
import { camera } from './scene.js';

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

// Özgün, düşük poligonlu karakter piyonları oluştur.
export function create3DPlayers(scene) {
  PLAYERS.forEach((p, index) => {
    const group = createCharacter(p);
    const startPos = getPlayer3DPosition(index, p.pos);
    group.position.set(startPos.x, startPos.y, startPos.z);
    scene.add(group);
    p.threeGroup = group;
    p.target3DPosition = { x: startPos.x, y: startPos.y, z: startPos.z };
  });
}

// Hücre 3D konumu hesaplama
export function getCell3DPosition(cellIndex) {
  const cameraY = (camera && camera.position) ? camera.position.y : 29.5;
  const limit = cameraY * 0.155;

  let row, col;
  if (cellIndex >= 0 && cellIndex <= 8) {
    col = 0;
    row = 8 - cellIndex;
  } else if (cellIndex > 8 && cellIndex <= 16) {
    row = 0;
    col = cellIndex - 8;
  } else if (cellIndex > 16 && cellIndex <= 24) {
    col = 8;
    row = cellIndex - 16;
  } else {
    row = 8;
    col = 8 - (cellIndex - 24);
  }

  function getCoord(idx) {
    const frUnit = (limit * 2) / 10;
    if (idx === 0) return -limit + 0.75 * frUnit;
    if (idx === 8) return -limit + 9.25 * frUnit;
    return -limit + (idx + 1) * frUnit;
  }

  let x = getCoord(col);
  let z = getCoord(row);

  return { x: x, y: 0, z: z };
}

// Oyuncu offset pozisyonu (üst üste binmemesi için)
export function getPlayer3DPosition(playerIndex, cellIndex) {
  const pos = getCell3DPosition(cellIndex);
  const offset = 0.25;
  const verticalShift = 0.6;
  const horizontalShift = 0.4;

  if (playerIndex === 0) {
    pos.x += offset - horizontalShift;
    pos.z += offset + verticalShift;
  } else if (playerIndex === 1) {
    pos.x -= offset + horizontalShift;
    pos.z += offset + verticalShift;
  } else if (playerIndex === 2) {
    pos.x += offset - horizontalShift;
    pos.z -= offset - verticalShift;
  } else if (playerIndex === 3) {
    pos.x -= offset + horizontalShift;
    pos.z -= offset - verticalShift;
  }

  return pos;
}

// Piyon pozisyonlarını güncelle
export function update3DPawnsTargetPositions() {
  PLAYERS.forEach((p, index) => {
    if (p.threeGroup) {
      const targetPos = getPlayer3DPosition(index, p.pos);
      p.target3DPosition = targetPos;
    }
  });
}
