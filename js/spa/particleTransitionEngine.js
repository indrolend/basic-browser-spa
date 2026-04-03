// Particle transition engine
// API: transition(fromCanvas, toCanvas, options, onComplete)
//      transitionFromPull(pulledParticles, toRegion, ctx, options, onComplete)

const PARTICLE_SIZE = 4;

// ─── Shared helpers ───────────────────────────────────────────────────────────

function sampleParticles(region, canvasWidth, canvasHeight) {
  const c = document.createElement('canvas');
  c.width = canvasWidth;
  c.height = canvasHeight;
  const cctx = c.getContext('2d');
  const dx = (canvasWidth - region.width) / 2;
  const dy = (canvasHeight - region.height) / 2;
  cctx.clearRect(0, 0, canvasWidth, canvasHeight);
  cctx.drawImage(region.canvas, 0, 0, region.width, region.height, dx, dy, region.width, region.height);
  const imgData = cctx.getImageData(0, 0, canvasWidth, canvasHeight).data;
  const result = [];
  for (let y = 0; y < canvasHeight; y += PARTICLE_SIZE) {
    for (let x = 0; x < canvasWidth; x += PARTICLE_SIZE) {
      const idx = (y * canvasWidth + x) * 4;
      const r = imgData[idx], g = imgData[idx + 1], b = imgData[idx + 2], a = imgData[idx + 3];
      if (a > 32) {
        result.push({ x, y, color: `rgba(${r},${g},${b},${a / 255})` });
      }
    }
  }
  return result;
}

function shuffle(list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function parseRgba(color) {
  const match = /rgba\((\d+),(\d+),(\d+),([0-9.]+)\)/.exec(color);
  if (!match) return [255, 255, 255, 1];
  return [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])];
}

function lerpColor(from, to, t) {
  const p = Math.max(0, Math.min(1, t));
  const r = Math.round(from[0] + (to[0] - from[0]) * p);
  const g = Math.round(from[1] + (to[1] - from[1]) * p);
  const b = Math.round(from[2] + (to[2] - from[2]) * p);
  const a = from[3] + (to[3] - from[3]) * p;
  return `rgba(${r},${g},${b},${a})`;
}

function easeOutBack(t) {
  const p = Math.max(0, Math.min(1, t));
  const s = 1.1;
  const u = p - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
}

function sampleByCoverage(list, count) {
  if (!list.length || count <= 0) return [];
  const sampled = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor((i * list.length) / count) % list.length;
    sampled.push(list[idx]);
  }
  return sampled;
}

// ─── Standard explode → reform transition ────────────────────────────────────

/**
 * Animate a particle transition from one canvas to another.
 * @param {HTMLCanvasElement} fromCanvas
 * @param {HTMLCanvasElement} toCanvas
 * @param {Object} options - { ctx, fromRegion, toRegion, timingProfile, ... }
 * @param {Function} onComplete
 */
export function transition(fromCanvas, toCanvas, options, onComplete) {
  const ctx = options.ctx;
  const fromRegion = options.fromRegion || { canvas: fromCanvas, width: fromCanvas.width, height: fromCanvas.height };
  const toRegion = options.toRegion || { canvas: toCanvas, width: toCanvas.width, height: toCanvas.height };
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const PARTICLE_COUNT = Math.floor(
    (Math.max(fromRegion.width, toRegion.width) * Math.max(fromRegion.height, toRegion.height)) /
    (PARTICLE_SIZE * PARTICLE_SIZE)
  );
  const timingProfile = options.timingProfile === 'chained' ? 'chained' : 'default';
  const EXPLODE_DURATION = timingProfile === 'chained' ? 180 : 260;
  const REFORM_DURATION  = timingProfile === 'chained' ? 280 : 420;
  const TOTAL_DURATION   = EXPLODE_DURATION + REFORM_DURATION;
  const EXPLODE_RADIUS   = Math.min(width, height) * (timingProfile === 'chained' ? 0.34 : 0.4);
  const particles = [];

  const rawFromParticles = sampleParticles(fromRegion, width, height);
  const rawToParticles   = sampleParticles(toRegion,   width, height);

  const fromParticles = rawFromParticles.length ? rawFromParticles : rawToParticles;
  const toParticles   = rawToParticles.length   ? rawToParticles   : rawFromParticles;

  const hasParticles = fromParticles.length > 0 && toParticles.length > 0;
  const N = hasParticles ? PARTICLE_COUNT : 0;

  const fromPool = shuffle(sampleByCoverage(fromParticles, N));
  const toPool   = shuffle(sampleByCoverage(toParticles,   N));

  for (let i = 0; i < N; i++) {
    const start = fromPool[i];
    const end   = toPool[i];
    const angle  = Math.random() * Math.PI * 2;
    const radius = Math.random() * EXPLODE_RADIUS * 0.7 + EXPLODE_RADIUS * 0.3;
    particles.push({
      x0: start.x, y0: start.y, color0: start.color, c0: parseRgba(start.color),
      x1: end.x,   y1: end.y,   color1: end.color,   c1: parseRgba(end.color),
      ex: start.x + Math.cos(angle) * radius,
      ey: start.y + Math.sin(angle) * radius
    });
  }

  let startTime = null;
  function animate(ts) {
    if (!startTime) startTime = ts;
    const t = ts - startTime;
    ctx.clearRect(0, 0, width, height);
    if (t < EXPLODE_DURATION) {
      const p = t / EXPLODE_DURATION;
      for (const pt of particles) {
        ctx.fillStyle = pt.color0;
        ctx.beginPath();
        ctx.arc(pt.x0 + (pt.ex - pt.x0) * p, pt.y0 + (pt.ey - pt.y0) * p, PARTICLE_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(animate);
    } else if (t < TOTAL_DURATION) {
      const p     = (t - EXPLODE_DURATION) / REFORM_DURATION;
      const moveP = easeOutBack(p);
      for (const pt of particles) {
        ctx.fillStyle = lerpColor(pt.c0, pt.c1, p);
        ctx.beginPath();
        ctx.arc(pt.ex + (pt.x1 - pt.ex) * moveP, pt.ey + (pt.y1 - pt.ey) * moveP, PARTICLE_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(animate);
    } else {
      onComplete();
    }
  }
  animate(performance.now());
}

// ─── Slingshot reform-only transition ────────────────────────────────────────

/**
 * Continue a slingshot pull directly into a reform animation.
 * Particles start from their pulled preview positions and converge exactly
 * onto the target hero — no explode phase, truthful continuation of the drag.
 *
 * @param {Array<{x, y, color}>} pulledParticles  Last frame of the pull preview
 * @param {{canvas, width, height}} toRegion       Target hero surface
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} options
 * @param {Function} onComplete
 */
export function transitionFromPull(pulledParticles, toRegion, ctx, options, onComplete) {
  const width  = ctx.canvas.width;
  const height = ctx.canvas.height;
  const SNAP_DURATION   = 160; // ms — elastic snap-back from pulled to rest positions
  const REFORM_DURATION = 350; // ms — reform from rest positions to target shape

  if (!pulledParticles || !pulledParticles.length) {
    if (typeof onComplete === 'function') onComplete();
    return;
  }

  const rawToParticles = sampleParticles(toRegion, width, height);
  if (!rawToParticles.length) {
    if (typeof onComplete === 'function') onComplete();
    return;
  }

  const N      = pulledParticles.length;
  const toPool = shuffle(sampleByCoverage(rawToParticles, N));

  // from-particles base = from-surface rest positions (before pull stretch).
  // When provided they form the elastic snap-back target (Phase 1), and the
  // reform origin (Phase 2), making the release feel like a true elastic rebound
  // that then transforms into the target image — all centred on screen.
  const fromBase = options && options.fromParticlesBase;
  const hasSnap  = fromBase && fromBase.length >= N;

  const particles = [];
  for (let i = 0; i < N; i++) {
    const pulled = pulledParticles[i];
    const end    = toPool[i % toPool.length];
    const mid    = hasSnap ? fromBase[i] : pulled; // snap-back / reform origin
    particles.push({
      x0: pulled.x, y0: pulled.y, c0: parseRgba(pulled.color),
      xm: mid.x,    ym: mid.y,                          // rest position
      x1: end.x,    y1: end.y,   c1: parseRgba(end.color)
    });
  }

  let startTime = null;
  function animate(ts) {
    if (!startTime) startTime = ts;
    const elapsed = ts - startTime;
    ctx.clearRect(0, 0, width, height);

    if (hasSnap && elapsed < SNAP_DURATION) {
      // Phase 1: snap-back — pulled positions → from-surface rest positions (ease-out)
      const raw  = elapsed / SNAP_DURATION;
      const ease = 1 - (1 - raw) * (1 - raw); // ease-out quad
      for (const pt of particles) {
        ctx.fillStyle = `rgba(${pt.c0[0]},${pt.c0[1]},${pt.c0[2]},${pt.c0[3]})`;
        ctx.beginPath();
        ctx.arc(
          pt.x0 + (pt.xm - pt.x0) * ease,
          pt.y0 + (pt.ym - pt.y0) * ease,
          PARTICLE_SIZE / 2, 0, Math.PI * 2
        );
        ctx.fill();
      }
      requestAnimationFrame(animate);
    } else {
      // Phase 2: reform — rest positions → target positions (ease-out-back for bounce)
      const reformElapsed = elapsed - (hasSnap ? SNAP_DURATION : 0);
      const p     = Math.min(reformElapsed / REFORM_DURATION, 1);
      const moveP = easeOutBack(p);
      for (const pt of particles) {
        ctx.fillStyle = lerpColor(pt.c0, pt.c1, p);
        ctx.beginPath();
        ctx.arc(
          pt.xm + (pt.x1 - pt.xm) * moveP,
          pt.ym + (pt.y1 - pt.ym) * moveP,
          PARTICLE_SIZE / 2, 0, Math.PI * 2
        );
        ctx.fill();
      }
      if (p < 1) {
        requestAnimationFrame(animate);
      } else {
        if (typeof onComplete === 'function') onComplete();
      }
    }
  }
  requestAnimationFrame(animate);
}
