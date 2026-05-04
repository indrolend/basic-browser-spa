// Lightweight orb rendered on 2D canvas (no external dependencies).
// Surface vertices spring toward the pointer for a solid deformable feel.
export function initOrbHero3D(canvas, manager) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { destroy() {} };

  // Gesture thresholds
  const TRACK_PULL_THRESHOLD_PX = 72;
  const VOLUME_DRAG_PX = 120;
  const DOMINANCE_GATE_RATIO = 1.35;
  const MIN_GESTURE_PX = 12;

  // Surface mesh — vertices evenly spaced around the orb perimeter
  const VERT_COUNT = 72;
  const SPRING_K = 0.18;
  const SPRING_DAMP = 0.78;
  // Fraction of dynamic radius within which a vertex responds to the pointer
  const INFLUENCE_RADIUS_RATIO = 0.72;

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

  const verts = Array.from({ length: VERT_COUNT }, (_, i) => ({
    angle: (i / VERT_COUNT) * Math.PI * 2,
    ix: 0,
    iy: 0,
    ivx: 0,
    ivy: 0,
  }));

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

  // Advance each surface vertex spring toward its target offset.
  function updateVerts(dynRadius) {
    const influenceRadius = dynRadius * INFLUENCE_RADIUS_RATIO;
    const dragLen = Math.sqrt(pullDx * pullDx + pullDy * pullDy) || 1;
    const dragDirX = pullDx / dragLen;
    const dragDirY = pullDy / dragLen;
    const dragNorm = dragging
      ? Math.min(1, Math.sqrt(pullDx * pullDx + pullDy * pullDy) / TRACK_PULL_THRESHOLD_PX)
      : 0;

    for (let i = 0; i < VERT_COUNT; i++) {
      const v = verts[i];
      const baseX = centerX + Math.cos(v.angle) * dynRadius;
      const baseY = centerY + Math.sin(v.angle) * dynRadius;
      const dx = pointerX - baseX;
      const dy = pointerY - baseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const influence = dragging ? Math.max(0, 1 - dist / influenceRadius) ** 2 : 0;

      let targetIX = 0;
      let targetIY = 0;
      if (influence > 0) {
        // Vertex clings toward pointer and is pushed in the drag direction.
        targetIX = influence * (dx * 0.14 + dragDirX * dynRadius * dragNorm * 0.2);
        targetIY = influence * (dy * 0.14 + dragDirY * dynRadius * dragNorm * 0.2);
      }

      v.ivx = v.ivx * SPRING_DAMP + (targetIX - v.ix) * SPRING_K;
      v.ivy = v.ivy * SPRING_DAMP + (targetIY - v.iy) * SPRING_K;
      v.ix += v.ivx;
      v.iy += v.ivy;
    }
  }

  // Smooth closed path through the deformed surface vertices (midpoint bezier).
  function buildSurfacePath(dynRadius) {
    ctx.beginPath();
    for (let i = 0; i < VERT_COUNT; i++) {
      const v = verts[i];
      const vn = verts[(i + 1) % VERT_COUNT];
      const x = centerX + Math.cos(v.angle) * dynRadius + v.ix;
      const y = centerY + Math.sin(v.angle) * dynRadius + v.iy;
      const nx = centerX + Math.cos(vn.angle) * dynRadius + vn.ix;
      const ny = centerY + Math.sin(vn.angle) * dynRadius + vn.iy;
      const mx = (x + nx) * 0.5;
      const my = (y + ny) * 0.5;
      if (i === 0) ctx.moveTo(mx, my);
      ctx.quadraticCurveTo(x, y, mx, my);
    }
    ctx.closePath();
  }

  function drawGlow(dynRadius, baseAlpha) {
    const glow = ctx.createRadialGradient(
      centerX, centerY, dynRadius * 0.4,
      centerX, centerY, dynRadius * 1.3
    );
    glow.addColorStop(0, `rgba(94,232,125,${(0.18 * baseAlpha).toFixed(3)})`);
    glow.addColorStop(1, 'rgba(94,232,125,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  }

  function drawSphere(dynRadius, baseAlpha) {
    buildSurfacePath(dynRadius);

    // Gradient lit from upper-left so the orb reads as a solid mass.
    const body = ctx.createRadialGradient(
      centerX - dynRadius * 0.28, centerY - dynRadius * 0.3, dynRadius * 0.1,
      centerX, centerY, dynRadius * 1.05
    );
    body.addColorStop(0,    `rgba(190,255,220,${baseAlpha.toFixed(3)})`);
    body.addColorStop(0.25, `rgba(124,244,174,${baseAlpha.toFixed(3)})`);
    body.addColorStop(0.65, `rgba(68,192,122,${baseAlpha.toFixed(3)})`);
    body.addColorStop(1,    `rgba(26,90,60,${baseAlpha.toFixed(3)})`);
    ctx.fillStyle = body;
    ctx.fill();

    // Rim highlight traces the deformed outline.
    ctx.strokeStyle = `rgba(160,255,200,${(0.28 * baseAlpha).toFixed(3)})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function draw() {
    const freq = manager.getAnalyserData ? manager.getAnalyserData() : null;
    const bass = averageRange(freq, 0, 8);
    const high = averageRange(freq, 42, 96);

    pulse += 0.035 + high * 0.03;

    const baseAlpha = manager.musicEnabled === false ? 0.55 : 1;
    const dynRadius = radius * (1 + bass * 0.12 + Math.sin(pulse) * 0.012);

    ctx.clearRect(0, 0, width, height);

    updateVerts(dynRadius);
    drawGlow(dynRadius, baseAlpha);
    drawSphere(dynRadius, baseAlpha);

    raf = requestAnimationFrame(draw);
  }

  function onPointerDown(e) {
    if (manager.unlock) manager.unlock();
    dragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    const rect = canvas.getBoundingClientRect();
    pointerX = e.clientX - rect.left;
    pointerY = e.clientY - rect.top;
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
