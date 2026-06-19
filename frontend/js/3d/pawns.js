// ==========================================
// 3D FUTBOLCU PİYON KARAKTERLERİ
// ==========================================

import * as THREE from 'three';
import { PLAYERS } from '../engine/state.js';
import { camera } from './scene.js';

// 3D piyon karakterlerini oluştur
export function create3DPlayers(scene) {
  PLAYERS.forEach((p, index) => {
    const group = new THREE.Group();

    // 1. Gövde (Forma - Cylinder)
    const bodyGeom = new THREE.CylinderGeometry(0.18, 0.18, 0.5, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.4 });
    const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
    bodyMesh.position.y = 0.25;
    group.add(bodyMesh);

    // 2. Kafa (Küre - Ten Rengi)
    const headGeom = new THREE.SphereGeometry(0.15, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.6 });
    const headMesh = new THREE.Mesh(headGeom, headMat);
    headMesh.position.y = 0.58;
    group.add(headMesh);

    // 3. Gözler
    const eyeGeom = new THREE.SphereGeometry(0.02, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

    const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
    leftEye.position.set(0.05, 0.6, 0.13);
    group.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeom, eyeMat);
    rightEye.position.set(-0.05, 0.6, 0.13);
    group.add(rightEye);

    // 4. Saç tasarımları
    let hairColor = 0x000000;
    if (p.name === "Messi") hairColor = 0xb5824c;
    else if (p.name === "Haaland") hairColor = 0xffe57f;
    else if (p.name === "Ronaldo" || p.name === "Mbappé") hairColor = 0x111111;

    const hairGeom = new THREE.SphereGeometry(0.155, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.6);
    const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.8 });
    const hairMesh = new THREE.Mesh(hairGeom, hairMat);
    hairMesh.position.set(0, 0.61, -0.01);
    group.add(hairMesh);

    if (p.name === "Haaland") {
      const bunGeom = new THREE.SphereGeometry(0.05, 8, 8);
      const bunMesh = new THREE.Mesh(bunGeom, hairMat);
      bunMesh.position.set(0, 0.68, -0.1);
      group.add(bunMesh);
    }

    // 5. Kramponlar (Ayaklar)
    const footGeom = new THREE.CylinderGeometry(0.05, 0.05, 0.12, 8);
    const footMat = new THREE.MeshStandardMaterial({ color: 0xffffff });

    const leftFoot = new THREE.Mesh(footGeom, footMat);
    leftFoot.position.set(0.08, 0.06, 0);
    group.add(leftFoot);

    const rightFoot = new THREE.Mesh(footGeom, footMat);
    rightFoot.position.set(-0.08, 0.06, 0);
    group.add(rightFoot);

    // 6. Başlangıç konumu
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
