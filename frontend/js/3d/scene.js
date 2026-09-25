// ==========================================
// THREE.JS 3D SAHNE YÖNETİMİ
// ==========================================
//
// Tahta DOM ile çizilir ve CSS 3D dönüşümüyle (rotateX/rotateZ/scale) izometrik görünür.
// Eskiden 3D canvas tahtanın İÇİNDEYDİ: sahne tepeden çiziliyor, sonra canvas tahtayla
// birlikte yatırılıyordu; piyonlar tahtaya yapıştırılmış düz resimler gibi görünüyordu.
// Artık canvas tahtanın dışında (ekran uzayında) durur ve kamera, CSS perspektifini ve
// tahtanın hesaplanmış dönüşüm matrisini birebir kopyalar. Böylece modeller tahtanın
// üzerinde gerçekten ayakta durur.

import * as THREE from 'three';
import { PLAYERS } from '../engine/state.js';
import { create3DPlayers, IDLE_FACING } from './pawns.js';
import { stadiumAnimations } from './stadiums.js';

// Tahta içi 3D birim (1 birim ≈ bir hücrenin genişliği kadar CSS pikseli).
export const BOARD_UNIT_PX = 74;
const BOARD_SIZE_PX = 680;

export let scene, camera, renderer;
// Tahta yüzeyine hizalı içerik grubu: x sağa, z tahtada "aşağı", y tahtadan yukarı.
export let boardContent = null;
let boardSpace = null;
let boardWrap = null;
let boardContainer = null;
let canvasEl = null;
let resizeObserver = null;

const FLIP_Y = new THREE.Matrix4().makeScale(1, -1, 1);

function cssMatrixToThree(transformValue) {
  if (!transformValue || transformValue === 'none') return new THREE.Matrix4();
  const css = new DOMMatrix(transformValue);
  const matrix = new THREE.Matrix4().fromArray(css.toFloat64Array());
  // CSS'te y aşağı, Three.js'te yukarı bakar.
  return new THREE.Matrix4().multiplyMatrices(FLIP_Y, matrix).multiply(FLIP_Y);
}

// Tahtayı mevcut alana sığdıracak ölçeği hesaplar (izometrik izdüşüme göre).
export function fitBoardToViewport() {
  if (!boardWrap || !boardContainer) return;
  const width = boardWrap.clientWidth;
  const height = boardWrap.clientHeight;
  if (!width || !height) return;

  const tilt = parseFloat(getComputedStyle(boardContainer).getPropertyValue('--board-tilt')) || 52;
  const diagonal = BOARD_SIZE_PX * Math.SQRT2;
  const projectedHeight = diagonal * Math.cos((tilt * Math.PI) / 180);
  // Piyonların tahtanın üstünden taşan kısmı ve perspektifle büyüyen ön kenar için pay.
  const scale = Math.min((width * 0.96) / diagonal, (height * 0.97) / (projectedHeight + 40));
  boardContainer.style.setProperty('--board-scale', Math.max(0.28, Math.min(scale, 1.3)).toFixed(3));
}

// Kamera ve tahta matrisini DOM'daki gerçek duruma göre eşitler.
export function syncBoardView() {
  if (!renderer || !boardWrap || !boardContainer) return;
  const width = boardWrap.clientWidth;
  const height = boardWrap.clientHeight;
  if (!width || !height) return;

  renderer.setSize(width, height, false);
  const perspective = parseFloat(getComputedStyle(boardWrap).perspective) || 1600;
  camera.aspect = width / height;
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(height / 2 / perspective));
  camera.near = 1;
  camera.far = perspective * 4;
  camera.position.set(0, 0, perspective);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();

  // Tahtanın yerleşim merkezi ile perspektif merkezi (board-wrap ortası) arasındaki fark.
  const dx = boardContainer.offsetLeft + boardContainer.offsetWidth / 2 - width / 2;
  const dy = boardContainer.offsetTop + boardContainer.offsetHeight / 2 - height / 2;
  const translation = new THREE.Matrix4().makeTranslation(dx, -dy, 0);
  boardSpace.matrix.multiplyMatrices(translation, cssMatrixToThree(getComputedStyle(boardContainer).transform));
  boardSpace.matrixWorldNeedsUpdate = true;
}

function refreshView() {
  fitBoardToViewport();
  syncBoardView();
}

// Three.js sahnesini başlat
export function initThreeJS() {
  canvasEl = document.getElementById('three-canvas');
  boardWrap = document.querySelector('.board-wrap');
  boardContainer = document.getElementById('board-3d-container');
  if (!canvasEl || !boardWrap || !boardContainer) return;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, 1, 1, 6400);

  renderer = new THREE.WebGLRenderer({ canvas: canvasEl, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  boardSpace = new THREE.Object3D();
  boardSpace.matrixAutoUpdate = false;
  scene.add(boardSpace);

  boardContent = new THREE.Group();
  // Y-yukarı içerik uzayını tahta yüzeyine yatır ve birimi piksele çevir.
  boardContent.rotation.x = Math.PI / 2;
  boardContent.scale.setScalar(BOARD_UNIT_PX);
  boardSpace.add(boardContent);

  // Işıklandırma: stadyum ışığı hissi veren sıcak üst ışık + soğuk dolgu ışığı.
  scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x1d2b22, 1.35));
  const keyLight = new THREE.DirectionalLight(0xfff4e0, 2.1);
  keyLight.position.set(-600, 900, 1400);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0x7fd3ff, 0.8);
  rimLight.position.set(900, -300, 600);
  scene.add(rimLight);

  create3DPlayers(boardContent);

  resizeObserver = new ResizeObserver(refreshView);
  resizeObserver.observe(boardWrap);
  window.addEventListener('resize', refreshView);
  refreshView();

  animate3D();
}

// Oyun ekranı görünür olduğunda veya düzen değiştiğinde çağrılır.
export function update3DCamera() {
  refreshView();
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
  if (elapsed < frameInterval - 1) return;
  lastRenderTime = currentTime - (elapsed % frameInterval);

  // Oyun ekranı gizliyken çizim yapma.
  if (!boardWrap || boardWrap.offsetParent === null) return;

  const now = Date.now();
  PLAYERS.forEach((p, index) => {
    const group = p.threeGroup;
    if (!group || !p.target3DPosition) return;
    const dx = p.target3DPosition.x - group.position.x;
    const dz = p.target3DPosition.z - group.position.z;
    group.position.x += dx * 0.09;
    group.position.z += dz * 0.09;

    if (Math.hypot(dx, dz) > 0.03) {
      // Koşma: küçük zıplama ve gidilen yöne dönme.
      group.position.y = Math.abs(Math.sin(now * 0.014)) * 0.22;
      group.rotation.y = Math.atan2(dx, dz);
    } else {
      // Beklerken kameraya dön ve hafifçe nefes al.
      group.position.y = 0;
      group.rotation.y += (IDLE_FACING - group.rotation.y) * 0.15;
      const breathe = 1 + Math.sin(now * 0.003 + index) * 0.012;
      group.scale.set(1, breathe, 1);
    }
  });

  for (let i = stadiumAnimations.length - 1; i >= 0; i--) {
    const { group, targetScale, startTime } = stadiumAnimations[i];
    const t = Math.min(1, (now - startTime) / 600);
    const spring = 1 - Math.pow(1 - t, 3) * Math.cos(t * Math.PI * 0.5);
    group.scale.setScalar(targetScale * spring);
    if (t >= 1) stadiumAnimations.splice(i, 1);
  }

  if (renderer && scene && camera) renderer.render(scene, camera);
}
