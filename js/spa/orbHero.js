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

  // Stable particle pools — allocated once, never recreated inside draw()
  const N_RADIAL = 80;   // radial spectrum cloud
  const N_HALO   = 36;   // bass halo ring dots
  const N_WAVE   = 64;   // waveform sample dots
  const N_SPARKS = 14;   // pre-allocated spark positions (reused each frame)

  const radialPts = Array.from({ length: N_RADIAL }, (_, i) => ({
    a:     (i / N_RADIAL) * Math.PI * 2,
    phase: Math.random() * Math.PI * 2,
  }));

  const haloPts = Array.from({ length: N_HALO }, (_, i) => ({
    a:     (i / N_HALO) * Math.PI * 2,
    phase: Math.random() * Math.PI * 2,
  }));

  // Pre-generate stable spark angles/offsets; randomised once so they look
  // scattered but don't allocate per frame.
  const sparkPts = Array.from({ length: N_SPARKS }, () => ({
    a:   Math.random() * Math.PI * 2,
    off: Math.random(),          // 0–1 radial offset multiplier
  }));

  function resize() {
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
    spinVelocity += (BASE_SPIN - spinVelocity) * 0.06;
    angle += spinVelocity;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const baseR = w * 0.30;

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
    ctx.fillStyle = paused ? 'rgba(17,17,17,0.10)' : 'rgba(17,17,17,0.18)';
    ctx.fillRect(0, 0, w, h);

    const masterAlpha = paused ? 0.28 : 1.0;

    // ── Bass halo — dotted ring ──
    const haloR = baseR * (1.08 + bass * 0.28);
    for (let i = 0; i < N_HALO; i++) {
      const p  = haloPts[i];
      const jitter = Math.sin(p.phase + angle * 2) * baseR * 0.04;
      const r  = haloR + jitter;
      const px = cx + Math.cos(p.a + angle * 0.3) * r;
      const py = cy + Math.sin(p.a + angle * 0.3) * r;
      const sz = 1.0 + bass * 2.5;
      ctx.globalAlpha = (0.18 + bass * 0.55) * masterAlpha;
      ctx.fillStyle = '#5ee87d';
      ctx.beginPath();
      ctx.arc(px, py, sz, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Radial spectrum particle cloud ──
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    for (let i = 0; i < N_RADIAL; i++) {
      const p      = radialPts[i];
      const binIdx = freq ? Math.floor((i / N_RADIAL) * freq.length) : 0;
      const amp    = freq ? freq[binIdx] / 255 : 0;
      const r      = baseR + amp * baseR * 0.6;
      const shimmer = Math.sin(p.phase + angle * 3 + i * 0.4) * 0.5 + 0.5;
      const sz     = 1.2 + amp * 3.8 + (high > 0.5 ? high * 1.5 : 0);
      ctx.globalAlpha = (0.30 + amp * 0.70) * shimmer * masterAlpha;
      ctx.fillStyle = amp > 0.65 ? '#8fffd0' : '#5ee87d';
      ctx.beginPath();
      ctx.arc(Math.cos(p.a) * r, Math.sin(p.a) * r, sz, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // ── Waveform — dot samples ──
    if (wave) {
      const waveAmp = baseR * (0.18 + mid * 0.32);
      const step = Math.floor(wave.length / N_WAVE);
      for (let i = 0; i < N_WAVE; i++) {
        const sample = wave[i * step] ?? 128;
        const x = cx - w * 0.38 + (i / (N_WAVE - 1)) * w * 0.76;
        const y = cy + ((sample - 128) / 128) * waveAmp;
        const deviation = Math.abs(sample - 128) / 128;
        const sz = 1.0 + deviation * 2.5;
        ctx.globalAlpha = (0.35 + deviation * 0.65) * masterAlpha;
        ctx.fillStyle = '#5ee87d';
        ctx.beginPath();
        ctx.arc(x, y, sz, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── High-frequency outer sparks — stable pool ──
    if (high > 0.42 && !paused) {
      const count = Math.min(N_SPARKS, Math.floor(high * N_SPARKS));
      for (let s = 0; s < count; s++) {
        const sp = sparkPts[s];
        const sr = baseR * (1.1 + sp.off * 0.6);
        ctx.globalAlpha = high * 0.65 * masterAlpha;
        ctx.fillStyle = '#c8ffdf';
        ctx.beginPath();
        ctx.arc(cx + Math.cos(sp.a + angle) * sr, cy + Math.sin(sp.a + angle) * sr, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── Drag pull indicator — dotted ──
    ctx.globalAlpha = 1;
    if (dragging && Math.abs(pullDx) > 4) {
      const pullNorm = Math.min(1, Math.abs(pullDx) / TRACK_PULL_THRESHOLD_PX);
      const dir      = pullDx >= 0 ? 1 : -1;
      const dotCount = 6;
      const maxLen   = 26 + pullNorm * 42;
      for (let d = 0; d < dotCount; d++) {
        const t  = (d + 1) / dotCount;
        const dx = cx + dir * t * maxLen;
        const dy = cy + pullDy * t * 0.12;
        const sz = 1.5 + pullNorm * 1.5 * (1 - t * 0.4);
        ctx.globalAlpha = (0.35 + pullNorm * 0.5) * (1 - t * 0.3);
        ctx.fillStyle = '#5ee87d';
        ctx.beginPath();
        ctx.arc(dx, dy, sz, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    raf = requestAnimationFrame(draw);
  }

  function onPointerDown(e) {
    dragging = true;
    const rect = canvas.getBoundingClientRect();
    dragStartAngle = pointAngle(e.clientX - rect.left, e.clientY - rect.top);
    dragStartTime  = manager.audio.currentTime || 0;
    dragStartX     = e.clientX;
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
    pullDx   = 0;
    pullDy   = 0;
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
