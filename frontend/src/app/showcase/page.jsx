'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { createCharacter } from '../../../js/3d/pawns.js';
import { DEFAULT_PLAYERS } from '../../../js/data/cities.js';
import { PLAYER_CATALOG } from '../../../js/data/playerCatalog.js';

export default function ShowcasePage() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07101c);
    const camera = new THREE.PerspectiveCamera(28, 2, 0.1, 100);
    camera.position.set(0, 2.8, 11.5);
    camera.lookAt(0, 0.75, 0);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    scene.add(new THREE.HemisphereLight(0xbfe9ff, 0x101522, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(-4, 8, 7);
    scene.add(key);
    const rim = new THREE.PointLight(0x29b6f6, 18, 16);
    rim.position.set(4, 3, 4);
    scene.add(rim);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 8),
      new THREE.MeshStandardMaterial({ color: 0x0d1b2a, roughness: 0.8 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.17;
    scene.add(floor);

    let groups = [];
    let cancelled = false;

    const showFallback = (player, index) => {
      if (cancelled) return;
      const group = createCharacter(player);
      group.position.set((index - 2) * 1.95, 0.02, 0);
      group.scale.setScalar(1.42);
      scene.add(group);
      groups[index] = group;
    };

    const addModel = (gltf, _player, index) => {
      if (cancelled) return;
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const height = Math.max(box.max.y - box.min.y, 0.01);
      model.scale.setScalar(2.85 / height);
      const fittedBox = new THREE.Box3().setFromObject(model);
      const wrapper = new THREE.Group();
      model.position.y -= fittedBox.min.y;
      wrapper.position.set((index - 2) * 1.95, 0.02, 0);
      wrapper.add(model);
      scene.add(wrapper);
      groups[index] = wrapper;
    };

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');
    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);
    const loadPlayer = (index) => {
      if (cancelled || index >= PLAYER_CATALOG.length) return;
      const catalogPlayer = PLAYER_CATALOG[index];
      const player = DEFAULT_PLAYERS.find(item => item.name === catalogPlayer.name) || {
        name: catalogPlayer.name,
        color: catalogPlayer.color,
        archetype: catalogPlayer.archetype
      };
      // Meshy assets are large, so keep only one network transfer active at a time.
      loader.load(
        catalogPlayer.modelPath,
        gltf => {
          addModel(gltf, player, index);
          loadPlayer(index + 1);
        },
        undefined,
        () => {
          showFallback(player, index);
          loadPlayer(index + 1);
        }
      );
    };
    loadPlayer(0);

    const resize = () => {
      const width = Math.max(320, canvas.clientWidth || 1200);
      const height = Math.max(320, canvas.clientHeight || 560);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    let frame;
    const animate = () => {
      groups.filter(Boolean).forEach((group, index) => {
        group.rotation.y = Math.sin(Date.now() * 0.00045 + index) * 0.12;
        group.position.y = 0.02 + Math.sin(Date.now() * 0.002 + index) * 0.025;
      });
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      renderer.dispose();
      dracoLoader.dispose();
      cancelled = true;
      scene.traverse(object => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(material => material.dispose());
        }
      });
    };
  }, []);

  return (
    <main style={{ minHeight: '100vh', padding: '28px', color: '#f3f7ff', background: '#07101c', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
        <p style={{ color: '#29b6f6', letterSpacing: '3px', fontWeight: 700, marginBottom: 8 }}>FT26 3D CHARACTER LAB</p>
        <h1 style={{ margin: '0 0 8px', fontSize: 'clamp(28px, 4vw, 48px)' }}>Özgün futbolcu piyonları</h1>
        <p style={{ color: '#9eb1c9', marginTop: 0 }}>Lisanslı gerçek kişi kopyası değil; karakteristik saç, vücut oranı, forma ve pozlarla stilize edilmiş oyun modelleri.</p>
        <canvas ref={canvasRef} aria-label="3D futbolcu modelleri vitrini" style={{ display: 'block', width: '100%', height: 'min(58vw, 560px)', minHeight: '360px', border: '1px solid #1c3850', borderRadius: '18px', boxShadow: '0 24px 80px rgba(0,0,0,.35)' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginTop: 16 }}>
          {DEFAULT_PLAYERS.map(player => <div key={player.name} style={{ textAlign: 'center', color: player.color, fontWeight: 700 }}>{player.name}<small style={{ display: 'block', color: '#8192a8', fontWeight: 400, marginTop: 4 }}>{player.archetype}</small></div>)}
        </div>
      </div>
    </main>
  );
}
