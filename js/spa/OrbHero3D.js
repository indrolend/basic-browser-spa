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
  const geometry = new THREE.SphereGeometry(0.7, 64, 64);
  // Store original vertex positions for deformation
  const basePositions = geometry.attributes.position.array.slice();
  const material = new THREE.MeshPhongMaterial({
    color: 0x44aa88,
    shininess: 60,
    specular: 0x222222,
    flatShading: false,
    transparent: true,
    opacity: 0.92,
  });
  const sphere = new THREE.Mesh(geometry, material);
  scene.add(sphere);

  // Add wireframe overlay for depth perception
  const wireMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    wireframe: true,
    opacity: 0.38,
    transparent: true,
    depthTest: true,
    blending: THREE.AdditiveBlending,
  });
  const wireframe = new THREE.Mesh(geometry, wireMaterial);
  scene.add(wireframe);

  // Animation state
  let raf = null;
  let dragging = false;
  let lastX = 0, lastY = 0;
  let rotationY = 0, rotationX = 0;
  // No auto-spin, no camera rotation
  let dragInfluence = { x: 0, y: 0, active: false };
  let dragStartX = 0, dragStartY = 0;
  let dragStartVolume = 1.0;

  let dragDx = 0, dragDy = 0;

  // Surface tension spring state
  let surfacePull = { value: 0, velocity: 0, target: 0 };

  // Elastic center state
  let centerTarget = { x: 0, y: 0 };
  let centerPos = { x: 0, y: 0 };
  let centerVel = { x: 0, y: 0 };

  // Pointer controls (simple rotation)
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragDx = 0;
    dragDy = 0;
    dragInfluence.active = true;
    dragInfluence.x = 0;
    dragInfluence.y = 0;
    dragStartVolume = manager && manager.getUserVolume ? manager.getUserVolume() : 1.0;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = (e.clientX - lastX) / width;
    const dy = (e.clientY - lastY) / height;
    // No camera rotation
    // Store drag direction for surface influence
    dragInfluence.x += dx;
    dragInfluence.y += dy;
    dragDx = e.clientX - dragStartX;
    dragDy = e.clientY - dragStartY;
    // Volume control (vertical drag)
    if (Math.abs(dragDy) > Math.abs(dragDx) * 1.4 && Math.abs(dragDy) > 8 && manager && manager.setUserVolume) {
      const VOLUME_DRAG_PX = 120;
      manager.setUserVolume(dragStartVolume - dragDy / VOLUME_DRAG_PX);
    }
    // Set elastic center target (normalized to canvas size)
    centerTarget.x = dragDx / (width * 0.5);
    centerTarget.y = dragDy / (height * 0.5);
    // Set surface tension target to current drag length
    const dragLen = Math.sqrt(dragDx * dragDx + dragDy * dragDy);
    surfacePull.target = Math.min(1, dragLen / 72);
    lastX = e.clientX;
    lastY = e.clientY;
  });
  canvas.addEventListener('pointerup', (e) => {
    dragging = false;
    dragInfluence.active = false;
    canvas.releasePointerCapture(e.pointerId);

    // Controls: horizontal pull-and-release for song change, tap for play/pause
    const TRACK_PULL_THRESHOLD_PX = 72;
    const totalMove = Math.max(Math.abs(dragDx), Math.abs(dragDy));
    let didTrackChange = false;
    if (Math.abs(dragDx) > Math.abs(dragDy) * 1.4 && Math.abs(dragDx) > TRACK_PULL_THRESHOLD_PX * 0.92) {
      if (dragDx > 0) {
        manager && manager.nextTrack && manager.nextTrack();
      } else {
        manager && manager.prevTrack && manager.prevTrack();
      }
      didTrackChange = true;
    } else if (totalMove < 12) {
      manager && manager.toggleEnabled && manager.toggleEnabled();
    }
    // On release, set elastic center target back to origin (recoil)
    centerTarget.x = 0;
    centerTarget.y = 0;
    // On release, set surface tension target to zero (snap back)
    surfacePull.target = 0;
    // Reset drag deltas
    dragDx = 0;
    dragDy = 0;
  });
  canvas.addEventListener('pointercancel', (e) => {
    dragging = false;
    dragInfluence.active = false;
  });

  // Animation loop

  // --- BPM/Audio bounce state ---
  // You can set this to a fixed value or expose from manager
  let bpm = 110; // fallback BPM if not available
  let bouncePhase = 0;

  function getAudioLoudness() {
    if (manager && manager.getWaveformData) {
      const wave = manager.getWaveformData();
      if (wave) {
        // Compute RMS (root mean square) loudness
        let sum = 0;
        for (let i = 0; i < wave.length; ++i) {
          const v = (wave[i] - 128) / 128;
          sum += v * v;
        }
        return Math.sqrt(sum / wave.length);
      }
    }
    return 0.1;
  }

  function animate() {

    // --- Orb bounce based on BPM and loudness ---
    // Use BPM if available, otherwise fallback
    let songBpm = bpm;
    if (manager && typeof manager.getBpm === 'function') {
      songBpm = manager.getBpm() || bpm;
    }
    // Advance phase by BPM
    bouncePhase += (songBpm / 60) * 0.04; // 0.04 ~ 60fps
    if (bouncePhase > Math.PI * 2) bouncePhase -= Math.PI * 2;
    // Get loudness (RMS)
    const loudness = getAudioLoudness();
    // Bounce amplitude (tweakable)
    const bounceAmp = 0.13 + loudness * 0.22;
    // Sine bounce (vertical)
    const bounceY = Math.abs(Math.sin(bouncePhase)) * bounceAmp;
    // Optionally, add a little horizontal sway
    const bounceX = Math.sin(bouncePhase * 0.5) * bounceAmp * 0.18;
    // Add bounce to center target
    const userTargetX = centerTarget.x;
    const userTargetY = centerTarget.y;
    centerTarget.x = userTargetX + bounceX;
    centerTarget.y = userTargetY + bounceY;

    // Elastic center spring physics (simple damped spring)
    // Parameters: stiffness, damping
    const k = 0.18; // spring stiffness
    const d = 0.72; // damping
    // Spring force toward target
    const fx = (centerTarget.x - centerPos.x) * k;
    const fy = (centerTarget.y - centerPos.y) * k;
    centerVel.x = centerVel.x * d + fx;
    centerVel.y = centerVel.y * d + fy;
    centerPos.x += centerVel.x;
    centerPos.y += centerVel.y;

    // Restore user drag target for next frame
    centerTarget.x = userTargetX;
    centerTarget.y = userTargetY;

    // Surface tension spring (same params for simplicity)
    const sk = 0.18;
    const sd = 0.72;
    const sForce = (surfacePull.target - surfacePull.value) * sk;
    surfacePull.velocity = surfacePull.velocity * sd + sForce;
    surfacePull.value += surfacePull.velocity;

    // Audio reactivity + elastic squash/stretch (kendama effect)
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
        // 2D grid squash/stretch: drag X stretches X, drag Y stretches Y
        const springX = centerPos.x; // horizontal drag
        const springY = centerPos.y; // vertical drag
        // Compute drag direction and amount for additive displacement
        let pullDirX = 0, pullDirY = 0, pullAmount = 0;
        if (dragInfluence.active && (Math.abs(dragDx) > 2 || Math.abs(dragDy) > 2)) {
          const dragLen = Math.sqrt(dragDx * dragDx + dragDy * dragDy) || 1;
          pullDirX = dragDx / dragLen;
          pullDirY = -dragDy / dragLen;
        }
        // Use spring-driven pullAmount for tension
        pullAmount = surfacePull.value * 0.35;
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
          // If dragging, add extra bulge in drag direction (localized)
          if (dragInfluence.active && dragMag > 0.001) {
            const dTheta = theta - dragTheta;
            const dPhi = phi - dragPhi;
            const angDist = Math.sqrt(dTheta * dTheta + dPhi * dPhi);
            const dragEffect = Math.exp(-angDist * 12.0) * Math.min(1, dragMag * 2.5);
            bulge += dragEffect * 0.33;
          }
          // Radial (audio) component
          const radialX = ox * bulge;
          const radialY = oy * bulge;
          const radialZ = oz * bulge;
          // Directional (drag) component
          // Local influence: only vertices in drag direction get pulled
          let localInfluence = 0;
          if (dragInfluence.active && (Math.abs(dragDx) > 2 || Math.abs(dragDy) > 2)) {
            // Project vertex direction onto drag direction
            const vLen = Math.sqrt(ox * ox + oy * oy);
            let dirX = 0, dirY = 0;
            if (vLen > 0.0001) {
              dirX = ox / vLen;
              dirY = oy / vLen;
            }
            const dot = dirX * pullDirX + dirY * pullDirY;
            if (dot > 0.15) localInfluence = dot;
          }
          // Final position: radial + directional pull
          pos.setXYZ(i,
            radialX + pullDirX * pullAmount * localInfluence,
            radialY + pullDirY * pullAmount * localInfluence,
            radialZ
          );
        }
        pos.needsUpdate = true;
        geometry.computeVertexNormals();
      }
    }
    // No auto-spin; keep orb stationary
    sphere.rotation.y = 0;
    sphere.rotation.x = 0;
    wireframe.rotation.y = 0;
    wireframe.rotation.x = 0;
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
