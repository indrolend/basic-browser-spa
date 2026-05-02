export function initOrbHero(canvas, manager) {
  const ctx = canvas.getContext('2d');
  let raf = null;
  let angle = 0;
  let spinVelocity = 0.005;
  let dragging = false;
  let dragStartTime = 0;
  let lastPointerAngle = 0;
  let accumulatedAngle = 0;  // total rotation since drag start (multi-wrap safe)
  let angularVelocity = 0;   // per-move angular delta — carries into spin on release
  let scratchEnergy = 0;     // 0–1, drives radial blob swell during active scratch
  let wasPlaying = false;    // restore play state on pointer up

  const BASE_SPIN = 0.005;
  // One full rotation (2π) maps to the full track duration
  const SCRATCH_SCALE = 1.0;
  // Per-frame multiplier for scratch energy decay (0.88 = ~12% decay per frame at 60fps)
  const ENERGY_DECAY = 0.88;

  // Single unified blob particle pool — allocated once, never recreated in draw()
  const N = 144;
  const pts = Array.from({ length: N }, (_, i) => {
    const t = i / N;
    return {
      a:   t * Math.PI * 2,          // evenly-spaced base angle
      r:   0.82 + Math.random() * 0.36, // base radius multiplier (variance gives blob depth)
      ph:  Math.random() * Math.PI * 2, // shimmer/wobble phase
      bin: Math.floor(t * 96),          // freq bin 0–95 (bass → highs)
      d:   Math.random(),               // depth 0–1 for alpha layering
    };
  });

  // Wrap an angular delta to the [−π, π] range so boundary crossing is handled cleanly
  function wrapDelta(d) {
    if (d >  Math.PI) return d - Math.PI * 2;
    if (d < -Math.PI) return d + Math.PI * 2;
    return d;
  }


    const size = Math.min(canvas.clientWidth || 260, canvas.clientHeight || 260, 300);
    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, size, size);
  }

  function pointAngle(x, y) {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    return Math.atan2(y - cy, x - cx);
  }

  function draw() {
    // Decay scratch energy toward zero each frame
    scratchEnergy *= ENERGY_DECAY;
    // Spin velocity decays toward idle speed only when not holding the orb
    if (!dragging) {
      spinVelocity += (BASE_SPIN - spinVelocity) * 0.06;
    }
    angle += spinVelocity;

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
    // Press compression: squish on initial contact, releases as scratch energy builds
    const pressScale = dragging ? (scratchEnergy > 0.1 ? 1.0 : 0.93) : 1.0;

    // Bass expands the whole blob; press compresses it
    const blobScale = pressScale * (1.0 + bass * 0.22);

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

      // Scratch energy: isotropic radial swell — blob pulses outward during active scratch
      r += scratchEnergy * baseR * 0.22;

      // Effective angle: base + rotation + mid wobble — all baked so (px,py) is in screen space
      const pa = p.a + angle + mid * 0.12 * Math.sin(p.ph + angle * 2);
      const px = Math.cos(pa) * r;
      const py = Math.sin(pa) * r;

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

  function onPointerDown(e) {
    wasPlaying = !manager.audio.paused && manager.musicEnabled;
    dragging = true;
    manager.audio.pause(); // user takes full control of playback position
    const rect = canvas.getBoundingClientRect();
    const pa = pointAngle(e.clientX - rect.left, e.clientY - rect.top);
    lastPointerAngle = pa;
    dragStartTime    = manager.audio.currentTime || 0;
    accumulatedAngle = 0;
    angularVelocity  = 0;
    scratchEnergy    = 0;
    canvas.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const rect = canvas.getBoundingClientRect();
    const nowA = pointAngle(e.clientX - rect.left, e.clientY - rect.top);

    // Per-move angular delta — wrap to [−π, π] so boundary crossing is handled
    const delta = wrapDelta(nowA - lastPointerAngle);

    angularVelocity   = delta;
    accumulatedAngle += delta;
    lastPointerAngle  = nowA;

    // Build scratch energy from rotation speed
    scratchEnergy = Math.min(1, scratchEnergy + Math.abs(delta) * 6);

    // Scrub playback: accumulated rotation maps linearly to track position
    const duration = manager.audio.duration || 0;
    if (duration > 0) {
      manager.scrubToPosition(dragStartTime + (accumulatedAngle / (Math.PI * 2)) * duration * SCRATCH_SCALE);
    }

    // Drive visual spin in the direction the user is rotating
    spinVelocity = angularVelocity;
  }

  function onPointerUp(e) {
    dragging = false;
    // Carry angular momentum into the blob spin (partial transfer for natural decay)
    spinVelocity = angularVelocity * 0.5;
    // Resume playback from the scrubbed position if audio was playing before
    if (wasPlaying) manager.play();
    wasPlaying      = false;
    angularVelocity = 0;
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
