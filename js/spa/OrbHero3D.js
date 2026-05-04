// Lightweight 3D orb rendered on 2D canvas (no external dependencies).
export function initOrbHero3D(canvas, manager) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { destroy() {} };

  const POINT_COUNT = 420;
  const TRACK_PULL_THRESHOLD_PX = 72;
  const VOLUME_DRAG_PX = 120;
  const DOMINANCE_GATE_RATIO = 1.35;
  const MIN_GESTURE_PX = 12;
  const ROT_FRICTION = 0.94;
  const ROT_RETURN = 0.04;

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

  let rotX = -0.14;
  let rotY = 0.12;
  let rotVX = 0;
  let rotVY = 0;

  let pulse = 0;

  // Build an even point cloud on a sphere using a Fibonacci spiral.
  const points = Array.from({ length: POINT_COUNT }, (_, i) => {
    const t = i + 0.5;
    const y = 1 - (t / POINT_COUNT) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = Math.PI * (3 - Math.sqrt(5)) * i;
    return {
      x: Math.cos(theta) * r,
      y,
      z: Math.sin(theta) * r,
      p: Math.random() * Math.PI * 2,
      bin: i % 128,
    };
  });

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

  function rotatePoint(p, ax, ay) {
    const cosX = Math.cos(ax);
    const sinX = Math.sin(ax);
    const cosY = Math.cos(ay);
    const sinY = Math.sin(ay);

    // Rotate around X
    const y1 = p.y * cosX - p.z * sinX;
    const z1 = p.y * sinX + p.z * cosX;

    // Rotate around Y
    const x2 = p.x * cosY + z1 * sinY;
    const z2 = -p.x * sinY + z1 * cosY;

    return { x: x2, y: y1, z: z2 };
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

  function draw() {
    const freq = manager.getAnalyserData ? manager.getAnalyserData() : null;
    const bass = averageRange(freq, 0, 8);
    const mid = averageRange(freq, 10, 42);
    const high = averageRange(freq, 42, 96);

    pulse += 0.035 + high * 0.03;

    // Gesture-driven rotation and gentle settle back to center.
    if (!dragging) {
      rotVX *= ROT_FRICTION;
      rotVY *= ROT_FRICTION;
      rotX += (0 - rotX) * ROT_RETURN;
      rotY += (0 - rotY) * ROT_RETURN;
    }
    rotX += rotVX;
    rotY += rotVY;

    const volume = manager.getUserVolume ? manager.getUserVolume() : 1;
    const baseAlpha = manager.musicEnabled === false ? 0.55 : 1;
    const dynamicRadius = radius * (1 + bass * 0.12 + Math.sin(pulse) * 0.012);

    ctx.clearRect(0, 0, width, height);

    // Soft glow behind the sphere.
    const glow = ctx.createRadialGradient(centerX, centerY, dynamicRadius * 0.5, centerX, centerY, dynamicRadius * 1.35);
    glow.addColorStop(0, `rgba(94,232,125,${0.22 * baseAlpha})`);
    glow.addColorStop(1, 'rgba(94,232,125,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    // Project points and sort by depth for proper layering.
    const projected = [];
    const pullNorm = pullArmed ? Math.min(1, Math.abs(pullDx) / TRACK_PULL_THRESHOLD_PX) : 0;
    const stretchX = pullArmed ? (pullDx > 0 ? 1 : -1) : 0;

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const f = freq ? (freq[p.bin % freq.length] / 255) : 0;
      const wobble = 1 + f * 0.24 + Math.sin(pulse + p.p) * high * 0.1;
      const rotated = rotatePoint(p, rotX + mid * 0.1, rotY + mid * 0.14);

      // Subtle screen-space stretch when scrubbing horizontally.
      let sx = rotated.x;
      if (pullArmed && stretchX !== 0) {
        sx += rotated.x * stretchX * 0.18 * pullNorm;
      }

      const depth = rotated.z;
      const perspective = 1 / (1.65 - depth * 0.85);
      const px = centerX + sx * dynamicRadius * wobble * perspective;
      const py = centerY + rotated.y * dynamicRadius * wobble * perspective;
      const dot = (0.6 + depth * 0.4) * perspective;

      projected.push({
        px,
        py,
        depth,
        f,
        size: Math.max(0.7, (1.2 + f * 2.6) * perspective),
        alpha: Math.max(0.08, dot * (0.35 + volume * 0.65) * baseAlpha),
      });
    }

    projected.sort((a, b) => a.depth - b.depth);

    for (let i = 0; i < projected.length; i++) {
      const d = projected[i];
      const g = Math.floor(210 + d.f * 45);
      ctx.fillStyle = `rgba(94,${g},125,${d.alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(d.px, d.py, d.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Rim ring for shape readability.
    ctx.strokeStyle = `rgba(130,255,180,${(0.22 + bass * 0.2) * baseAlpha})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, dynamicRadius * (1 + pullNorm * 0.05), 0, Math.PI * 2);
    ctx.stroke();

    raf = requestAnimationFrame(draw);
  }

  function onPointerDown(e) {
    if (manager.unlock) manager.unlock();
    dragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    pullDx = 0;
    pullDy = 0;
    pullArmed = false;
    volumeArmed = false;
    dragStartVolume = manager.getUserVolume ? manager.getUserVolume() : 1;
    canvas.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    pullDx = dx;
    pullDy = dy;

    const ndx = dx / Math.max(1, width);
    const ndy = dy / Math.max(1, height);

    // Manual sphere rotation.
    rotVY = ndx * Math.PI * 0.7;
    rotVX = ndy * Math.PI * 0.7;

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
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);

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

  resize();
  draw();

  window.addEventListener('resize', resize);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  return {
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
    }
  };
}
