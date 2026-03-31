// Homedev SPA - Minimal, modular, and particle transition ready

const SPA_SECTIONS = [
  {
    id: 'home',
    label: 'Home',
    items: [
      { id: 'main', label: 'Home', hero: { kind: 'text', text: 'Home' } }
    ]
  },
  {
    id: 'social',
    label: 'Social',
    items: [
      { id: 'tiktok', label: 'TikTok', hero: { kind: 'image', src: 'gifs/Tiktoklogospin.gif' } },
      { id: 'instagram', label: 'Instagram', hero: { kind: 'image', src: 'gifs/Instagramlogospin.gif' } },
      { id: 'youtube', label: 'YouTube', hero: { kind: 'image', src: 'gifs/Youtubelogospin.gif' } }
    ]
  },
  {
    id: 'music',
    label: 'Music',
    items: [
      { id: 'spotify', label: 'Spotify', hero: { kind: 'image', src: 'gifs/Spotifylogospin.gif' } },
      { id: 'appleMusic', label: 'Apple Music', hero: { kind: 'image', src: 'gifs/Applemusiclogospin.gif' } },
      { id: 'bandcamp', label: 'Bandcamp', hero: { kind: 'image', src: 'gifs/bandcamplogospin.gif' } },
      { id: 'soundcloud', label: 'SoundCloud', hero: { kind: 'image', src: 'gifs/soundcloudlogospin.gif' } }
    ]
  },
  {
    id: 'games',
    label: 'Games',
    items: [
      { id: 'asymptote', label: 'Asymptote Engine', hero: { kind: 'text', text: 'Asymptote Engine' } }
    ]
  },
  {
    id: 'about',
    label: 'About',
    items: [
      { id: 'discography', label: 'Discography', hero: { kind: 'text', text: 'Discography' } },
      { id: 'devHistory', label: 'Development History', hero: { kind: 'text', text: 'Development History' } },
      { id: 'journal', label: 'Journal', hero: { kind: 'text', text: 'Journal' } }
    ]
  }
];

// State
let currentSectionIdx = 0;
let currentItemIdx = 0;
let isTransitioning = false;
let queuedTarget = null;
let activeTarget = null;

function isSameTarget(a, b) {
  return !!a && !!b && a.sectionIdx === b.sectionIdx && a.itemIdx === b.itemIdx;
}

function getHeroSpec(sectionIdx, itemIdx) {
  const section = SPA_SECTIONS[sectionIdx];
  const item = section?.items[itemIdx];
  if (!item) return null;

  if (item.hero?.kind === 'image' && item.hero.src) {
    return { kind: 'image', src: item.hero.src };
  }
  if (item.hero?.kind === 'text' && item.hero.text) {
    return { kind: 'text', text: item.hero.text };
  }

  return { kind: 'text', text: item.label };
}

function getNextTarget(sectionIdx, itemIdx) {
  const section = SPA_SECTIONS[sectionIdx];
  if (itemIdx < section.items.length - 1) {
    return { sectionIdx, itemIdx: itemIdx + 1 };
  }
  const nextSectionIdx = (sectionIdx + 1) % SPA_SECTIONS.length;
  return { sectionIdx: nextSectionIdx, itemIdx: 0 };
}

function getPrevTarget(sectionIdx, itemIdx) {
  if (itemIdx > 0) {
    return { sectionIdx, itemIdx: itemIdx - 1 };
  }
  const prevSectionIdx = (sectionIdx - 1 + SPA_SECTIONS.length) % SPA_SECTIONS.length;
  return { sectionIdx: prevSectionIdx, itemIdx: SPA_SECTIONS[prevSectionIdx].items.length - 1 };
}

/**
 * Builds a rasterizeHero input for a given section/item and transition phase.
 * phase 'from' prefers the live DOM image when available; phase 'to' is always data-driven.
 */
function buildHeroRenderInput(sectionIdx, itemIdx, phase) {
  const hero = getHeroSpec(sectionIdx, itemIdx);
  if (!hero) return null;

  if (hero.kind === 'text') {
    return { type: 'text', text: hero.text };
  }

  if (phase === 'from') {
    const container = document.getElementById('spa-hero-container');
    const liveImgEl = container?.querySelector('.spa-hero-image');
    if (liveImgEl instanceof window.HTMLImageElement) {
      return { type: 'element', element: liveImgEl };
    }
  }

  return { type: 'gif', src: hero.src };
}

/**
 * Builds a transition-ready hero surface for a given section/item/phase.
 * phase 'from' preserves current behavior: prefer live element capture and
 * fall back to stable src-based rasterization for image heroes.
 */
async function buildHeroSurface(sectionIdx, itemIdx, phase) {
  const input = buildHeroRenderInput(sectionIdx, itemIdx, phase);
  if (!input) throw new Error(`Missing hero render input for phase "${phase}"`);

  if (phase === 'from' && input.type === 'element') {
    const fallbackInput = buildHeroRenderInput(sectionIdx, itemIdx, 'to');
    if (fallbackInput?.type === 'gif') {
      return rasterizeHero(input).catch(() => rasterizeHero(fallbackInput));
    }
  }

  return rasterizeHero(input);
}

function updateSectionNav(sectionIdx) {
  let sectionNav = document.getElementById('spa-section-nav');
  if (!sectionNav) {
    sectionNav = document.createElement('div');
    sectionNav.id = 'spa-section-nav';
    sectionNav.style = 'position:fixed;top:0;left:0;width:100vw;z-index:20;display:flex;justify-content:center;gap:1.5em;padding:1em 0;background:#111;box-shadow:0 2px 12px #0006;';
    document.body.prepend(sectionNav);
  }

  sectionNav.innerHTML = '';
  SPA_SECTIONS.forEach((sec, idx) => {
    const btn = document.createElement('button');
    btn.textContent = sec.label;
    btn.className = 'spa-nav-btn';
    btn.style.fontWeight = idx === sectionIdx ? 'bold' : 'normal';
    btn.style.background = idx === sectionIdx ? '#333' : '';
    btn.onclick = () => goTo(idx, 0);
    sectionNav.appendChild(btn);
  });
}

function renderHeroDOM(sectionIdx, itemIdx) {
  const heroContainer = document.getElementById('spa-hero-container');
  const item = SPA_SECTIONS[sectionIdx].items[itemIdx];
  const heroSpec = getHeroSpec(sectionIdx, itemIdx);

  heroContainer.innerHTML = '';
  const hero = document.createElement('div');
  hero.className = 'spa-hero';

  if (heroSpec?.kind === 'image') {
    const img = document.createElement('img');
    img.className = 'spa-hero-image';
    img.src = heroSpec.src;
    img.alt = item.label;
    img.width = 320;
    img.height = 320;
    hero.appendChild(img);
  } else {
    const textDiv = document.createElement('div');
    textDiv.className = 'spa-hero-text';
    textDiv.textContent = heroSpec?.text || item.label;
    hero.appendChild(textDiv);
  }

  heroContainer.appendChild(hero);
}

function render() {
  updateSectionNav(currentSectionIdx);
  renderHeroDOM(currentSectionIdx, currentItemIdx);
}

function setupItemNav() {
  const navBar = document.getElementById('spa-item-nav');
  if (!navBar || navBar.children.length > 0) return;

  const prevBtn = document.createElement('button');
  prevBtn.className = 'spa-nav-btn';
  prevBtn.textContent = '← Prev';
  prevBtn.onclick = prevItem;
  navBar.appendChild(prevBtn);

  const nextBtn = document.createElement('button');
  nextBtn.className = 'spa-nav-btn';
  nextBtn.textContent = 'Next →';
  nextBtn.onclick = nextItem;
  navBar.appendChild(nextBtn);
}

import { rasterizeHero } from './js/spa/rasterizeHero.js';
import { transition } from './js/spa/particleTransitionEngine.js';

async function runHeroTransition(fromSurface, toSurface) {
  const heroContainer = document.getElementById('spa-hero-container');
  const transitionCanvas = document.getElementById('transition-canvas');
  const ctx = transitionCanvas.getContext('2d');

  heroContainer.style.visibility = 'hidden';
  transitionCanvas.style.display = 'block';
  ctx.clearRect(0, 0, transitionCanvas.width, transitionCanvas.height);

  function centerDraw(context, src, region) {
    const dx = (transitionCanvas.width - region.width) / 2;
    const dy = (transitionCanvas.height - region.height) / 2;
    context.drawImage(region.canvas, 0, 0, region.width, region.height, dx, dy, region.width, region.height);
  }

  try {
    await new Promise((resolve) => {
      transition(
        fromSurface.canvas,
        toSurface.canvas,
        {
          ctx,
          fromRegion: fromSurface,
          toRegion: toSurface,
          centerDraw,
        },
        resolve
      );
    });
  } finally {
    transitionCanvas.style.display = 'none';
    heroContainer.style.visibility = 'visible';
  }
}

async function goTo(nextSectionIdx, nextItemIdx) {
  const requestedTarget = { sectionIdx: nextSectionIdx, itemIdx: nextItemIdx };
  const committedTarget = { sectionIdx: currentSectionIdx, itemIdx: currentItemIdx };

  if (isSameTarget(requestedTarget, committedTarget)) return;

  if (isTransitioning) {
    if (isSameTarget(requestedTarget, activeTarget) || isSameTarget(requestedTarget, queuedTarget)) {
      return;
    }
    queuedTarget = requestedTarget;
    return;
  }

  isTransitioning = true;
  activeTarget = requestedTarget;

  try {
    const fromSectionIdx = currentSectionIdx;
    const fromItemIdx = currentItemIdx;

    let didTransition = false;

    try {
      const [fromSurface, toSurface] = await Promise.all([
        buildHeroSurface(fromSectionIdx, fromItemIdx, 'from'),
        buildHeroSurface(nextSectionIdx, nextItemIdx, 'to')
      ]);

      if (fromSurface && toSurface) {
        await runHeroTransition(fromSurface, toSurface);
        didTransition = true;
      }
    } catch (err) {
      console.warn('Hero transition skipped:', err);
    }

    currentSectionIdx = nextSectionIdx;
    currentItemIdx = nextItemIdx;
    if (didTransition) {
      renderHeroDOM(currentSectionIdx, currentItemIdx);
      updateSectionNav(currentSectionIdx);
    } else {
      render();
    }
  } finally {
    isTransitioning = false;
    activeTarget = null;

    if (queuedTarget) {
      const latest = queuedTarget;
      queuedTarget = null;
      if (!isSameTarget(latest, { sectionIdx: currentSectionIdx, itemIdx: currentItemIdx })) {
        void goTo(latest.sectionIdx, latest.itemIdx);
      }
    }
  }
}

function prevItem() {
  const target = getPrevTarget(currentSectionIdx, currentItemIdx);
  goTo(target.sectionIdx, target.itemIdx);
}

function nextItem() {
  const target = getNextTarget(currentSectionIdx, currentItemIdx);
  goTo(target.sectionIdx, target.itemIdx);
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prevItem();
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextItem();
});

let touchStartX = null;
let touchStartY = null;
window.addEventListener('touchstart', (e) => {
  if (e.touches.length === 1) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }
});
window.addEventListener('touchend', (e) => {
  if (touchStartX === null || touchStartY === null) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
    if (dx < 0) nextItem();
    else prevItem();
  } else if (Math.abs(dy) > 30) {
    if (dy < 0) nextItem();
    else prevItem();
  }
  touchStartX = null;
  touchStartY = null;
});

setupItemNav();
render();
