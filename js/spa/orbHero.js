export function initOrbHero(canvas, manager) {
  const ctx = canvas.getContext('2d');
  let raf = null;
  let angle = 0;
  let dragging = false;
  let dragStartAngle = 0;
  let dragStartTime = 0;

  function resize() {
    const size = Math.min(canvas.clientWidth || 260, canvas.clientHeight || 260, 300);
    canvas.width = size;
    canvas.height = size;
  }

  function pointAngle(x, y) {
    const cx = canvas.width / 2; const cy = canvas.height / 2;
    return Math.atan2(y - cy, x - cx);
  }

  function draw() {
    angle += 0.01;
    const w = canvas.width; const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2; const cy = h / 2;
    const data = manager.getAnalyserData();
    const pulse = data ? data[4] / 255 : 0;
    const r = w * (0.28 + pulse * 0.08);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    const grad = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.2);
    grad.addColorStop(0, '#8fffd0');
    grad.addColorStop(1, '#2a6f57');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();

    const bars = 36;
    for (let i = 0; i < bars; i++) {
      const idx = data ? Math.floor((i / bars) * data.length) : 0;
      const amp = data ? data[idx] / 255 : 0;
      const len = 8 + amp * 22;
      const a = (i / bars) * Math.PI * 2;
      const x1 = Math.cos(a) * (r + 8); const y1 = Math.sin(a) * (r + 8);
      const x2 = Math.cos(a) * (r + len); const y2 = Math.sin(a) * (r + len);
      ctx.strokeStyle = '#5ee87d';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    ctx.restore();

    raf = requestAnimationFrame(draw);
  }

  function onPointerDown(e) {
    dragging = true;
    const rect = canvas.getBoundingClientRect();
    dragStartAngle = pointAngle(e.clientX - rect.left, e.clientY - rect.top);
    dragStartTime = manager.audio.currentTime || 0;
    canvas.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const rect = canvas.getBoundingClientRect();
    const nowA = pointAngle(e.clientX - rect.left, e.clientY - rect.top);
    const diff = nowA - dragStartAngle;
    const duration = manager.audio.duration || 0;
    if (duration > 0) manager.scrubToPosition(dragStartTime + (diff / (Math.PI * 2)) * duration);
  }

  function onPointerUp(e) {
    dragging = false;
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
