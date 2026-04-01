// Rasterize a hero (GIF/image element or text) to a canvas for transition engine use
// Usage: rasterizeHero({type: 'gif', src: 'assets/section/item.gif'}) or rasterizeHero({type: 'element', element: imgEl}) or rasterizeHero({type: 'textElement', element: textEl})

const HERO_CANVAS_WIDTH = 320;
const HERO_CANVAS_HEIGHT = 320;



function parsePixelValue(value, fallback = 0) {
  const parsed = Number.parseFloat(value || '');
  return Number.isFinite(parsed) ? parsed : fallback;
}

function drawTextWithLetterSpacing(ctx, text, x, y, letterSpacingPx) {
  if (!letterSpacingPx) {
    ctx.fillText(text, x, y);
    return;
  }

  const chars = [...text];
  const fullWidth = chars.reduce((sum, ch) => sum + ctx.measureText(ch).width, 0) + Math.max(0, chars.length - 1) * letterSpacingPx;
  let drawX = x - (fullWidth / 2);

  for (const ch of chars) {
    ctx.fillText(ch, drawX, y);
    drawX += ctx.measureText(ch).width + letterSpacingPx;
  }
}

function wrapTextLines(ctx, text, maxWidth, letterSpacingPx) {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [''];

  const lines = [];
  let currentLine = words[0];

  const measure = (value) => {
    const base = ctx.measureText(value).width;
    return base + Math.max(0, value.length - 1) * letterSpacingPx;
  };

  for (let i = 1; i < words.length; i += 1) {
    const candidate = `${currentLine} ${words[i]}`;
    if (measure(candidate) <= maxWidth) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = words[i];
    }
  }
  lines.push(currentLine);
  return lines;
}

function copyComputedStyle(sourceEl, targetEl) {
  const computed = window.getComputedStyle(sourceEl);
  for (let i = 0; i < computed.length; i += 1) {
    const prop = computed[i];
    targetEl.style.setProperty(prop, computed.getPropertyValue(prop), computed.getPropertyPriority(prop));
  }
}

function inlineComputedStyles(sourceEl, cloneEl) {
  copyComputedStyle(sourceEl, cloneEl);
  const sourceChildren = sourceEl.children;
  const cloneChildren = cloneEl.children;
  const childCount = Math.min(sourceChildren.length, cloneChildren.length);
  for (let i = 0; i < childCount; i += 1) {
    const sourceChild = sourceChildren[i];
    const cloneChild = cloneChildren[i];
    if (sourceChild instanceof window.HTMLElement && cloneChild instanceof window.HTMLElement) {
      inlineComputedStyles(sourceChild, cloneChild);
    }
  }
}

function drawTextElementViaSvg(ctx, canvas, textEl, onDone, onError) {
  const rect = textEl.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(rect.width));
  const height = Math.max(1, Math.ceil(rect.height));

  const clone = textEl.cloneNode(true);
  if (!(clone instanceof window.HTMLElement)) {
    onError(new Error('Failed to clone text element'));
    return;
  }

  inlineComputedStyles(textEl, clone);
  clone.style.margin = '0';
  clone.style.width = `${width}px`;

  const serializer = new window.XMLSerializer();
  const escaped = serializer.serializeToString(clone)
    .replace(/&nbsp;/g, '&#160;');

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject x="0" y="0" width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;">${escaped}</div>
      </foreignObject>
    </svg>
  `;

  const img = new window.Image();
  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    onDone();
  };
  img.onerror = () => onError(new Error('Failed to rasterize text element via SVG'));
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function drawTextElement(ctx, canvas, textEl) {
  const style = window.getComputedStyle(textEl);
  const rect = textEl.getBoundingClientRect();

  const fontSizePx = parsePixelValue(style.fontSize, 40);
  const lineHeightPx = style.lineHeight === 'normal' ? fontSizePx * 1.2 : parsePixelValue(style.lineHeight, fontSizePx * 1.2);
  const letterSpacingPx = parsePixelValue(style.letterSpacing, 0);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = style.font || `${style.fontWeight || '700'} ${fontSizePx}px ${style.fontFamily || 'monospace'}`;
  ctx.fillStyle = style.color || '#5ee87d';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  const sourceText = textEl.textContent || '';
  const renderText = (style.textTransform === 'uppercase') ? sourceText.toUpperCase() : sourceText;
  const maxWidth = Math.max(32, Math.min(rect.width || canvas.width * 0.9, canvas.width * 0.95));
  const lines = wrapTextLines(ctx, renderText, maxWidth, letterSpacingPx);

  const blockHeight = lines.length * lineHeightPx;
  let y = (canvas.height / 2) - (blockHeight / 2) + fontSizePx;
  for (const line of lines) {
    drawTextWithLetterSpacing(ctx, line, canvas.width / 2, y, letterSpacingPx);
    y += lineHeightPx;
  }
}

// Utility: Crop a canvas to its non-transparent bounding box
function cropToContent(canvas, padding = 0) {
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
  const extra = Math.max(0, Math.floor(padding));
  const paddedMinX = Math.max(0, minX - extra);
  const paddedMinY = Math.max(0, minY - extra);
  const paddedMaxX = Math.min(width - 1, maxX + extra);
  const paddedMaxY = Math.min(height - 1, maxY + extra);
  const cropW = paddedMaxX - paddedMinX + 1;
  const cropH = paddedMaxY - paddedMinY + 1;
  const cropped = document.createElement('canvas');
  cropped.width = cropW;
  cropped.height = cropH;
  cropped.getContext('2d').drawImage(canvas, paddedMinX, paddedMinY, cropW, cropH, 0, 0, cropW, cropH);
  return { canvas: cropped, offsetX: paddedMinX, offsetY: paddedMinY, width: cropW, height: cropH };
}

/**
 * Rasterizes a hero asset (GIF, image element, or text) into a transition surface object.
 * @param {Object} hero - { type: 'gif'|'element'|'text'|'textElement', src?: string, element?: HTMLElement|HTMLImageElement, text?: string }
 * @returns {Promise<{canvas: HTMLCanvasElement, offsetX: number, offsetY: number, width: number, height: number}>}
 * Surface shape is consumed by runHeroTransition(...): canvas plus cropped region metadata.
 */
export function rasterizeHero(hero) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = HERO_CANVAS_WIDTH;
    canvas.height = HERO_CANVAS_HEIGHT;
    const ctx = canvas.getContext('2d');

    function finish({ padding = 0 } = {}) {
      const cropped = cropToContent(canvas, padding);
      resolve(cropped);
    }


    function drawCenteredImage(img) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
      finish();
    }

    if (hero.type === 'gif') {
      const img = new window.Image();
      img.onload = function() {
        drawCenteredImage(img);
      };
      img.onerror = function() {
        reject(new Error('Failed to load GIF'));
      };
      img.src = hero.src;
    } else if (hero.type === 'element') {
      const imgEl = hero.element;
      if (!(imgEl instanceof window.HTMLImageElement)) {
        reject(new Error('Invalid image element'));
        return;
      }
      if (!imgEl.complete || !imgEl.naturalWidth || !imgEl.naturalHeight) {
        reject(new Error('Image element not ready'));
        return;
      }
      drawCenteredImage(imgEl);
    } else if (hero.type === 'textElement') {
      const textEl = hero.element;
      if (!(textEl instanceof window.HTMLElement)) {
        reject(new Error('Invalid text element'));
        return;
      }

      drawTextElementViaSvg(
        ctx,
        canvas,
        textEl,
        () => finish({ padding: 14 }),
        () => {
          drawTextElement(ctx, canvas, textEl);
          finish({ padding: 14 });
        }
      );
    } else if (hero.type === 'text') {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = '700 40px SF Mono, Menlo, Monaco, Consolas, monospace';
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
