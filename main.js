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
let currentHeroSurface = null;
let currentHeroSurfaceKey = null;
let currentHeroSurfaceFrameId = null;
let currentHeroSurfaceTrackingKey = null;
let lastDesktopNavInputAt = 0;
let activeGifPlayback = null;

const DESKTOP_CHAIN_WINDOW_MS = 260;

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

function createTextProbe(text) {
  const container = document.getElementById('spa-hero-container');
  if (!container) return null;

  const probeHero = document.createElement('div');
  probeHero.className = 'spa-hero';
  probeHero.style.position = 'absolute';
  probeHero.style.pointerEvents = 'none';
  probeHero.style.margin = '0';
  probeHero.style.left = '-9999px';
  probeHero.style.top = '-9999px';

  const liveHeroEl = container.querySelector('.spa-hero');
  if (liveHeroEl instanceof window.HTMLElement) {
    const liveHeroRect = liveHeroEl.getBoundingClientRect();
    if (liveHeroRect.width > 0) probeHero.style.width = `${liveHeroRect.width}px`;
  } else {
    const fallbackWidth = Math.min(container.clientWidth || 320, 608);
    probeHero.style.width = `${Math.max(220, fallbackWidth)}px`;
  }

  const probeText = document.createElement('div');
  probeText.className = 'spa-hero-text';
  probeText.textContent = text;
  probeText.style.margin = '0';

  probeHero.appendChild(probeText);
  container.appendChild(probeHero);

  return { element: probeText, cleanup: () => probeHero.remove() };
}

async function rasterizeWithCleanup(input) {
  try {
    return await rasterizeHero(input);
  } finally {
    if (typeof input?.cleanup === 'function') {
      input.cleanup();
    }
  }
}

function getHeroSurfaceKey(sectionIdx, itemIdx) {
  return `${sectionIdx}:${itemIdx}`;
}

function isGifHeroSpec(hero) {
  return hero?.kind === 'image' && /\.gif(?:[?#]|$)/i.test(hero.src || '');
}

function stopActiveGifHeroPlayback() {
  if (!activeGifPlayback) return;
  if (activeGifPlayback.rafId !== null) {
    window.cancelAnimationFrame(activeGifPlayback.rafId);
  }
  activeGifPlayback = null;
}

function startGifHeroPlayback({ canvas, src, width = 320, height = 320, playbackKey }) {
  stopActiveGifHeroPlayback();

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const feedImg = new window.Image();
  feedImg.decoding = 'async';
  let rafId = null;
  let isActive = true;

  const drawFrame = () => {
    if (!isActive) return;
    if (feedImg.complete && feedImg.naturalWidth && feedImg.naturalHeight) {
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(feedImg, 0, 0, feedImg.naturalWidth, feedImg.naturalHeight, 0, 0, width, height);
    }
    rafId = window.requestAnimationFrame(drawFrame);
    activeGifPlayback = { rafId, canvas, playbackKey };
  };

  feedImg.onload = () => {
    console.debug(`[gifPlayback] started key=${playbackKey} src=${src}`);
    drawFrame();
  };
  feedImg.onerror = () => {
    console.warn(`[gifPlayback] failed to load src=${src}`);
  };
  feedImg.src = src;

  activeGifPlayback = { rafId, canvas, playbackKey };

  return () => {
    isActive = false;
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
    }
    if (activeGifPlayback?.playbackKey === playbackKey) {
      activeGifPlayback = null;
    }
  };
}

async function refreshCurrentHeroSurface(sectionIdx, itemIdx) {
  const surfaceKey = getHeroSurfaceKey(sectionIdx, itemIdx);

  try {
    const input = buildHeroRenderInput(sectionIdx, itemIdx, 'from');
    if (!input) {
      currentHeroSurface = null;
      currentHeroSurfaceKey = null;
      return null;
    }

    const surface = await rasterizeHero(input);
    currentHeroSurface = surface;
    currentHeroSurfaceKey = surfaceKey;
    return surface;
  } catch (err) {
    console.warn('Current hero surface refresh failed:', err);
    currentHeroSurface = null;
    currentHeroSurfaceKey = null;
    return null;
  }
}

function stopCurrentHeroSurfaceTracking() {
  if (currentHeroSurfaceFrameId !== null) {
    window.cancelAnimationFrame(currentHeroSurfaceFrameId);
    currentHeroSurfaceFrameId = null;
  }
  currentHeroSurfaceTrackingKey = null;
}

function startCurrentHeroSurfaceTracking(sectionIdx, itemIdx) {
  stopCurrentHeroSurfaceTracking();

  const hero = getHeroSpec(sectionIdx, itemIdx);
  if (!hero) {
    currentHeroSurface = null;
    currentHeroSurfaceKey = null;
    return;
  }

  const surfaceKey = getHeroSurfaceKey(sectionIdx, itemIdx);
  currentHeroSurfaceTrackingKey = surfaceKey;

  if (hero.kind === 'text') {
    void refreshCurrentHeroSurface(sectionIdx, itemIdx);
    return;
  }

  if (isGifHeroSpec(hero)) {
    currentHeroSurface = null;
    currentHeroSurfaceKey = null;
    console.debug('[heroCapture] skipping cached surface tracking for live GIF canvas hero');
    return;
  }

  const trackFrame = () => {
    if (
      isTransitioning ||
      currentHeroSurfaceTrackingKey !== surfaceKey ||
      !isSameTarget({ sectionIdx, itemIdx }, { sectionIdx: currentSectionIdx, itemIdx: currentItemIdx })
    ) {
      currentHeroSurfaceFrameId = null;
      return;
    }

    void refreshCurrentHeroSurface(sectionIdx, itemIdx).finally(() => {
      if (
        !isTransitioning &&
        currentHeroSurfaceTrackingKey === surfaceKey &&
        isSameTarget({ sectionIdx, itemIdx }, { sectionIdx: currentSectionIdx, itemIdx: currentItemIdx })
      ) {
        currentHeroSurfaceFrameId = window.requestAnimationFrame(trackFrame);
      } else {
        currentHeroSurfaceFrameId = null;
      }
    });
  };

  void refreshCurrentHeroSurface(sectionIdx, itemIdx).finally(() => {
    if (!isTransitioning && currentHeroSurfaceTrackingKey === surfaceKey) {
      currentHeroSurfaceFrameId = window.requestAnimationFrame(trackFrame);
    }
  });
}

/**
 * Builds a rasterizeHero input for a given section/item and transition phase.
 * phase 'from' prefers the live DOM image when available; phase 'to' is always data-driven.
 */
function buildHeroRenderInput(sectionIdx, itemIdx, phase) {
  const hero = getHeroSpec(sectionIdx, itemIdx);
  if (!hero) return null;

  console.debug(`[heroCapture] build input phase=${phase} kind=${hero.kind}`);

  if (hero.kind === 'text') {
    const container = document.getElementById('spa-hero-container');
    const liveTextEl = container?.querySelector('.spa-hero-text');

    if (phase === 'from' && liveTextEl instanceof window.HTMLElement) {
      return { type: 'textElement', element: liveTextEl };
    }

    const probe = createTextProbe(hero.text);
    if (probe) {
      return { type: 'textElement', element: probe.element, cleanup: probe.cleanup };
    }

    return { type: 'text', text: hero.text };
  }

  if (phase === 'from') {
    const container = document.getElementById('spa-hero-container');
    const liveGifCanvasEl = container?.querySelector('.spa-hero-gif-canvas');
    if (liveGifCanvasEl instanceof window.HTMLCanvasElement) {
      console.debug('[heroCapture] from GIF uses live canvas surface');
      return { type: 'element', element: liveGifCanvasEl };
    }
    const liveImgEl = container?.querySelector('.spa-hero-image');
    if (liveImgEl instanceof window.HTMLImageElement) {
      console.debug(
        `[heroCapture] from image uses live element src=${liveImgEl.currentSrc || liveImgEl.src} complete=${liveImgEl.complete}`
      );
      return { type: 'element', element: liveImgEl };
    }
  }

  console.debug(`[heroCapture] image fallback uses src rasterization src=${hero.src} phase=${phase}`);
  return { type: 'gif', src: hero.src };
}

/**
 * Builds a transition-ready hero surface for a given section/item/phase.
 * phase 'from' preserves current behavior: prefer live element capture and
 * fall back to stable src-based rasterization for image heroes.
 */
async function buildHeroSurface(sectionIdx, itemIdx, phase) {
  const hero = getHeroSpec(sectionIdx, itemIdx);
  const shouldForceLiveGifFromCapture = phase === 'from' && isGifHeroSpec(hero);

  if (phase === 'from') {
    const requestedSurfaceKey = getHeroSurfaceKey(sectionIdx, itemIdx);
    const committedSurfaceKey = getHeroSurfaceKey(currentSectionIdx, currentItemIdx);
    if (
      !shouldForceLiveGifFromCapture &&
      requestedSurfaceKey === committedSurfaceKey &&
      currentHeroSurface &&
      currentHeroSurfaceKey === requestedSurfaceKey
    ) {
      console.debug(`[heroCapture] reusing cached from-surface key=${requestedSurfaceKey}`);
      return currentHeroSurface;
    }

    if (shouldForceLiveGifFromCapture) {
      console.debug('[heroCapture] forcing live GIF from-surface capture at transition start');
    }
  }

  const input = buildHeroRenderInput(sectionIdx, itemIdx, phase);
  if (!input) throw new Error(`Missing hero render input for phase "${phase}"`);

  if (phase === 'from' && input.type === 'element') {
    const fallbackInput = buildHeroRenderInput(sectionIdx, itemIdx, 'to');
    if (fallbackInput?.type === 'gif') {
      return rasterizeWithCleanup(input).catch((err) => {
        console.debug(`[heroCapture] live element capture failed; falling back to src rasterization: ${err?.message || err}`);
        return rasterizeWithCleanup(fallbackInput);
      });
    }
  }

  return rasterizeWithCleanup(input);
}

function updateSectionNav(sectionIdx) {
  let sectionNav = document.getElementById('spa-section-nav');
  if (!sectionNav) {
    sectionNav = document.createElement('div');
    sectionNav.id = 'spa-section-nav';
    document.body.prepend(sectionNav);
  }

  sectionNav.innerHTML = '';
  SPA_SECTIONS.forEach((sec, idx) => {
    const btn = document.createElement('button');
    btn.textContent = sec.label;
    btn.type = 'button';
    btn.className = 'spa-nav-btn';
    btn.style.fontWeight = idx === sectionIdx ? 'bold' : 'normal';
    btn.style.background = idx === sectionIdx ? '#333' : '';
    btn.setAttribute('aria-current', idx === sectionIdx ? 'page' : 'false');
    btn.onclick = () => goTo(idx, 0);
    sectionNav.appendChild(btn);
  });
}

function renderHeroDOM(sectionIdx, itemIdx) {
  const heroContainer = document.getElementById('spa-hero-container');
  const item = SPA_SECTIONS[sectionIdx].items[itemIdx];
  const heroSpec = getHeroSpec(sectionIdx, itemIdx);

  stopActiveGifHeroPlayback();
  heroContainer.innerHTML = '';
  const hero = document.createElement('div');
  hero.className = 'spa-hero';

  if (heroSpec?.kind === 'image') {
    if (isGifHeroSpec(heroSpec)) {
      const gifCanvas = document.createElement('canvas');
      gifCanvas.className = 'spa-hero-gif spa-hero-gif-canvas';
      gifCanvas.width = 320;
      gifCanvas.height = 320;
      gifCanvas.setAttribute('role', 'img');
      gifCanvas.setAttribute('aria-label', item.label);
      hero.appendChild(gifCanvas);
      startGifHeroPlayback({
        canvas: gifCanvas,
        src: heroSpec.src,
        width: 320,
        height: 320,
        playbackKey: getHeroSurfaceKey(sectionIdx, itemIdx)
      });
    } else {
      const img = document.createElement('img');
      img.className = 'spa-hero-image';
      img.src = heroSpec.src;
      img.alt = item.label;
      img.width = 320;
      img.height = 320;
      hero.appendChild(img);
    }
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
  prevBtn.type = 'button';
  prevBtn.className = 'spa-nav-btn';
  prevBtn.textContent = '← Prev';
  prevBtn.setAttribute('aria-label', 'Previous item');
  prevBtn.onclick = prevItem;
  navBar.appendChild(prevBtn);

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'spa-nav-btn';
  nextBtn.textContent = 'Next →';
  nextBtn.setAttribute('aria-label', 'Next item');
  nextBtn.onclick = nextItem;
  navBar.appendChild(nextBtn);
}

function alignTransitionCanvas(transitionCanvas, fromSurface, toSurface) {
  const root = document.getElementById('spa-root');
  const hero = document.querySelector('#spa-hero-container .spa-hero');
  const heroContainer = document.getElementById('spa-hero-container');
  if (!root || !heroContainer) return;

  const STAGE_PADDING_PX = 72;
  const baseStageWidth = Math.max(fromSurface?.width || 0, toSurface?.width || 0, 1);
  const baseStageHeight = Math.max(fromSurface?.height || 0, toSurface?.height || 0, 1);
  const stageWidth = baseStageWidth + (STAGE_PADDING_PX * 2);
  const stageHeight = baseStageHeight + (STAGE_PADDING_PX * 2);

  transitionCanvas.width = stageWidth;
  transitionCanvas.height = stageHeight;

  const rootRect = root.getBoundingClientRect();
  const anchorRect = (hero || heroContainer).getBoundingClientRect();
  const centerX = anchorRect.left - rootRect.left + (anchorRect.width / 2);
  const centerY = anchorRect.top - rootRect.top + (anchorRect.height / 2);

  transitionCanvas.style.left = `${centerX}px`;
  transitionCanvas.style.top = `${centerY}px`;
}

import { rasterizeHero } from './js/spa/rasterizeHero.js';
import { transition } from './js/spa/particleTransitionEngine.js';

async function runHeroTransition(fromSurface, toSurface, transitionOptions = {}) {
  const heroContainer = document.getElementById('spa-hero-container');
  const transitionCanvas = document.getElementById('transition-canvas');
  alignTransitionCanvas(transitionCanvas, fromSurface, toSurface);
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
          ...transitionOptions
        },
        resolve
      );
    });
  } finally {
    transitionCanvas.style.display = 'none';
    heroContainer.style.visibility = 'visible';
  }
}

async function goTo(nextSectionIdx, nextItemIdx, navOptions = {}) {
  const requestedTarget = { sectionIdx: nextSectionIdx, itemIdx: nextItemIdx };
  const committedTarget = { sectionIdx: currentSectionIdx, itemIdx: currentItemIdx };

  if (isSameTarget(requestedTarget, committedTarget)) return;

  if (isTransitioning) {
    if (isSameTarget(requestedTarget, activeTarget) || isSameTarget(requestedTarget, queuedTarget)) {
      return;
    }
    queuedTarget = { ...requestedTarget, transitionOptions: navOptions.transitionOptions || null };
    return;
  }

  isTransitioning = true;
  activeTarget = { ...requestedTarget, transitionOptions: navOptions.transitionOptions || null };
  stopActiveGifHeroPlayback();
  stopCurrentHeroSurfaceTracking();

  try {
    const fromSectionIdx = currentSectionIdx;
    const fromItemIdx = currentItemIdx;

    let didTransition = false;

    try {
      console.debug(
        `[heroCapture] transition start from=${fromSectionIdx}:${fromItemIdx} to=${nextSectionIdx}:${nextItemIdx} at=${performance.now().toFixed(1)}ms`
      );
      const [fromSurface, toSurface] = await Promise.all([
        buildHeroSurface(fromSectionIdx, fromItemIdx, 'from'),
        buildHeroSurface(nextSectionIdx, nextItemIdx, 'to')
      ]);

      if (fromSurface && toSurface) {
        await runHeroTransition(fromSurface, toSurface, navOptions.transitionOptions);
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
    startCurrentHeroSurfaceTracking(currentSectionIdx, currentItemIdx);

    if (queuedTarget) {
      const latest = queuedTarget;
      queuedTarget = null;
      if (!isSameTarget(latest, { sectionIdx: currentSectionIdx, itemIdx: currentItemIdx })) {
        void goTo(latest.sectionIdx, latest.itemIdx, { transitionOptions: latest.transitionOptions || undefined });
      }
    }
  }
}

function getDesktopNavOptions() {
  const now = performance.now();
  const isChained = now - lastDesktopNavInputAt <= DESKTOP_CHAIN_WINDOW_MS;
  lastDesktopNavInputAt = now;

  if (!isChained) return {};

  return {
    transitionOptions: {
      timingProfile: 'chained'
    }
  };
}

function prevItem(navOptions = {}) {
  const target = getPrevTarget(currentSectionIdx, currentItemIdx);
  goTo(target.sectionIdx, target.itemIdx, navOptions);
}

function nextItem(navOptions = {}) {
  const target = getNextTarget(currentSectionIdx, currentItemIdx);
  goTo(target.sectionIdx, target.itemIdx, navOptions);
}

window.addEventListener('keydown', (e) => {
  const isPrev = e.key === 'ArrowLeft' || e.key === 'ArrowUp';
  const isNext = e.key === 'ArrowRight' || e.key === 'ArrowDown';
  if (!isPrev && !isNext) return;

  const navOptions = getDesktopNavOptions();
  if (isPrev) prevItem(navOptions);
  if (isNext) nextItem(navOptions);
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
startCurrentHeroSurfaceTracking(currentSectionIdx, currentItemIdx);
