// ==========================================
// 3D STADYUM MODELİ
// ==========================================

import * as THREE from 'three';
import { PLAYERS } from '../engine/state.js';
import { boardContent } from './scene.js';
import { boardCells } from '../engine/board.js';
import { getStadium3DPosition } from './pawns.js';

// Stadyum verileri (sahne genelinde paylaşılır)
export let stadiumMeshes = {};
export let stadiumAnimations = [];

// Seviyeye göre 3D stadyum modeli oluştur
export function createStadiumModel(level, ownerColor) {
  const group = new THREE.Group();
  const color = new THREE.Color(ownerColor);
  const darkerColor = new THREE.Color(ownerColor).multiplyScalar(0.7);

  const wallMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.5, metalness: 0.2 });
  const darkMat = new THREE.MeshStandardMaterial({ color: darkerColor, roughness: 0.6 });
  const fieldMat = new THREE.MeshStandardMaterial({ color: 0x4caf50, roughness: 0.8 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });

  if (level >= 1) {
    // SEVİYE 1: Tek tribün
    const fieldGeom = new THREE.BoxGeometry(0.6, 0.02, 0.6);
    const field = new THREE.Mesh(fieldGeom, fieldMat);
    field.position.y = 0.01;
    group.add(field);

    const tribune1Geom = new THREE.BoxGeometry(0.6, 0.18, 0.08);
    const tribune1 = new THREE.Mesh(tribune1Geom, wallMat);
    tribune1.position.set(0, 0.1, -0.28);
    group.add(tribune1);

    const topGeom = new THREE.BoxGeometry(0.62, 0.02, 0.09);
    const top = new THREE.Mesh(topGeom, whiteMat);
    top.position.set(0, 0.2, -0.28);
    group.add(top);
  }

  if (level >= 2) {
    // SEVİYE 2: U-şeklinde tribün
    const sideGeom = new THREE.BoxGeometry(0.08, 0.22, 0.5);
    const leftTribune = new THREE.Mesh(sideGeom, wallMat);
    leftTribune.position.set(-0.28, 0.12, 0.02);
    group.add(leftTribune);

    const leftTopGeom = new THREE.BoxGeometry(0.09, 0.02, 0.52);
    const leftTop = new THREE.Mesh(leftTopGeom, whiteMat);
    leftTop.position.set(-0.28, 0.24, 0.02);
    group.add(leftTop);

    const rightTribune = new THREE.Mesh(sideGeom, wallMat);
    rightTribune.position.set(0.28, 0.12, 0.02);
    group.add(rightTribune);

    const rightTop = new THREE.Mesh(leftTopGeom, whiteMat);
    rightTop.position.set(0.28, 0.24, 0.02);
    group.add(rightTop);

    const backExtGeom = new THREE.BoxGeometry(0.6, 0.06, 0.08);
    const backExt = new THREE.Mesh(backExtGeom, darkMat);
    backExt.position.set(0, 0.22, -0.28);
    group.add(backExt);
  }

  if (level >= 3) {
    // SEVİYE 3: Tam stadyum + ışık kuleleri
    const frontGeom = new THREE.BoxGeometry(0.6, 0.26, 0.08);
    const front = new THREE.Mesh(frontGeom, wallMat);
    front.position.set(0, 0.14, 0.28);
    group.add(front);

    const frontTopGeom = new THREE.BoxGeometry(0.62, 0.02, 0.09);
    const frontTop = new THREE.Mesh(frontTopGeom, whiteMat);
    frontTop.position.set(0, 0.28, 0.28);
    group.add(frontTop);

    const roofGeom = new THREE.BoxGeometry(0.7, 0.015, 0.7);
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.3,
      roughness: 0.2,
      metalness: 0.8
    });
    const roof = new THREE.Mesh(roofGeom, roofMat);
    roof.position.y = 0.34;
    group.add(roof);

    // Işık kuleleri
    const poleGeom = new THREE.CylinderGeometry(0.01, 0.01, 0.25, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8 });
    const lightGeom = new THREE.SphereGeometry(0.03, 8, 8);
    const lightMat = new THREE.MeshStandardMaterial({
      color: 0xffff88,
      emissive: 0xffff44,
      emissiveIntensity: 2.0
    });

    const polePositions = [
      [-0.32, 0.44, -0.32],
      [0.32, 0.44, -0.32],
      [-0.32, 0.44, 0.32],
      [0.32, 0.44, 0.32]
    ];

    polePositions.forEach(pos => {
      const pole = new THREE.Mesh(poleGeom, poleMat);
      pole.position.set(pos[0], pos[1] - 0.12, pos[2]);
      group.add(pole);

      const light = new THREE.Mesh(lightGeom, lightMat);
      light.position.set(pos[0], pos[1], pos[2]);
      group.add(light);
    });

    const glowLight = new THREE.PointLight(color, 1.5, 3);
    glowLight.position.set(0, 0.5, 0);
    group.add(glowLight);
  }

  // Başlangıçta scale 0 (animasyonla büyüyecek)
  group.scale.set(0, 0, 0);

  return group;
}

// Tüm stadyumları güncelle
export function updateStadiums3D() {
  if (!boardContent) return;

  const requiredStadiums = {};

  PLAYERS.forEach(p => {
    p.ownedProps.forEach(cIdx => {
      const level = (p.stadiums && p.stadiums[cIdx]) ? p.stadiums[cIdx] : 0;
      requiredStadiums[cIdx] = {
        level: Math.max(1, level),
        color: p.color
      };
    });
  });

  // Kaldırılması gereken stadyumlar
  Object.keys(stadiumMeshes).forEach(cIdx => {
    if (!requiredStadiums[cIdx]) {
      boardContent.remove(stadiumMeshes[cIdx].group);
      delete stadiumMeshes[cIdx];
    }
  });

  // Oluşturulması/güncellenmesi gereken stadyumlar
  Object.entries(requiredStadiums).forEach(([cIdx, { level, color }]) => {
    const cellIdx = parseInt(cIdx);
    const existing = stadiumMeshes[cellIdx];

    if (existing && existing.level === level) return;

    if (existing) {
      boardContent.remove(existing.group);
    }

    const stadiumGroup = createStadiumModel(level, color);
    // cIdx şehir numarasıdır; stadyum şehrin tahtadaki hücresine konur.
    const boardIndex = boardCells.findIndex(cell => cell.type === 'city' && cell.cityIdx === cellIdx);
    if (boardIndex === -1) return;
    const pos = getStadium3DPosition(boardIndex);
    stadiumGroup.position.set(pos.x, 0, pos.z);
    boardContent.add(stadiumGroup);

    const targetScale = 0.55 + (level * 0.1);
    stadiumMeshes[cellIdx] = {
      group: stadiumGroup,
      level: level,
      targetScale: targetScale
    };

    stadiumAnimations.push({
      group: stadiumGroup,
      targetScale: targetScale,
      startTime: Date.now()
    });
  });
}
