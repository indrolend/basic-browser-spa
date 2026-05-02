export function initOrbHero(canvas, manager) {
  const ctx = canvas.getContext('2d');
  let raf = null;
  let angle = 0;
  let spinVelocity = 0.005;
  let dragging = false;
  let dragStartAngle = 0;
  let dragStartTime = 0;
  let dragStartX = 0;
  let pullDx = 0;
  let pullDy = 0;

  const TRACK_PULL_THRESHOLD_PX = 72;
  const BASE_SPIN = 0.005;
  const N = 80; // radial particles

  // Stable per-particle data (angle + shimmer phase)
  const pts = Array.from({ length: N }, (_, i) => ({
    a: (i / N) * Math.PI * 2,
    phase: Math.random() * Math.PI * 2,
  }));

  function resize() {
    const size = Math.min(canvas.clientWidth || 260, canvas.clientHeight || 260, 300);
    canvas.width = size;
    canvas.height = size;
    // Hard-clear on resize so the trail buffer doesn't show stale geometry
    ctx.clearRect(0, 0, size, size);
  }

  function pointAngle(x, y) {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    return Math.atan2(y - cy, x - cx);
  }

  function draw() {
    spinVelocity += (BASE_SPIN - spinVelocity) * 0.06;
    angle += spinVelocity;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const baseR = w * 0.30;

    const freq = manager.getAnalyserData();   // Uint8Array[128] frequency bins, or null
    const wave = manager.getWaveformData();   // Uint8Array[256] time domain, or null
    const paused = manager.audio.paused || !manager.musicEnabled;

    // --- frequency band averages ---
    let bass = 0, mid = 0, high = 0;
    if (freq) {
      for (let i = 0; i < 4; i++) bass += freq[i];
      bass = (bass / 4) / 255;
      for (let i = 8; i < 40; i++) mid += freq[i];
      mid = (mid / 32) / 255;
      for (let i = 48; i < 96; i++) high += freq[i];
      high = (high / 48) / 255;
    }

    // ── Trail fade (persistence / afterimage) ──
    ctx.globalAlpha = 1;
    ctx.fillStyle = paused ? 'rgba(17,17,17,0.08)' : 'rgba(17,17,17,0.15)';
    ctx.fillRect(0, 0, w, h);

    const masterAlpha = paused ? 0.32 : 1.0;

    // ── Bass glow ring ──
    const glowR = baseR * (1 + bass * 0.24);
    const grd = ctx.createRadialGradient(cx, cy, glowR * 0.4, cx, cy, glowR * 1.5);
    grd.addColorStop(0, `rgba(94,232,125,${(0.05 + bass * 0.20) * masterAlpha})`);
    grd.addColorStop(1, 'rgba(17,17,17,0)');
    ctx.globalAlpha = masterAlpha;
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(cx, cy, glowR * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // ── Radial particle cloud ──
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    for (let i = 0; i < N; i++) {
      const p = pts[i];
      const binIdx = freq ? Math.floor((i / N) * freq.length) : 0;
      const amp = freq ? freq[binIdx] / 255 : 0;
      const r = baseR + amp * baseR * 0.6;
      const shimmer = Math.sin(p.phase + angle * 3 + i * 0.4) * 0.5 + 0.5;
      const pAlpha = (0.30 + amp * 0.70) * shimmer * masterAlpha;
      const sz = 1.2 + amp * 3.8 + (high > 0.5 ? high * 1.5 : 0);
      ctx.globalAlpha = pAlpha;
      ctx.fillStyle = amp > 0.65 ? '#8fffd0' : '#5ee87d';
      ctx.beginPath();
      ctx.arc(Math.cos(p.a) * r, Math.sin(p.a) * r, sz, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // ── Oscilloscope waveform trace ──
    if (wave) {
      const waveAmp = baseR * (0.18 + mid * 0.32);
      ctx.globalAlpha = (0.45 + mid * 0.55) * masterAlpha;
      ctx.strokeStyle = '#5ee87d';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#5ee87d';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      for (let i = 0; i < wave.length; i++) {
        const x = cx - w * 0.38 + (i / (wave.length - 1)) * w * 0.76;
        const y = cy + ((wave[i] - 128) / 128) * waveAmp;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // ── High-frequency outer sparks ──
    if (high > 0.42 && !paused) {
      const sparkCount = Math.floor(high * 9);
      for (let s = 0; s < sparkCount; s++) {
        const sa = Math.random() * Math.PI * 2;
        const sr = baseR * (1.1 + Math.random() * 0.6);
        ctx.globalAlpha = high * 0.65 * masterAlpha;
        ctx.fillStyle = '#c8ffdf';
        ctx.beginPath();
        ctx.arc(cx + Math.cos(sa) * sr, cy + Math.sin(sa) * sr, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── Drag swipe arrow ──
    ctx.globalAlpha = 1;
    if (dragging) {
      const pullNorm = Math.min(1, Math.abs(pullDx) / TRACK_PULL_THRESHOLD_PX);
      const dir = pullDx >= 0 ? 1 : -1;
      const tailLen = 26 + pullNorm * 42;
      ctx.strokeStyle = `rgba(94,232,125,${0.35 + pullNorm * 0.5})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx - dir * 16, cy + pullDy * 0.06);
      ctx.lineTo(cx + dir * tailLen, cy + pullDy * 0.16);
      ctx.stroke();
    }

    raf = requestAnimationFrame(draw);
  }

  function onPointerDown(e) {
    dragging = true;
    const rect = canvas.getBoundingClientRect();
    dragStartAngle = pointAngle(e.clientX - rect.left, e.clientY - rect.top);
    dragStartTime = manager.audio.currentTime || 0;
    dragStartX = e.clientX;
    pullDx = 0;
    pullDy = 0;
    canvas.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const rect = canvas.getBoundingClientRect();
    const nowA = pointAngle(e.clientX - rect.left, e.clientY - rect.top);
    const diff = nowA - dragStartAngle;
    pullDx = e.clientX - dragStartX;
    pullDy = e.clientY - rect.top - (canvas.height / 2);
    const duration = manager.audio.duration || 0;
    if (duration > 0) manager.scrubToPosition(dragStartTime + (diff / (Math.PI * 2)) * duration);
    spinVelocity = BASE_SPIN + diff * 0.02;
  }

  function onPointerUp(e) {
    if (Math.abs(pullDx) >= TRACK_PULL_THRESHOLD_PX) {
      if (pullDx < 0) manager.prevTrack();
      else manager.nextTrack();
    }
    dragging = false;
    pullDx = 0;
    pullDy = 0;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
  }

  resize();
  draw();
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  window.addEventListener('resize', resize);

  return {
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', resize);
    }
  };
}
