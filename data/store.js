const tree = document.querySelector('#download-tree');
const canvas = document.querySelector('#button-particles');
const ctx = canvas.getContext('2d');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

const WINDOWS_URL = 'https://github.com/indrolend/digital-breakdown-apk/releases/download/latest-native/DigitalBreakdown-Windows.zip';
const MAC_URL = 'https://github.com/indrolend/digital-breakdown-apk/releases/download/latest-native/DigitalBreakdown-macOS-Universal.zip';

const views = {
  root: [{ type: 'button', label: 'Download', meta: '↓', action: 'platforms', className: 'root' }],
  platforms: [
    { type: 'button', label: 'Windows', meta: '›', action: 'windows' },
    { type: 'button', label: 'macOS', meta: '›', action: 'macos' },
    { type: 'button', label: 'Back', meta: '←', action: 'root' }
  ],
  windows: [
    { type: 'link', label: 'Windows', meta: 'ZIP · 7.6 MB', href: WINDOWS_URL, className: 'root' },
    { type: 'button', label: 'Back', meta: '←', action: 'platforms' }
  ],
  macos: [
    { type: 'link', label: 'macOS', meta: 'ZIP · 8.4 MB', href: MAC_URL, className: 'root' },
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
    label.textContent = item.label;
    const meta = document.createElement('small');
    meta.textContent = item.meta;
    element.append(label, meta);
    return element;
  }));
  tree.style.setProperty('--columns', String(Math.min(views[name].length, 3)));
}

function sampleLayout(elements, bounds) {
  const points = [];
  elements.forEach((element, elementIndex) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const left = rect.left - bounds.left;
    const top = rect.top - bounds.top;
    const step = 5;
    for (let y = step / 2; y < rect.height; y += step) {
      for (let x = step / 2; x < rect.width; x += step) {
        const edge = x < 7 || y < 7 || x > rect.width - 7 || y > rect.height - 7;
        const seed = (x * 13 + y * 7 + elementIndex * 17) % 23;
        if (!edge && seed > 2) continue;
        points.push({
          x: left + x,
          y: top + y,
          color: element.classList.contains('root')
            ? (x / rect.width > .58 ? '#8ff7ff' : '#5ee87d')
            : style.color,
          size: edge ? 2.2 : 1.7
        });
      }
    }
  });
  return points;
}

function pairedPoints(from, to) {
  const count = Math.max(from.length, to.length);
  return Array.from({ length: count }, (_, index) => ({
    from: from[index % from.length],
    to: to[index % to.length],
    drift: ((index * 47) % 31 - 15) * .55
  }));
}

async function transitionTo(name) {
  if (tree.classList.contains('is-transitioning')) return;
  if (reduceMotion.matches) { render(name); return; }

  const oldElements = [...tree.children];
  const shellBounds = tree.parentElement.getBoundingClientRect();
  const from = sampleLayout(oldElements, shellBounds);
  render(name);
  const newElements = [...tree.children];
  const targetHeight = tree.getBoundingClientRect().height;
  tree.parentElement.style.minHeight = `${targetHeight}px`;
  const to = sampleLayout(newElements, shellBounds);
  const particles = pairedPoints(from, to);
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.ceil(shellBounds.width * dpr);
  canvas.height = Math.ceil(Math.max(shellBounds.height, targetHeight) * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  tree.classList.add('is-transitioning');

  const duration = 540;
  const start = performance.now();
  await new Promise(resolve => {
    function frame(now) {
      const linear = Math.min(1, (now - start) / duration);
      const eased = linear < .5 ? 4 * linear ** 3 : 1 - (-2 * linear + 2) ** 3 / 2;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      particles.forEach((particle, index) => {
        const bend = Math.sin(Math.PI * linear) * particle.drift;
        const x = particle.from.x + (particle.to.x - particle.from.x) * eased + bend;
        const y = particle.from.y + (particle.to.y - particle.from.y) * eased - Math.sin(Math.PI * linear) * (10 + index % 9);
        ctx.globalAlpha = .35 + .65 * Math.sin(Math.PI * (.2 + linear * .8));
        ctx.fillStyle = linear < .5 ? particle.from.color : particle.to.color;
        ctx.fillRect(x, y, particle.from.size, particle.from.size);
      });
      if (linear < 1) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });

  ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  tree.classList.remove('is-transitioning');
  tree.parentElement.style.minHeight = '';
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
