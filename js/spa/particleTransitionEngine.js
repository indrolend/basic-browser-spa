// Minimal particle transition engine (placeholder)
// API: transition(fromCanvas, toCanvas, options, onComplete)

/**
 * Animate a particle transition from one canvas to another.
 * @param {HTMLCanvasElement} fromCanvas
 * @param {HTMLCanvasElement} toCanvas
 * @param {Object} options - { ctx: CanvasRenderingContext2D, ... }
 * @param {Function} onComplete
 */

// Particle transition engine: fromCanvas -> toCanvas with explosion/reform
export function transition(fromCanvas, toCanvas, options, onComplete) {
  const ctx = options.ctx;
  const PARTICLE_SIZE = 4;
  // Use the region info if provided (cropped region and centering)
  const fromRegion = options.fromRegion || { canvas: fromCanvas, width: fromCanvas.width, height: fromCanvas.height };
  const toRegion = options.toRegion || { canvas: toCanvas, width: toCanvas.width, height: toCanvas.height };
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const PARTICLE_COUNT = Math.floor((Math.max(fromRegion.width, toRegion.width) * Math.max(fromRegion.height, toRegion.height)) / (PARTICLE_SIZE * PARTICLE_SIZE));
  const EXPLODE_DURATION = 400;
  const REFORM_DURATION = 600;
  const TOTAL_DURATION = EXPLODE_DURATION + REFORM_DURATION;
  const EXPLODE_RADIUS = Math.min(width, height) * 0.4;
  const particles = [];

  // Helper: sample canvas pixels into particle positions/colors, centered
  function sampleParticles(region) {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const cctx = c.getContext('2d');
    // Center the region in the transition canvas
    const dx = (width - region.width) / 2;
    const dy = (height - region.height) / 2;
    cctx.clearRect(0, 0, width, height);
    cctx.drawImage(region.canvas, 0, 0, region.width, region.height, dx, dy, region.width, region.height);
    const imgData = cctx.getImageData(0, 0, width, height).data;
    const result = [];
    for (let y = 0; y < height; y += PARTICLE_SIZE) {
      for (let x = 0; x < width; x += PARTICLE_SIZE) {
        const idx = (y * width + x) * 4;
        const r = imgData[idx], g = imgData[idx+1], b = imgData[idx+2], a = imgData[idx+3];
        if (a > 32) {
          result.push({ x, y, color: `rgba(${r},${g},${b},${a/255})` });
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

  function sampleByCoverage(list, count) {
    if (!list.length || count <= 0) return [];

    const sampled = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.floor((i * list.length) / count) % list.length;
      sampled.push(list[idx]);
    }
    return sampled;
  }

  // Sample from and to states using cropped/centered regions.
  // Build correspondences so both footprints are represented even when sizes differ.
  const rawFromParticles = sampleParticles(fromRegion);
  const rawToParticles = sampleParticles(toRegion);

  const fromParticles = rawFromParticles.length ? rawFromParticles : rawToParticles;
  const toParticles = rawToParticles.length ? rawToParticles : rawFromParticles;

  const hasParticles = fromParticles.length > 0 && toParticles.length > 0;
  const N = hasParticles ? PARTICLE_COUNT : 0;

  const fromCoveragePool = sampleByCoverage(fromParticles, N);
  const toCoveragePool = sampleByCoverage(toParticles, N);

  const fromPool = shuffle(fromCoveragePool);
  const toPool = shuffle(toCoveragePool);

  for (let i = 0; i < N; i++) {
    const start = fromPool[i];
    const end = toPool[i];
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * EXPLODE_RADIUS * 0.7 + EXPLODE_RADIUS * 0.3;
    const ex = start.x + Math.cos(angle) * radius;
    const ey = start.y + Math.sin(angle) * radius;
    particles.push({
      x0: start.x, y0: start.y, color0: start.color,
      x1: end.x, y1: end.y, color1: end.color,
      ex, ey
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
        const x = pt.x0 + (pt.ex - pt.x0) * p;
        const y = pt.y0 + (pt.ey - pt.y0) * p;
        ctx.fillStyle = pt.color0;
        ctx.beginPath();
        ctx.arc(x, y, PARTICLE_SIZE/2, 0, Math.PI*2);
        ctx.fill();
      }
      requestAnimationFrame(animate);
    } else if (t < TOTAL_DURATION) {
      const p = (t - EXPLODE_DURATION) / REFORM_DURATION;
      for (const pt of particles) {
        const x = pt.ex + (pt.x1 - pt.ex) * p;
        const y = pt.ey + (pt.y1 - pt.ey) * p;
        ctx.fillStyle = p < 0.5 ? pt.color0 : pt.color1;
        ctx.beginPath();
        ctx.arc(x, y, PARTICLE_SIZE/2, 0, Math.PI*2);
        ctx.fill();
      }
      requestAnimationFrame(animate);
    } else {
      onComplete();
    }
  }
  animate(performance.now());
}
