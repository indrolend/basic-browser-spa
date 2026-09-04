const tree = document.querySelector('#download-tree');
const canvas = document.querySelector('#button-particles');
const ctx = canvas.getContext('2d');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const PARTICLE_SIZE = 3;

const views = {
  root: [{ type: 'button', label: 'Download', meta: '↓', action: 'platforms', className: 'root' }],
  platforms: [
    { type: 'button', label: 'Windows', meta: '›', action: 'windows' },
    { type: 'button', label: 'macOS', meta: '›', action: 'macos' },
    { type: 'button', label: 'Back', meta: '←', action: 'root' }
  ],
  windows: [
    { type: 'link', label: 'Windows', meta: 'ZIP · 7.6 MB', href: 'https://github.com/indrolend/digital-breakdown-apk/releases/download/latest-native/DigitalBreakdown-Windows.zip', className: 'root' },
    { type: 'button', label: 'Back', meta: '←', action: 'platforms' }
  ],
  macos: [
    { type: 'link', label: 'macOS', meta: 'ZIP · 8.4 MB', href: 'https://github.com/indrolend/digital-breakdown-apk/releases/download/latest-native/DigitalBreakdown-macOS-Universal.zip', className: 'root' },
    { type: 'button', label: 'Back', meta: '←', action: 'platforms' }
  ]
};

function render(name) {
  tree.replaceChildren(...views[name].map(item => {
    const element = document.createElement(item.type === 'link' ? 'a' : 'button');
    if (item.type === 'button') element.type = 'button';
    if (item.href) element.href = item.href;
    if (item.action) element.dataset.action = item.action;
    if (item.className) element.className = item.className;
    const label = document.createElement('span');
    const meta = document.createElement('small');
    label.textContent = item.label;
    meta.textContent = item.meta;
    element.append(label, meta);
    return element;
  }));
  tree.style.setProperty('--columns', String(Math.min(views[name].length, 3)));
}

function buttonPath(context, x, y, width, height) {
  const cut = 9;
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x + width - cut, y);
  context.lineTo(x + width, y + cut);
  context.lineTo(x + width, y + height);
  context.lineTo(x + cut, y + height);
  context.lineTo(x, y + height - cut);
  context.closePath();
}

function rasterize(elements, bounds, width, height) {
  const surface = document.createElement('canvas');
  surface.width = width;
  surface.height = height;
  const context = surface.getContext('2d');
  elements.forEach(element => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const x = rect.left - bounds.left;
    const y = rect.top - bounds.top;
    const root = element.classList.contains('root');
    context.save();
    buttonPath(context, x, y, rect.width, rect.height);
    context.clip();
    const fill = context.createLinearGradient(x, y, x + rect.width, y);
    const stops = root ? [[0, '#173522'], [.58, '#10292b'], [1, '#2b1720']] : [[0, '#101713'], [1, '#0b100d']];
    stops.forEach(([at, color]) => fill.addColorStop(at, color));
    context.fillStyle = fill;
    context.fillRect(x, y, rect.width, rect.height);
    context.fillStyle = '#5ee87d';
    context.fillRect(x, y, 3, rect.height);
    context.restore();
    buttonPath(context, x + .5, y + .5, rect.width - 1, rect.height - 1);
    context.strokeStyle = root ? '#5ee87d99' : '#274034';
    context.stroke();

    const label = element.querySelector('span');
    const meta = element.querySelector('small');
    const metaStyle = getComputedStyle(meta);
    context.textBaseline = 'middle';
    context.font = `${root ? '700' : '400'} ${style.fontSize} ${style.fontFamily}`;
    context.fillStyle = root ? '#eefbf4' : '#5ee87d';
    context.fillText(label.textContent, x + (parseFloat(style.paddingLeft) || 20), y + rect.height / 2);
    context.font = `${metaStyle.fontWeight} ${metaStyle.fontSize} ${metaStyle.fontFamily}`;
    context.fillStyle = root ? '#8ff7ff' : '#7f9589';
    const metaWidth = context.measureText(meta.textContent).width;
    context.fillText(meta.textContent, x + rect.width - (parseFloat(style.paddingRight) || 16) - metaWidth, y + rect.height / 2);
  });
  return surface;
}

function sample(surface) {
  const pixels = surface.getContext('2d').getImageData(0, 0, surface.width, surface.height).data;
  const points = [];
  for (let y = 1; y < surface.height; y += PARTICLE_SIZE) {
    for (let x = 1; x < surface.width; x += PARTICLE_SIZE) {
      const index = (y * surface.width + x) * 4;
      if (pixels[index + 3] > 32) points.push({ x, y, color: [pixels[index], pixels[index + 1], pixels[index + 2], pixels[index + 3] / 255] });
    }
  }
  return points;
}

function cover(points, count) {
  return Array.from({ length: count }, (_, index) => points[Math.floor(index * points.length / count)]);
}

function shuffle(points) {
  const result = points.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function easeOutBack(value) {
  const t = value - 1;
  return 1 + 2.1 * t ** 3 + 1.1 * t ** 2;
}

function colorBetween(from, to, amount) {
  const value = from.map((channel, index) => channel + (to[index] - channel) * amount);
  return `rgba(${value[0]},${value[1]},${value[2]},${value[3]})`;
}

async function transitionTo(name) {
  if (tree.classList.contains('is-transitioning')) return;
  if (reduceMotion.matches) {
    render(name);
    tree.firstElementChild?.focus({ preventScroll: true });
    return;
  }

  const shell = tree.parentElement;
  const bounds = shell.getBoundingClientRect();
  const oldElements = [...tree.children];
  const oldHeight = tree.getBoundingClientRect().height;
  const width = Math.ceil(bounds.width);
  const from = sample(rasterize(oldElements, bounds, width, Math.ceil(oldHeight)));
  render(name);
  const newElements = [...tree.children];
  const newHeight = tree.getBoundingClientRect().height;
  const height = Math.ceil(Math.max(oldHeight, newHeight));
  shell.style.height = `${height}px`;

  const to = sample(rasterize(newElements, bounds, width, height));
  if (!from.length || !to.length) {
    shell.style.height = '';
    return;
  }

  const count = Math.max(from.length, to.length);
  const fromPool = shuffle(cover(from, count));
  const toPool = shuffle(cover(to, count));
  const radius = Math.min(width, height) * .42;
  const particles = fromPool.map((start, index) => {
    const angle = Math.random() * Math.PI * 2;
    const distance = radius * (.3 + Math.random() * .7);
    return { start, end: toPool[index], burstX: start.x + Math.cos(angle) * distance, burstY: start.y + Math.sin(angle) * distance };
  });
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.ceil(width * dpr);
  canvas.height = Math.ceil(height * dpr);
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  tree.classList.add('is-transitioning');

  const explodeDuration = 125;
  const reformDuration = 260;
  const started = performance.now();
  await new Promise(resolve => {
    function frame(now) {
      const elapsed = now - started;
      ctx.clearRect(0, 0, width, height);
      particles.forEach(particle => {
        let x;
        let y;
        let color;
        if (elapsed < explodeDuration) {
          const progress = elapsed / explodeDuration;
          x = particle.start.x + (particle.burstX - particle.start.x) * progress;
          y = particle.start.y + (particle.burstY - particle.start.y) * progress;
          color = `rgba(${particle.start.color.join(',')})`;
        } else {
          const progress = Math.min(1, (elapsed - explodeDuration) / reformDuration);
          const movement = easeOutBack(progress);
          x = particle.burstX + (particle.end.x - particle.burstX) * movement;
          y = particle.burstY + (particle.end.y - particle.burstY) * movement;
          color = colorBetween(particle.start.color, particle.end.color, progress);
        }
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, PARTICLE_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();
      });
      if (elapsed < explodeDuration + reformDuration) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });

  ctx.clearRect(0, 0, width, height);
  tree.classList.remove('is-transitioning');
  shell.style.height = '';
  canvas.style.height = '';
  newElements[0]?.focus({ preventScroll: true });
}

tree.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (button) transitionTo(button.dataset.action);
});

const rainbow = time => {
  document.querySelectorAll('h1 span').forEach((letter, index) => {
    letter.style.setProperty('--letter-color', `hsl(${(time * .00936 + index * 41.4) % 360} 100% 82%)`);
  });
  requestAnimationFrame(rainbow);
};

render('root');
requestAnimationFrame(rainbow);
