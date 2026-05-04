// OrbHero3D.js — 3D music orb hero using three.js (vanilla, no build tools)
// Usage: import and call initOrbHero3D(canvas, manager)

export function initOrbHero3D(canvas, manager) {
  // Ensure three.js is loaded
  if (!window.THREE) {
    throw new Error('three.js not loaded. Add <script src="https://unpkg.com/three@0.152.2/build/three.min.js"></script> to your HTML.');
  }

  // Scene setup
  const scene = new THREE.Scene();
  const width = canvas.clientWidth || 280;
  const height = canvas.clientHeight || 280;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x000000, 0); // transparent background

  // Camera
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.z = 3.5;

  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);
  const directional = new THREE.DirectionalLight(0xffffff, 0.8);
  directional.position.set(2, 2, 3);
  scene.add(directional);

  // Sphere geometry & material
  const geometry = new THREE.SphereGeometry(1, 64, 64);
  // Store original vertex positions for deformation
  const basePositions = geometry.attributes.position.array.slice();
  const material = new THREE.MeshPhongMaterial({
    color: 0x44aa88,
    shininess: 60,
    specular: 0x222222,
    flatShading: false,
  });
  const sphere = new THREE.Mesh(geometry, material);
  scene.add(sphere);

  // Animation state
  let raf = null;
  let dragging = false;
  let lastX = 0, lastY = 0;
  let rotationY = 0, rotationX = 0;
  let autoSpin = 0.008; // gentle spin speed
  let dragInfluence = { x: 0, y: 0, active: false };

  // Pointer controls (simple rotation)
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    dragInfluence.active = true;
    dragInfluence.x = 0;
    dragInfluence.y = 0;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = (e.clientX - lastX) / width;
    const dy = (e.clientY - lastY) / height;
    rotationY += dx * Math.PI;
    rotationX += dy * Math.PI;
    // Store drag direction for surface influence
    dragInfluence.x += dx;
    dragInfluence.y += dy;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  canvas.addEventListener('pointerup', (e) => {
    dragging = false;
    dragInfluence.active = false;
    canvas.releasePointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointercancel', (e) => {
    dragging = false;
    dragInfluence.active = false;
  });

  // Animation loop
  function animate() {
    // Audio reactivity: bulge surface with frequency peaks
    if (manager && manager.getAnalyserData) {
      const freq = manager.getAnalyserData();
      const pos = geometry.attributes.position;
      const orig = basePositions;
      if (freq && pos && orig) {
        // Map frequency bins to latitude bands
        const freqBins = freq.length;
        // Compute drag direction as a unit vector (if dragging)
        let dragTheta = 0, dragPhi = 0, dragMag = 0;
        if (dragInfluence.active) {
          dragMag = Math.sqrt(dragInfluence.x * dragInfluence.x + dragInfluence.y * dragInfluence.y);
          if (dragMag > 0.001) {
            dragTheta = Math.PI / 2 + dragInfluence.y * 2.5; // vertical drag
            dragPhi = dragInfluence.x * 5.0; // horizontal drag
          }
        }
        for (let i = 0; i < pos.count; i++) {
          // Get original vertex
          const ox = orig[i * 3];
          const oy = orig[i * 3 + 1];
          const oz = orig[i * 3 + 2];
          // Spherical coordinates
          const r = Math.sqrt(ox * ox + oy * oy + oz * oz);
          const theta = Math.acos(oy / r); // polar
          const phi = Math.atan2(oz, ox);  // azimuthal
          // Map theta to a frequency bin
          let bin = Math.floor((theta / Math.PI) * (freqBins - 1));
          bin = Math.max(0, Math.min(freqBins - 1, bin));
          const f = freq[bin] / 255;
          // Bulge outward based on frequency (peaks try to escape)
          let bulge = 1.0 + f * 0.22;
          // If dragging, add extra bulge in drag direction
          if (dragInfluence.active && dragMag > 0.001) {
            // Compute angular distance from this vertex to drag direction
            const dTheta = theta - dragTheta;
            const dPhi = phi - dragPhi;
            // Use a Gaussian-like falloff for influence
            const angDist = Math.sqrt(dTheta * dTheta + dPhi * dPhi);
            const dragEffect = Math.exp(-angDist * 6.0) * Math.min(1, dragMag * 2.5);
            bulge += dragEffect * 0.33; // drag bulge strength
          }
          pos.setXYZ(i, ox * bulge, oy * bulge, oz * bulge);
        }
        pos.needsUpdate = true;
        geometry.computeVertexNormals();
      }
    }
    // Gentle auto-spin for visibility
    if (!dragging) {
      rotationY += autoSpin;
    }
    sphere.rotation.y = rotationY;
    sphere.rotation.x = rotationX;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(animate);
  }
  animate();

  // Resize handler
  function handleResize() {
    const w = canvas.clientWidth || 280;
    const h = canvas.clientHeight || 280;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', handleResize);

  return {
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      scene.clear();
    }
  };
}
