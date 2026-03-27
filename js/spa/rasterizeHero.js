// Rasterize a hero (GIF or text) to a canvas for transition engine use
// Usage: rasterizeHero({type: 'gif', src: 'assets/section/item.gif'}) or rasterizeHero({type: 'text', text: 'Instagram'})

const HERO_CANVAS_WIDTH = 320;
const HERO_CANVAS_HEIGHT = 320;

/**
 * Rasterizes a hero asset (GIF or text) to a canvas.
 * @param {Object} hero - { type: 'gif'|'text', src?: string, text?: string }
 * @returns {Promise<HTMLCanvasElement>} Resolves to a canvas with the hero rendered
 */
export function rasterizeHero(hero) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = HERO_CANVAS_WIDTH;
    canvas.height = HERO_CANVAS_HEIGHT;
    const ctx = canvas.getContext('2d');

    if (hero.type === 'gif') {
      const img = new window.Image();
      img.onload = function() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Center and fit image
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
        resolve(canvas);
      };
      img.onerror = function() {
        reject(new Error('Failed to load GIF'));
      };
      img.src = hero.src;
    } else if (hero.type === 'text') {
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = 'bold 2.5rem SF Mono, Menlo, Monaco, Consolas, monospace';
      ctx.fillStyle = '#5ee87d';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(hero.text, canvas.width / 2, canvas.height / 2);
      resolve(canvas);
    } else {
      reject(new Error('Unknown hero type'));
    }
  });
}
