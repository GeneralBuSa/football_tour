// ==========================================
// THREE.JS 3D SAHNE YÖNETİMİ
// ==========================================

import * as THREE from 'three';
import { PLAYERS } from '../engine/state.js';
import { create3DPlayers } from './pawns.js';
import { stadiumAnimations, stadiumMeshes } from './stadiums.js';

export let scene, camera, renderer;
export let boardRotation = { x: 54, z: -45 };

// Three.js sahnesini başlat
export function initThreeJS() {
  const canvas = document.getElementById('three-canvas');
  const boardWrap = document.querySelector('.board-wrap');
  if (!canvas || !boardWrap) return;

  // Sahne (şeffaf arka plan)
  scene = new THREE.Scene();

  // Kamera (düşük FOV)
  camera = new THREE.PerspectiveCamera(20, 1, 0.1, 100);
  update3DCamera();

  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  renderer.setSize(680, 680);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Işıklandırma
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
  dirLight.position.set(0, 15, 5);
  scene.add(dirLight);

  // 3D Piyonları oluştur
  create3DPlayers(scene);

  // Animasyon döngüsü
  animate3D();
}

// Kamera konumu
export function update3DCamera() {
  if (!camera) return;
  camera.position.set(0, 29.5, 0);
  camera.lookAt(0, 0, 0);
}

let lastRenderTime = 0;

// Animasyon döngüsü
export function animate3D(currentTime = performance.now()) {
  requestAnimationFrame(animate3D);

  const settings = (typeof window !== 'undefined' && window.ft26_settings) || {};
  let targetFps = settings.fpsLimit || 60;
  if (settings.vSync === '1/2') targetFps = 30;

  const frameInterval = 1000 / targetFps;
  const elapsed = currentTime - (lastRenderTime || 0);

  if (elapsed < frameInterval - 1) {
    return;
  }
  lastRenderTime = currentTime - (elapsed % frameInterval);

  // Piyon hareketleri
  PLAYERS.forEach(p => {
    if (p.threeGroup && p.target3DPosition) {
      const dx = p.target3DPosition.x - p.threeGroup.position.x;
      const dz = p.target3DPosition.z - p.threeGroup.position.z;

      // Yumuşak geçiş (lerp)
      p.threeGroup.position.x += dx * 0.08;
      p.threeGroup.position.z += dz * 0.08;

      const dist = Math.hypot(dx, dz);

      if (dist > 0.05) {
        // Koşma zıplama efekti
        p.threeGroup.position.y = Math.abs(Math.sin(Date.now() * 0.016)) * 0.35;
        // Gittiği yöne bak
        const angle = Math.atan2(dx, dz);
        p.threeGroup.rotation.y = angle;
      } else {
        p.threeGroup.position.y = 0;
        p.threeGroup.rotation.y = 0;
      }
    }
  });

  // Stadyum spawn animasyonları
  const activeAnims = stadiumAnimations;
  for (let i = activeAnims.length - 1; i >= 0; i--) {
    const anim = activeAnims[i];
    const { group, targetScale, startTime } = anim;
    const elapsedAnim = (Date.now() - startTime) / 1000;
    const t = Math.min(1, elapsedAnim / 0.6);
    const spring = 1 - Math.pow(1 - t, 3) * Math.cos(t * Math.PI * 0.5);
    const scale = targetScale * spring;
    group.scale.set(scale, scale, scale);
    if (t >= 1) activeAnims.splice(i, 1);
  }

  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}
