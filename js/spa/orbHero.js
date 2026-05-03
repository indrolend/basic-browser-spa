export function initOrbHero(canvas, manager) {
  const ctx = canvas.getContext('2d');
  let raf = null;
  let angle = 0;
  let spinVelocity = 0.005;
  let dragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let pullDx = 0;
  let pullDy = 0;
  // Armed only when horizontal movement clearly dominates — grabs playback for scrubbing
  let pullArmed = false;
  // Armed only when vertical movement clearly dominates — controls volume
  let volumeArmed = false;
  let dragStartVolume = 1.0;
  // Playback state captured when horizontalGrab arms; restored on release
  let wasPlaying = false;
  let dragStartTime = 0;

  // Ferrofluid hold/stretch/release state — all animated via lerp, no per-frame allocations
  let holdStrength   = 0;   // 0→1: how "grabbed" the orb currently feels
  let tension        = 0;   // 0→1: stretch magnitude from drag distance
  let pointerX       = 0;   // canvas-relative pointer position (updated on down/move)
  let pointerY       = 0;

  const TRACK_PULL_THRESHOLD_PX = 72;
  // 120px vertical drag spans the full 0–1 volume range
  const VOLUME_DRAG_PX = 120;
  const BASE_SPIN = 0.005;
  // Seconds of audio scrubbed per pixel of horizontal drag (72 px ≈ 10 s)
  const SCRUB_RATE = 0.14;
  // Shared thresholds for both dominance gates
  const DOMINANCE_GATE_RATIO = 1.4;
  const MIN_GESTURE_PX = 12;

  // Single unified blob particle pool — allocated once, never recreated in draw()
  const N = 144;
  const pts = Array.from({ length: N }, (_, i) => {
    const t = i / N;
    return {
      a:   t * Math.PI * 2,             // evenly-spaced base angle
      r:   0.82 + Math.random() * 0.36, // base radius multiplier (variance gives blob depth)
      ph:  Math.random() * Math.PI * 2, // shimmer/wobble phase
      bin: Math.floor(t * 96),          // freq bin 0–95 (bass → highs)
      d:   Math.random(),               // depth 0–1 for alpha layering
    };
  });

  function resize() {
    const size = Math.min(canvas.clientWidth || 260, canvas.clientHeight || 260, 300);
    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, size, size);
  }

  function draw() {
    // While the orb is grabbed, freeze idle spin; on release the lerp eases it back in naturally
    if (!dragging) {
      spinVelocity += (BASE_SPIN - spinVelocity) * 0.06;
    }
    angle += spinVelocity;

    // Lerp holdStrength and tension each frame — drives blob scale and particle attraction
    holdStrength += ((dragging ? 1 : 0) - holdStrength) * 0.12;
    const dragDist    = Math.sqrt(pullDx * pullDx + pullDy * pullDy);
    const tensionTarget = dragging ? Math.min(1, dragDist / TRACK_PULL_THRESHOLD_PX) : 0;
    tension += (tensionTarget - tension) * 0.10;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const baseR = w * 0.30 * (0.5 + (manager.getUserVolume ? manager.getUserVolume() : 1.0) * 0.5);

    const freq   = manager.getAnalyserData();
    const wave   = manager.getWaveformData();
    const paused = manager.audio.paused || !manager.musicEnabled;

    // frequency band averages
    let bass = 0, mid = 0, high = 0;
    if (freq) {
      for (let i = 0; i < 4; i++)   bass += freq[i];
      bass = (bass / 4) / 255;
      for (let i = 8; i < 40; i++)  mid  += freq[i];
      mid  = (mid  / 32) / 255;
      for (let i = 48; i < 96; i++) high += freq[i];
      high = (high / 48) / 255;
    }

    // ── Trail fade ──
    ctx.globalAlpha = 1;
    ctx.fillStyle = paused ? 'rgba(17,17,17,0.12)' : 'rgba(17,17,17,0.20)';
    ctx.fillRect(0, 0, w, h);

    const userVol = manager.getUserVolume ? manager.getUserVolume() : 1.0;
    const masterAlpha = (paused ? 0.28 : 1.0) * (0.35 + userVol * 0.65);

    // Pointer influence — precomputed, no per-frame allocations
    // isPulling only true when pull mode is armed (horizontal dominance confirmed)
    const isPulling  = dragging && pullArmed && Math.abs(pullDx) > 4;
    const pullNorm   = isPulling ? Math.min(1, Math.abs(pullDx) / TRACK_PULL_THRESHOLD_PX) : 0;
    const stretchDir = pullDx >= 0 ? 1 : -1;

    // Press-only (finger down, no pull yet): slightly compress the blob inward
    const pressScale = (dragging && !isPulling) ? 0.93 : 1.0;

    // Bass expands the whole blob; hold compresses it slightly; tension stretches it
    const blobScale = pressScale * (1.0 + bass * 0.22) * (1 + tension * 0.2) * (1 - holdStrength * 0.1);

    // Subtle audio slowdown while held — skip when scrubbing (audio already paused by pullArmed)
    if (!pullArmed && manager.audio) {
      manager.audio.playbackRate = 1 - holdStrength * 0.15;
    }

    ctx.save();
    ctx.translate(cx, cy);
    // No ctx.rotate — rotation baked into pa so deformations apply in canvas/screen space

    // ── Unified blob — audio + pointer state deform the same particle field ──
    for (let i = 0; i < N; i++) {
      const p   = pts[i];
      const amp = freq ? freq[p.bin] / 255 : 0;

      // Radial deformation: base radius + per-particle variance + freq push + scale
      let r = baseR * p.r * blobScale + amp * baseR * 0.45;

      // Waveform bends each particle's radius (uses stable base angle p.a, not rotated pa)
      if (wave) {
        const wIdx    = Math.floor(((p.a / (Math.PI * 2)) + 0.5) % 1 * (wave.length - 1));
        const wSample = (wave[wIdx] - 128) / 128;   // –1 to 1
        r += wSample * baseR * mid * 0.18;
      }

      // High-frequency shimmer: per-particle phase-driven radius flicker
      const shimmer = Math.sin(p.ph + angle * 4 + i * 0.3) * 0.5 + 0.5;
      r += high * shimmer * baseR * 0.12;

      // Effective angle: base + rotation + mid wobble — all baked so (px,py) is in screen space
      const pa = p.a + angle + mid * 0.12 * Math.sin(p.ph + angle * 2);
      let px = Math.cos(pa) * r;
      let py = Math.sin(pa) * r;

      // ── Pointer deformation — stretch blob in pull direction ──
      if (isPulling) {
        // Asymmetric X stretch: pull-side particles expand, opposite side compresses
        const cosProj = Math.cos(pa);  // projection onto screen horizontal axis
        px *= (1.0 + pullNorm * 0.55 * stretchDir * cosProj);
        // Perpendicular squeeze (oval feel, conservation of mass)
        py *= (1.0 - pullNorm * 0.18);
        // Near-threshold snap: leading-edge particles surge to signal the snap point
        if (pullNorm > 0.78 && stretchDir * px > 0) {
          px += stretchDir * ((pullNorm - 0.78) / 0.22) * baseR * 0.18;
        }
      }

      // Pointer attraction — pull particles toward the held position (ferrofluid cling)
      if (holdStrength > 0) {
        const dpx = (pointerX - cx) - px;
        const dpy = (pointerY - cy) - py;
        px += dpx * holdStrength * 0.08;
        py += dpy * holdStrength * 0.08;
      }

      // Dot radius: amp + high shimmer; shrink when paused
      const szBase = paused ? 0.8 : 1.0;
      const sz = Math.max(0.5, szBase * (1.0 + amp * 3.2 + high * shimmer * 1.2));

      // Alpha: depth layer + amplitude; unified family reads as one mass
      ctx.globalAlpha = Math.min(1, (0.22 + p.d * 0.35 + amp * 0.42) * masterAlpha);
      ctx.fillStyle   = amp > 0.70 ? '#a0ffe0' : (amp > 0.40 ? '#7df0a8' : '#5ee87d');
      ctx.beginPath();
      ctx.arc(px, py, sz, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    raf = requestAnimationFrame(draw);
  }

  function trackPointer(e) {
    const rect = canvas.getBoundingClientRect();
    pointerX = e.clientX - rect.left;
    pointerY = e.clientY - rect.top;
  }

  function onPointerDown(e) {
    trackPointer(e);
    dragging = true;
    spinVelocity = 0;  // freeze the orb the moment it's grabbed
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    pullDx = 0;
    pullDy = 0;
    pullArmed   = false;
    volumeArmed = false;
    wasPlaying  = false;
    dragStartTime = 0;
    dragStartVolume = manager.getUserVolume ? manager.getUserVolume() : 1.0;
    canvas.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!dragging) return;
    trackPointer(e);
    pullDx = e.clientX - dragStartX;
    pullDy = e.clientY - dragStartY;

    // Arm horizontal grab mode — pause only once at the moment of arming
    if (!pullArmed && !volumeArmed &&
        Math.abs(pullDx) > Math.abs(pullDy) * DOMINANCE_GATE_RATIO &&
        Math.abs(pullDx) > MIN_GESTURE_PX) {
      pullArmed = true;
      // Capture playback state at arm time — we resume on release, not immediately
      wasPlaying = !(manager.audio.paused || !manager.musicEnabled);
      dragStartTime = manager.audio.currentTime;
      if (wasPlaying) manager.pause();
    }
    // Arm vertical volume mode — only when neither mode is latched yet
    if (!volumeArmed && !pullArmed &&
        Math.abs(pullDy) > Math.abs(pullDx) * DOMINANCE_GATE_RATIO &&
        Math.abs(pullDy) > MIN_GESTURE_PX) {
      volumeArmed = true;
    }

    // Volume mode: upward drag has negative pullDy, so subtracting it raises volume
    if (volumeArmed && manager.setUserVolume) {
      manager.setUserVolume(dragStartVolume - pullDy / VOLUME_DRAG_PX);
    }

    // Horizontal grab: scrub audio position + let pointer drive spin (no idle lerp)
    if (pullArmed) {
      manager.scrubToPosition(dragStartTime + pullDx * SCRUB_RATE);
      spinVelocity = (pullDx / TRACK_PULL_THRESHOLD_PX) * 0.03;
    }
  }

  function onPointerUp(e) {
    const totalMove = Math.max(Math.abs(pullDx), Math.abs(pullDy));

    // Tap: no mode armed and minimal movement → toggle play/pause
    if (!pullArmed && !volumeArmed && totalMove < MIN_GESTURE_PX) {
      manager.toggleEnabled();
    }

    // Horizontal grab: resume playback if it was playing before the grab
    if (pullArmed && wasPlaying) {
      manager.play();
    }

    // Restore normal playback rate (in case hold-slowdown was active)
    if (manager.audio) manager.audio.playbackRate = 1;

    // Inject a snap impulse from horizontal drag velocity — gives satisfying release feel
    const releaseImpulse = pullDx / TRACK_PULL_THRESHOLD_PX;
    spinVelocity += releaseImpulse * 0.05;

    dragging      = false;
    pullDx        = 0;
    pullDy        = 0;
    pullArmed     = false;
    volumeArmed   = false;
    wasPlaying    = false;
    dragStartTime = 0;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
  }

  resize();
  draw();
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup',   onPointerUp);
  window.addEventListener('resize',      resize);

  return {
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup',   onPointerUp);
      window.removeEventListener('resize',      resize);
    }
  };
}
