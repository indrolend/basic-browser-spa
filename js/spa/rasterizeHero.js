// Rasterize a hero (GIF or text) to a canvas for transition engine use
// Usage: rasterizeHero({type: 'gif', src: 'assets/section/item.gif'}) or rasterizeHero({type: 'text', text: 'Instagram'})

const HERO_CANVAS_WIDTH = 320;
const HERO_CANVAS_HEIGHT = 320;


// Utility: Crop a canvas to its non-transparent bounding box
function cropToContent(canvas) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  let minX = width, minY = height, maxX = 0, maxY = 0;
  let found = false;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (data[idx + 3] > 32) { // alpha > 32
        found = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!found) {
    // No visible content, return original
    return { canvas, offsetX: 0, offsetY: 0, width, height };
  }
  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const cropped = document.createElement('canvas');
  cropped.width = cropW;
  cropped.height = cropH;
  cropped.getContext('2d').drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
  return { canvas: cropped, offsetX: minX, offsetY: minY, width: cropW, height: cropH };
}

/**
 * Rasterizes a hero asset (GIF or text) to a canvas and crops to visible content.
 * @param {Object} hero - { type: 'gif'|'text', src?: string, text?: string }
 * @returns {Promise<{canvas: HTMLCanvasElement, offsetX: number, offsetY: number, width: number, height: number}>}
 */
export function rasterizeHero(hero) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = HERO_CANVAS_WIDTH;
    canvas.height = HERO_CANVAS_HEIGHT;
    const ctx = canvas.getContext('2d');

    function finish() {
      const cropped = cropToContent(canvas);
      resolve(cropped);
    }

    if (hero.type === 'gif') {
      const img = new window.Image();
      img.onload = function() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Center and fit image
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
        finish();
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
      finish();
    } else {
      reject(new Error('Unknown hero type'));
    }
  });
}
