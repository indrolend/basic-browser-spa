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
  const width = fromCanvas.width;
  const height = fromCanvas.height;
  const PARTICLE_SIZE = 4; // px grid step
  const PARTICLE_COUNT = Math.floor((width * height) / (PARTICLE_SIZE * PARTICLE_SIZE));
  const EXPLODE_DURATION = 400; // ms
  const REFORM_DURATION = 600; // ms
  const TOTAL_DURATION = EXPLODE_DURATION + REFORM_DURATION;
  const EXPLODE_RADIUS = Math.min(width, height) * 0.4;
  const particles = [];

  // Helper: sample canvas pixels into particle positions/colors
  function sampleParticles(canvas) {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const cctx = c.getContext('2d');
    cctx.drawImage(canvas, 0, 0, width, height);
    const imgData = cctx.getImageData(0, 0, width, height).data;
    const result = [];
    for (let y = 0; y < height; y += PARTICLE_SIZE) {
      for (let x = 0; x < width; x += PARTICLE_SIZE) {
        const idx = (y * width + x) * 4;
        const r = imgData[idx], g = imgData[idx+1], b = imgData[idx+2], a = imgData[idx+3];
        // Only sample visible (non-transparent) pixels
        if (a > 32) {
          result.push({ x, y, color: `rgba(${r},${g},${b},${a/255})` });
        }
      }
    }
    return result;
  }

  // Sample from and to states
  const fromParticles = sampleParticles(fromCanvas);
  const toParticles = sampleParticles(toCanvas);
  const N = Math.min(fromParticles.length, toParticles.length, PARTICLE_COUNT);

  // Build particle array: each has start, end, color, and explosion offset
  for (let i = 0; i < N; i++) {
    const start = fromParticles[i];
    const end = toParticles[i];
    // Random explosion direction
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
      // Explosion phase
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
      // Reformation phase
      const p = (t - EXPLODE_DURATION) / REFORM_DURATION;
      for (const pt of particles) {
        const x = pt.ex + (pt.x1 - pt.ex) * p;
        const y = pt.ey + (pt.y1 - pt.ey) * p;
        // Blend color from old to new
        ctx.fillStyle = p < 0.5 ? pt.color0 : pt.color1;
        ctx.beginPath();
        ctx.arc(x, y, PARTICLE_SIZE/2, 0, Math.PI*2);
        ctx.fill();
      }
      requestAnimationFrame(animate);
    } else {
      // Done
      onComplete();
    }
  }
  animate(performance.now());
}
