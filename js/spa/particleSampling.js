export const PARTICLE_SIZE = 4;
export const PARTICLE_ALPHA_THRESHOLD = 32;

let sampleScratchCanvas = null;

/**
 * Convert a normalized Surface region into centered pixel particles.
 * Transition and pull-preview code share this sampling policy so particle size,
 * alpha threshold and color extraction have one authority.
 */
export function sampleSurfaceParticles(
  region,
  canvasWidth,
  canvasHeight,
  { includeOffsets = false, random = Math.random } = {}
) {
  if (!region?.canvas) throw new TypeError('particle sampling requires a surface region');
  if (!sampleScratchCanvas) sampleScratchCanvas = document.createElement('canvas');

  const canvas = sampleScratchCanvas;
  if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
  }

  const ctx = canvas.getContext('2d');
  const dx = (canvasWidth - region.width) / 2;
  const dy = (canvasHeight - region.height) / 2;
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.drawImage(
    region.canvas,
    0,
    0,
    region.width,
    region.height,
    dx,
    dy,
    region.width,
    region.height
  );

  const pixels = ctx.getImageData(0, 0, canvasWidth, canvasHeight).data;
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const particles = [];

  for (let y = 0; y < canvasHeight; y += PARTICLE_SIZE) {
    for (let x = 0; x < canvasWidth; x += PARTICLE_SIZE) {
      const index = (y * canvasWidth + x) * 4;
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      const a = pixels[index + 3];
      if (a <= PARTICLE_ALPHA_THRESHOLD) continue;

      const particle = {
        x,
        y,
        color: `rgba(${r},${g},${b},${a / 255})`
      };

      if (includeOffsets) {
        particle.cx = x - centerX;
        particle.cy = y - centerY;
        particle.frayX = (random() - 0.5) * 2;
        particle.frayY = (random() - 0.5) * 2;
      }

      particles.push(particle);
    }
  }

  return particles;
}
