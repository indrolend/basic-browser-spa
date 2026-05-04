// True 3D orb on 2D canvas (no external dependencies).
// Surface deformation is applied on a spherical mesh, then projected to screen.
export function initOrbHero3D(canvas, manager) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { destroy() {} };

  const TRACK_PULL_THRESHOLD_PX = 72;
  const VOLUME_DRAG_PX = 120;
  const DOMINANCE_GATE_RATIO = 1.35;
  const MIN_GESTURE_PX = 12;

  // Sphere mesh resolution.
  const LAT_SEG = 18;
  const LON_SEG = 30;

  // Spike tuning.
  const SPIKE_GAIN = 0.34;
  const SPIKE_RESPONSE = 0.28;
  const SPIKE_SHARPNESS = 2.2;
  const SPIKE_IDLE = 0.02;

  let raf = null;
  let width = 280;
  let height = 280;
  let centerX = 140;
  let centerY = 140;
  let radius = 90;

  let dragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let pullDx = 0;
  let pullDy = 0;
  let pullArmed = false;
  let volumeArmed = false;
  let dragStartVolume = 1;
  let pointerX = centerX;
  let pointerY = centerY;

  let pulse = 0;

  // Vertex data in object space.
  const verts = [];
  for (let i = 0; i <= LAT_SEG; i++) {
    const v = i / LAT_SEG;
    const theta = v * Math.PI;
    for (let j = 0; j <= LON_SEG; j++) {
      const u = j / LON_SEG;
      const phi = u * Math.PI * 2;
      const sx = Math.sin(theta) * Math.cos(phi);
      const sy = Math.cos(theta);
      const sz = Math.sin(theta) * Math.sin(phi);
      verts.push({
        x: sx,
        y: sy,
        z: sz,
        spike: 0,
        bin: Math.floor((u * 0.6 + v * 0.4) * 127),
      });
    }
  }

  const stride = LON_SEG + 1;

  function resize() {
    const size = Math.max(220, Math.min(canvas.clientWidth || 280, canvas.clientHeight || 280));
    canvas.width = size;
    canvas.height = size;
    width = size;
    height = size;
    centerX = width * 0.5;
    centerY = height * 0.5;
    radius = width * 0.34;
  }

  function averageRange(data, start, end) {
    if (!data || !data.length) return 0;
    const s = Math.max(0, start);
    const e = Math.min(data.length, end);
    if (e <= s) return 0;
    let sum = 0;
    for (let i = s; i < e; i++) sum += data[i];
    return (sum / (e - s)) / 255;
  }

  function rotateDir(x, y, z, ax, ay) {
    const cosX = Math.cos(ax);
    const sinX = Math.sin(ax);
    const cosY = Math.cos(ay);
    const sinY = Math.sin(ay);

    const y1 = y * cosX - z * sinX;
    const z1 = y * sinX + z * cosX;

    const x2 = x * cosY + z1 * sinY;
    const z2 = -x * sinY + z1 * cosY;

    return { x: x2, y: y1, z: z2 };
  }

  function pointerDirOnSphere(dynRadius) {
    const nx = (pointerX - centerX) / Math.max(1, dynRadius);
    const ny = (pointerY - centerY) / Math.max(1, dynRadius);
    const r2 = nx * nx + ny * ny;

    if (r2 <= 1) {
      return { x: nx, y: ny, z: Math.sqrt(1 - r2) };
    }

    const len = Math.sqrt(r2) || 1;
    return { x: nx / len, y: ny / len, z: 0 };
  }

  function draw() {
    const freq = manager.getAnalyserData ? manager.getAnalyserData() : null;
    const bass = averageRange(freq, 0, 8);
    const high = averageRange(freq, 42, 96);

    pulse += 0.035 + high * 0.03;

    const baseAlpha = manager.musicEnabled === false ? 0.55 : 1;
    const dynRadius = radius * (1 + bass * 0.12 + Math.sin(pulse) * 0.012);

    // No drag-rotation. Keep tiny ambient 3D motion for depth readability.
    const ambientRotX = Math.sin(pulse * 0.23) * 0.08;
    const ambientRotY = Math.cos(pulse * 0.19) * 0.1;

    const dragLen = Math.sqrt(pullDx * pullDx + pullDy * pullDy) || 1;
    const dragDirX = pullDx / dragLen;
    const dragDirY = pullDy / dragLen;
    const dragNorm = dragging
      ? Math.min(1, Math.sqrt(pullDx * pullDx + pullDy * pullDy) / TRACK_PULL_THRESHOLD_PX)
      : 0;

    const pointerDir = pointerDirOnSphere(dynRadius);
    const light = { x: -0.38, y: -0.45, z: 0.81 };

    ctx.clearRect(0, 0, width, height);

    // Back glow.
    const glow = ctx.createRadialGradient(centerX, centerY, dynRadius * 0.45, centerX, centerY, dynRadius * 1.32);
    glow.addColorStop(0, `rgba(94,232,125,${(0.16 * baseAlpha).toFixed(3)})`);
    glow.addColorStop(1, 'rgba(94,232,125,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    // Precompute transformed and projected vertices.
    const transformed = new Array(verts.length);
    const projected = new Array(verts.length);
    const freqLen = freq && freq.length ? freq.length : 0;

    for (let i = 0; i < verts.length; i++) {
      const v = verts[i];
      const dir = rotateDir(v.x, v.y, v.z, ambientRotX, ambientRotY);

      let amp = 0;
      if (freqLen > 0) {
        const b = Math.min(freqLen - 1, v.bin);
        amp = freq[b] / 255;
      }

      // Tight directional influence around pointer-contact point on sphere.
      const pointerDot = Math.max(0, dir.x * pointerDir.x + dir.y * pointerDir.y + dir.z * pointerDir.z);
      const pointerInfluence = dragging ? Math.pow(pointerDot, 14) : 0;

      // Pull adds directional bias in screen x/y while preserving 3D locality.
      const pullBias = pointerInfluence * dragNorm * 0.28 * (dir.x * dragDirX + dir.y * dragDirY);

      const noise = Math.sin(pulse * 2.8 + i * 0.73) * 0.5 + 0.5;
      const spikeTarget = (Math.pow(amp, SPIKE_SHARPNESS) * SPIKE_GAIN)
        + SPIKE_IDLE * noise
        + pointerInfluence * 0.26
        + pullBias;

      v.spike += (spikeTarget - v.spike) * SPIKE_RESPONSE;

      const radial = 1 + v.spike;
      const px3 = dir.x * dynRadius * radial;
      const py3 = dir.y * dynRadius * radial;
      const pz3 = dir.z * dynRadius * radial;

      const perspective = 1 / (1.72 - (pz3 / Math.max(1, dynRadius)) * 0.88);
      const sx = centerX + px3 * perspective;
      const sy = centerY + py3 * perspective;

      transformed[i] = { x: px3, y: py3, z: pz3 };
      projected[i] = { x: sx, y: sy, p: perspective };
    }

    // Draw mesh tiles with painter's sort (back to front).
    const tiles = [];
    for (let i = 0; i < LAT_SEG; i++) {
      for (let j = 0; j < LON_SEG; j++) {
        const i0 = i * stride + j;
        const i1 = i * stride + (j + 1);
        const i2 = (i + 1) * stride + (j + 1);
        const i3 = (i + 1) * stride + j;

        const zAvg = (transformed[i0].z + transformed[i1].z + transformed[i2].z + transformed[i3].z) * 0.25;
        // Cull deeper back faces to avoid translucent-inside look.
        if (zAvg < -dynRadius * 0.08) continue;

        const nx = (transformed[i0].x + transformed[i1].x + transformed[i2].x + transformed[i3].x) * 0.25;
        const ny = (transformed[i0].y + transformed[i1].y + transformed[i2].y + transformed[i3].y) * 0.25;
        const nz = (transformed[i0].z + transformed[i1].z + transformed[i2].z + transformed[i3].z) * 0.25;
        const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        const ndx = nx / nLen;
        const ndy = ny / nLen;
        const ndz = nz / nLen;
        const lit = Math.max(0, ndx * light.x + ndy * light.y + ndz * light.z);

        tiles.push({ i0, i1, i2, i3, z: zAvg, lit });
      }
    }

    tiles.sort((a, b) => a.z - b.z);

    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      const b = 0.25 + t.lit * 0.75;
      const r = Math.floor(24 + b * 98);
      const g = Math.floor(88 + b * 156);
      const bl = Math.floor(56 + b * 94);
      ctx.fillStyle = `rgba(${r},${g},${bl},${(0.985 * baseAlpha).toFixed(3)})`;

      ctx.beginPath();
      ctx.moveTo(projected[t.i0].x, projected[t.i0].y);
      ctx.lineTo(projected[t.i1].x, projected[t.i1].y);
      ctx.lineTo(projected[t.i2].x, projected[t.i2].y);
      ctx.lineTo(projected[t.i3].x, projected[t.i3].y);
      ctx.closePath();
      ctx.fill();
    }

    // Thin outer rim.
    ctx.strokeStyle = `rgba(170,255,210,${(0.22 * baseAlpha).toFixed(3)})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, dynRadius, 0, Math.PI * 2);
    ctx.stroke();

    raf = requestAnimationFrame(draw);
  }

  function onPointerDown(e) {
    if (manager.unlock) manager.unlock();
    dragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    canvas._lastPointerId = e.pointerId;  // Track for cleanup
    const rect = canvas.getBoundingClientRect();
    pointerX = e.clientX - rect.left;
    pointerY = e.clientY - rect.top;
    pullDx = 0;
    pullDy = 0;
    pullArmed = false;
    volumeArmed = false;
    dragStartVolume = manager.getUserVolume ? manager.getUserVolume() : 1;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      // Silently handle any errors setting capture
    }
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    pullDx = dx;
    pullDy = dy;

    const rect = canvas.getBoundingClientRect();
    pointerX = e.clientX - rect.left;
    pointerY = e.clientY - rect.top;

    if (!pullArmed && !volumeArmed && Math.abs(dx) > Math.abs(dy) * DOMINANCE_GATE_RATIO && Math.abs(dx) > MIN_GESTURE_PX) {
      pullArmed = true;
    }
    if (!volumeArmed && !pullArmed && Math.abs(dy) > Math.abs(dx) * DOMINANCE_GATE_RATIO && Math.abs(dy) > MIN_GESTURE_PX) {
      volumeArmed = true;
    }

    if (volumeArmed && manager.setUserVolume) {
      manager.setUserVolume(dragStartVolume - dy / VOLUME_DRAG_PX);
    }
  }

  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;
    try {
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
    } catch (err) {
      // Silently handle errors during capture release (e.g., detached node)
    }

    const totalMove = Math.max(Math.abs(pullDx), Math.abs(pullDy));
    if (pullArmed && Math.abs(pullDx) > TRACK_PULL_THRESHOLD_PX) {
      if (pullDx > 0) manager.nextTrack && manager.nextTrack();
      else manager.prevTrack && manager.prevTrack();
    } else if (totalMove < 10) {
      manager.toggleEnabled && manager.toggleEnabled();
    }

    pullDx = 0;
    pullDy = 0;
    pullArmed = false;
    volumeArmed = false;
  }

  function forceCleanup() {
    // Reset all gesture state to prevent getting stuck if drag is interrupted by DOM removal
    dragging = false;
    pullDx = 0;
    pullDy = 0;
    pullArmed = false;
    volumeArmed = false;
    
    // Attempt to release pointer capture if possible (may fail if canvas is detached)
    if (canvas.parentElement) {
      try {
        const pointerId = canvas._lastPointerId;
        if (pointerId !== undefined && canvas.hasPointerCapture(pointerId)) {
          canvas.releasePointerCapture(pointerId);
        }
      } catch (_) {
        // Silently ignore errors; canvas may be detached from DOM
      }
    }
  }

  resize();
  draw();

  function onLostPointerCapture() {
    // If we lose pointer capture unexpectedly, reset drag state
    forceCleanup();
  }

  window.addEventListener('resize', resize);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('lostpointercapture', onLostPointerCapture);

  return {
    destroy() {
      forceCleanup();
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('lostpointercapture', onLostPointerCapture);
    }
  };
}
