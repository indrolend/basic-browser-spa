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
let giflerLoaderPromise = null;
let preparedToGifCanvas = null;
let preparedToGifKey = null;

// ─── Slingshot pull state ─────────────────────────────────────────────────────
let isPulling = false;
let pullTargetSectionIdx = null;
let pullTargetItemIdx = null;
let pullFromSurface = null;
let pullToSurface = null;
let pullFromSurfacePromise = null;
let pullToSurfacePromise = null;
let pullPreviewParticlesBase = null; // sampled once when Phase B begins
let pullPreviewParticles = null;     // updated every frame; passed to transitionFromPull on release
let pullPreviewCanvasW = 0;          // canvas dimensions when pullPreviewParticlesBase was sampled
let pullPreviewCanvasH = 0;

const DESKTOP_CHAIN_WINDOW_MS = 260;
const REVEAL_HANDOFF_FADE_MS = 70;

// ─── Game mode flag ───────────────────────────────────────────────────────────
// Set to true while the Asymptote overlay is active.
// Blocks slingshot navigation and keyboard arrow nav so the player can't
// accidentally swipe out of the game.
let isAsymptoteGameActive = false;
window.__SPA_SetGameMode = (active) => { isAsymptoteGameActive = !!active; };
// Navigate to home/swarm — used by the game's exit (✕) button.
window.__SPA_GoHome = () => goTo(0, 0);

// Unified fast-click helper: fires handler on touchend (immediately, no 300ms delay)
// and on click (mouse fallback). The touchend listener calls preventDefault() so the
// synthetic click generated after touch is suppressed, avoiding a double-fire.
// Screen readers (VoiceOver, TalkBack) fire `click` directly via accessibility APIs
// rather than through the touch event chain, so they use the onclick path unaffected.
function addActivationHandler(element, handler) {
  element.addEventListener('touchend', (e) => { e.preventDefault(); handler(); });
  element.onclick = handler;
}

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

function getItemClickAction(sectionIdx, itemIdx) {
  const routes = window.__INDROLEND_ROUTES__;
  if (!routes) return null;
  const section = SPA_SECTIONS[sectionIdx];
  const item = section?.items[itemIdx];
  if (!section || !item) return null;
  const key = `${section.id}/${item.id}`;
  return routes.items?.[key]?.clickAction ?? null;
}

function isExternalLink(action) {
  return typeof action === 'string' && action.startsWith('http');
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
  if (typeof activeGifPlayback.stop === 'function') {
    activeGifPlayback.stop();
  }
  activeGifPlayback = null;
}

function loadGifler() {
  if (typeof window.gifler === 'function') return Promise.resolve(window.gifler);
  if (giflerLoaderPromise) return giflerLoaderPromise;

  giflerLoaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/gifler@0.1.0/gifler.min.js';
    script.async = true;
    script.onload = () => {
      if (typeof window.gifler === 'function') resolve(window.gifler);
      else reject(new Error('gifler loaded but window.gifler is unavailable'));
    };
    script.onerror = () => reject(new Error('Failed to load gifler'));
    document.head.appendChild(script);
  });

  return giflerLoaderPromise;
}

function startGifHeroPlayback({ canvas, src, width = 320, height = 320, playbackKey }) {
  stopActiveGifHeroPlayback();

  let disposed = false;
  if (canvas.width !== width) {
    canvas.width = width;
  }
  if (canvas.height !== height) {
    canvas.height = height;
  }

  const playbackState = {
    playbackKey,
    stop: () => {
      disposed = true;
      if (typeof playbackState.animator?.stop === 'function') {
        playbackState.animator.stop();
      }
    },
    animator: null,
    hasPaintedFrame: false
  };
  activeGifPlayback = playbackState;

  loadGifler()
    .then((gifler) => {
      if (disposed || activeGifPlayback !== playbackState) return;
      const animator = gifler(src).animate(canvas, (ctx, frame) => {
        if (!frame?.buffer) return;
        const srcW = frame.width || frame.buffer.width || width;
        const srcH = frame.height || frame.buffer.height || height;
        const scale = Math.min(width / srcW, height / srcH);
        const drawW = srcW * scale;
        const drawH = srcH * scale;
        const dx = (width - drawW) / 2;
        const dy = (height - drawH) / 2;
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(frame.buffer, 0, 0, srcW, srcH, dx, dy, drawW, drawH);
        playbackState.hasPaintedFrame = true;
      });
      playbackState.animator = animator;
      console.debug(`[gifPlayback] started key=${playbackKey} src=${src} via gifler`);
    })
    .catch((err) => {
      console.warn(`[gifPlayback] failed key=${playbackKey} src=${src}: ${err?.message || err}`);
      if (disposed || activeGifPlayback !== playbackState) return;
      const fallbackImg = new window.Image();
      fallbackImg.onload = () => {
        if (disposed || activeGifPlayback !== playbackState) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, width, height);
        const srcW = fallbackImg.naturalWidth || width;
        const srcH = fallbackImg.naturalHeight || height;
        const scale = Math.min(width / srcW, height / srcH);
        const drawW = srcW * scale;
        const drawH = srcH * scale;
        const dx = (width - drawW) / 2;
        const dy = (height - drawH) / 2;
        ctx.drawImage(fallbackImg, 0, 0, srcW, srcH, dx, dy, drawW, drawH);
        playbackState.hasPaintedFrame = true;
      };
      fallbackImg.src = src;
    });

  return {
    stop: () => {
      playbackState.stop();
      if (activeGifPlayback === playbackState) {
        activeGifPlayback = null;
      }
    }
  };
}

function getPreparedToGifCanvas(sectionIdx, itemIdx) {
  const key = getHeroSurfaceKey(sectionIdx, itemIdx);
  if (preparedToGifKey === key && preparedToGifCanvas instanceof window.HTMLCanvasElement) {
    return preparedToGifCanvas;
  }
  return null;
}

function prepareToGifCanvas(sectionIdx, itemIdx, src, width = 320, height = 320) {
  const key = getHeroSurfaceKey(sectionIdx, itemIdx);
  const existing = getPreparedToGifCanvas(sectionIdx, itemIdx);
  if (existing) return existing;

  const canvas = document.createElement('canvas');
  canvas.className = 'spa-hero-gif spa-hero-gif-canvas';
  canvas.width = width;
  canvas.height = height;
  startGifHeroPlayback({ canvas, src, width, height, playbackKey: `prepared:${key}` });
  preparedToGifCanvas = canvas;
  preparedToGifKey = key;
  return canvas;
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
    addActivationHandler(btn, () => goTo(idx, 0));
    sectionNav.appendChild(btn);
  });
}

function updateItemDots(sectionIdx, itemIdx) {
  const dotsBar = document.getElementById('spa-dots');
  if (!dotsBar) return;
  const items = SPA_SECTIONS[sectionIdx]?.items || [];
  dotsBar.innerHTML = '';
  if (items.length <= 1) return;
  items.forEach((item, idx) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'spa-dot';
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', item.label);
    dot.setAttribute('aria-selected', idx === itemIdx ? 'true' : 'false');
    addActivationHandler(dot, () => goTo(sectionIdx, idx));
    dotsBar.appendChild(dot);
  });
}

function renderHeroDOM(sectionIdx, itemIdx, options = {}) {
  const heroContainer = document.getElementById('spa-hero-container');
  const item = SPA_SECTIONS[sectionIdx].items[itemIdx];
  const heroSpec = getHeroSpec(sectionIdx, itemIdx);

  if (!options.preserveActiveGifPlayback) {
    stopActiveGifHeroPlayback();
  }
  heroContainer.innerHTML = '';

  // Delegate to registered view module if available
  const sectionId = SPA_SECTIONS[sectionIdx]?.id;
  const itemId = item?.id;
  if (sectionId && itemId && window.__SPA_Views?.[sectionId]?.mount) {
    try {
      window.__SPA_Views[sectionId].mount(itemId, heroContainer);
      return;
    } catch (err) {
      console.warn('[SPA_Views] mount failed for', sectionId + '/' + itemId, err);
      // Fall through to default hero rendering
    }
  }

  const hero = document.createElement('div');
  hero.className = 'spa-hero';

  const clickAction = getItemClickAction(sectionIdx, itemIdx);
  if (isExternalLink(clickAction)) {
    hero.classList.add('spa-hero--linkable');
    hero.setAttribute('role', 'link');
    hero.setAttribute('aria-label', `Open ${item.label}`);
    hero.setAttribute('tabindex', '0');
    hero.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!isTransitioning && !isPulling) {
          window.open(clickAction, '_blank', 'noopener,noreferrer');
        }
      }
    });
  }

  if (heroSpec?.kind === 'image') {
    if (isGifHeroSpec(heroSpec)) {
      const gifCanvas = options.preparedGifCanvas instanceof window.HTMLCanvasElement
        ? options.preparedGifCanvas
        : document.createElement('canvas');
      gifCanvas.className = 'spa-hero-gif spa-hero-gif-canvas';
      if (gifCanvas.width !== 320) gifCanvas.width = 320;
      if (gifCanvas.height !== 320) gifCanvas.height = 320;
      gifCanvas.setAttribute('role', 'img');
      gifCanvas.setAttribute('aria-label', item.label);
      if (options.gifWarmupSurface instanceof window.HTMLCanvasElement && !(options.preparedGifCanvas instanceof window.HTMLCanvasElement)) {
        const warmCtx = gifCanvas.getContext('2d');
        if (warmCtx) {
          warmCtx.clearRect(0, 0, gifCanvas.width, gifCanvas.height);
          warmCtx.drawImage(options.gifWarmupSurface, 0, 0, gifCanvas.width, gifCanvas.height);
          console.debug('[gifPlayback] seeded visible canvas with prewarmed first frame');
        }
      }
      hero.appendChild(gifCanvas);
      if (!(options.preparedGifCanvas instanceof window.HTMLCanvasElement)) {
        startGifHeroPlayback({
          canvas: gifCanvas,
          src: heroSpec.src,
          width: 320,
          height: 320,
          playbackKey: getHeroSurfaceKey(sectionIdx, itemIdx)
        });
      }
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
  updateItemDots(currentSectionIdx, currentItemIdx);
  renderHeroDOM(currentSectionIdx, currentItemIdx);
}

function setupItemNav() {
  const navBar = document.getElementById('spa-item-nav');
  if (!navBar) return;

  let prevBtn = document.getElementById('spa-prev-btn');
  if (!prevBtn) {
    prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.id = 'spa-prev-btn';
    prevBtn.className = 'spa-nav-btn';
    prevBtn.textContent = '← Prev';
    prevBtn.setAttribute('aria-label', 'Previous item');
    navBar.appendChild(prevBtn);
  }

  let nextBtn = document.getElementById('spa-next-btn');
  if (!nextBtn) {
    nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.id = 'spa-next-btn';
    nextBtn.className = 'spa-nav-btn';
    nextBtn.textContent = 'Next →';
    nextBtn.setAttribute('aria-label', 'Next item');
    navBar.appendChild(nextBtn);
  }

  addActivationHandler(prevBtn, prevItem);
  addActivationHandler(nextBtn, nextItem);
}

const STAGE_PADDING_PX = 72;

function alignTransitionCanvas(transitionCanvas, fromSurface, toSurface) {
  const root = document.getElementById('spa-root');
  const hero = document.querySelector('#spa-hero-container .spa-hero');
  const heroContainer = document.getElementById('spa-hero-container');
  if (!root || !heroContainer) return;

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
import { transition, transitionFromPull } from './js/spa/particleTransitionEngine.js';
import { initSlingshot } from './js/spa/slingshotGesture.js';

async function runHeroTransition(fromSurface, toSurface, transitionOptions = {}) {
  const heroContainer = document.getElementById('spa-hero-container');
  const transitionCanvas = document.getElementById('transition-canvas');
  const { onBeforeReveal, ...engineOptions } = transitionOptions || {};
  alignTransitionCanvas(transitionCanvas, fromSurface, toSurface);
  const ctx = transitionCanvas.getContext('2d');

  heroContainer.style.visibility = 'hidden';
  heroContainer.style.opacity = '0';
  heroContainer.style.transition = '';
  transitionCanvas.style.display = 'block';
  transitionCanvas.style.opacity = '1';
  transitionCanvas.style.transition = '';
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
          ...engineOptions
        },
        resolve
      );
    });
  } finally {
    if (typeof onBeforeReveal === 'function') {
      await onBeforeReveal();
    }
    heroContainer.style.visibility = 'visible';
    heroContainer.style.transition = `opacity ${REVEAL_HANDOFF_FADE_MS}ms ease-out`;
    transitionCanvas.style.transition = `opacity ${REVEAL_HANDOFF_FADE_MS}ms ease-in`;
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    heroContainer.style.opacity = '1';
    transitionCanvas.style.opacity = '0';
    await new Promise((resolve) => window.setTimeout(resolve, REVEAL_HANDOFF_FADE_MS));
    transitionCanvas.style.display = 'none';
    transitionCanvas.style.opacity = '1';
    transitionCanvas.style.transition = '';
    heroContainer.style.transition = '';
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

  // Deactivate outgoing view
  {
    const fromSectionId = SPA_SECTIONS[currentSectionIdx]?.id;
    const fromItemId = SPA_SECTIONS[currentSectionIdx]?.items[currentItemIdx]?.id;
    if (fromSectionId && fromItemId) {
      try { window.__SPA_Views?.[fromSectionId]?.onDeactivate?.(fromItemId); } catch (_) {}
    }
  }

  try {
    const fromSectionIdx = currentSectionIdx;
    const fromItemIdx = currentItemIdx;
    const nextHeroSpec = getHeroSpec(nextSectionIdx, nextItemIdx);
    const preparedTargetCanvas = isGifHeroSpec(nextHeroSpec)
      ? prepareToGifCanvas(nextSectionIdx, nextItemIdx, nextHeroSpec.src)
      : null;

    let didTransition = false;
    let didRenderDuringReveal = false;

    try {
      console.debug(
        `[heroCapture] transition start from=${fromSectionIdx}:${fromItemIdx} to=${nextSectionIdx}:${nextItemIdx} at=${performance.now().toFixed(1)}ms`
      );
      const [fromSurface, toSurface] = await Promise.all([
        buildHeroSurface(fromSectionIdx, fromItemIdx, 'from'),
        buildHeroSurface(nextSectionIdx, nextItemIdx, 'to')
      ]);

      if (fromSurface && toSurface) {
        await runHeroTransition(fromSurface, toSurface, {
          ...(navOptions.transitionOptions || {}),
          onBeforeReveal: async () => {
            const preparedPlaybackKey = `prepared:${getHeroSurfaceKey(nextSectionIdx, nextItemIdx)}`;
            const canReusePreparedGif =
              preparedTargetCanvas instanceof window.HTMLCanvasElement &&
              activeGifPlayback?.playbackKey === preparedPlaybackKey &&
              activeGifPlayback?.hasPaintedFrame;
            renderHeroDOM(nextSectionIdx, nextItemIdx, {
              preparedGifCanvas: canReusePreparedGif ? preparedTargetCanvas : null,
              preserveActiveGifPlayback: canReusePreparedGif
            });
            updateSectionNav(nextSectionIdx);
            updateItemDots(nextSectionIdx, nextItemIdx);
            didRenderDuringReveal = true;
          }
        });
        didTransition = true;
      }
    } catch (err) {
      console.warn('Hero transition skipped:', err);
    }

    currentSectionIdx = nextSectionIdx;
    currentItemIdx = nextItemIdx;
    preparedToGifCanvas = null;
    preparedToGifKey = null;

    // Activate incoming view
    {
      const toSectionId = SPA_SECTIONS[currentSectionIdx]?.id;
      const toItemId = SPA_SECTIONS[currentSectionIdx]?.items[currentItemIdx]?.id;
      if (toSectionId && toItemId) {
        try { window.__SPA_Views?.[toSectionId]?.onActivate?.(toItemId); } catch (_) {}
      }
    }

    if (didTransition && !didRenderDuringReveal) {
      renderHeroDOM(currentSectionIdx, currentItemIdx);
      updateSectionNav(currentSectionIdx);
      updateItemDots(currentSectionIdx, currentItemIdx);
    } else if (!didTransition) {
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
  // Don't navigate the SPA while the Asymptote game overlay is open
  if (isAsymptoteGameActive) return;

  const isPrev = e.key === 'ArrowLeft' || e.key === 'ArrowUp';
  const isNext = e.key === 'ArrowRight' || e.key === 'ArrowDown';
  if (!isPrev && !isNext) return;

  const navOptions = getDesktopNavOptions();
  if (isPrev) prevItem(navOptions);
  if (isNext) nextItem(navOptions);
});

// ─── Pull preview helpers ─────────────────────────────────────────────────────

const SLINGSHOT_PARTICLE_SIZE = 4;
const SLINGSHOT_MIN_RELEASE   = 0.15; // pullNormalized must exceed this to commit

function samplePullParticles(surface, canvasW, canvasH) {
  const offscreen = document.createElement('canvas');
  offscreen.width  = canvasW;
  offscreen.height = canvasH;
  const octx = offscreen.getContext('2d');
  const dx = (canvasW - surface.width)  / 2;
  const dy = (canvasH - surface.height) / 2;
  octx.clearRect(0, 0, canvasW, canvasH);
  octx.drawImage(surface.canvas, 0, 0, surface.width, surface.height, dx, dy, surface.width, surface.height);
  const imgData = octx.getImageData(0, 0, canvasW, canvasH).data;
  const cX = canvasW / 2;
  const cY = canvasH / 2;
  const out = [];
  for (let y = 0; y < canvasH; y += SLINGSHOT_PARTICLE_SIZE) {
    for (let x = 0; x < canvasW; x += SLINGSHOT_PARTICLE_SIZE) {
      const idx = (y * canvasW + x) * 4;
      const r = imgData[idx], g = imgData[idx + 1], b = imgData[idx + 2], a = imgData[idx + 3];
      if (a > 32) {
        out.push({
          x, y,
          cx: x - cX, cy: y - cY,                     // offset from canvas center
          color: `rgba(${r},${g},${b},${a / 255})`,
          frayX: (Math.random() - 0.5) * 2,            // stable per-particle random direction
          frayY: (Math.random() - 0.5) * 2
        });
      }
    }
  }
  return out;
}

function renderPullPreview(pullVector, pullNormalized) {
  if (!pullFromSurface) return;

  const transitionCanvas = document.getElementById('transition-canvas');
  const ctx = transitionCanvas.getContext('2d');
  const cW  = transitionCanvas.width;
  const cH  = transitionCanvas.height;

  ctx.clearRect(0, 0, cW, cH);

  // Hero is always drawn at canvas center — no translation, never drifts off-screen
  const drawX = (cW - pullFromSurface.width)  / 2;
  const drawY = (cH - pullFromSurface.height) / 2;

  if (pullNormalized < 0.25) {
    // Phase A — solid hero, centered, no offset
    ctx.drawImage(
      pullFromSurface.canvas, 0, 0, pullFromSurface.width, pullFromSurface.height,
      drawX, drawY, pullFromSurface.width, pullFromSurface.height
    );
    pullPreviewParticles = null;
    return;
  }

  // Sample particles once on first entry to Phase B
  if (!pullPreviewParticlesBase) {
    pullPreviewParticlesBase = samplePullParticles(pullFromSurface, cW, cH);
    pullPreviewCanvasW = cW;
    pullPreviewCanvasH = cH;
  }

  // Phase B (0.25–0.65): hero fades out, particles fade in, edges fray first
  // Phase C (0.65–1.0):  fully particle-based, maximum fray
  const phaseB = pullNormalized < 0.65 ? (pullNormalized - 0.25) / 0.40 : 1.0;
  const phaseC = pullNormalized >= 0.65 ? (pullNormalized - 0.65) / 0.35 : 0.0;
  const heroAlpha = 1 - phaseB;
  const maxRadius = Math.sqrt((cW / 2) * (cW / 2) + (cH / 2) * (cH / 2));

  // Pull direction unit vector
  const pullDist = Math.sqrt(pullVector.x * pullVector.x + pullVector.y * pullVector.y) || 1;
  const pullNx   = pullVector.x / pullDist;
  const pullNy   = pullVector.y / pullDist;

  // Draw fading hero image beneath particles (always centered, no offset)
  if (heroAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = heroAlpha;
    ctx.drawImage(
      pullFromSurface.canvas, 0, 0, pullFromSurface.width, pullFromSurface.height,
      drawX, drawY, pullFromSurface.width, pullFromSurface.height
    );
    ctx.restore();
  }

  // Asymmetric directional stretch: trailing-side particles (opposite to pull) get
  // ~3× more displacement than leading-side particles. This creates a "lagging behind"
  // smear — the cloud trails in the direction opposite to the pull — while keeping
  // the centroid very close to canvas center (net shift < ~15px at full pull).
  const STRETCH_MAX = 55; // px — baseline at pullNormalized = 1
  const fraying = phaseB + phaseC * 0.6;
  const current = [];
  for (const p of pullPreviewParticlesBase) {
    // Signed projection onto pull axis, normalised to roughly ±1 across the canvas
    const proj      = (p.cx * pullNx + p.cy * pullNy) / (maxRadius * 0.5);
    // Asymmetric scale: leading particles barely move; trailing particles stretch far back
    const asymScale  = proj >= 0 ? 0.4 : 1.2;
    const stretchAmt = proj * pullNormalized * STRETCH_MAX * asymScale;

    // Directional fray: bias ~55 % toward the trailing direction for a comet-tail smear
    const edgeFactor = Math.min(1, Math.sqrt(p.cx * p.cx + p.cy * p.cy) / (maxRadius * 0.6));
    const frayAmt    = fraying * edgeFactor * 20 * pullNormalized;
    const TRAIL_BIAS = 0.55;
    const frayDirX   = (-pullNx) * TRAIL_BIAS + p.frayX * (1 - TRAIL_BIAS);
    const frayDirY   = (-pullNy) * TRAIL_BIAS + p.frayY * (1 - TRAIL_BIAS);

    const px = p.x + pullNx * stretchAmt + frayDirX * frayAmt;
    const py = p.y + pullNy * stretchAmt + frayDirY * frayAmt;
    current.push({ x: px, y: py, color: p.color });
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(px, py, SLINGSHOT_PARTICLE_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  pullPreviewParticles = current;
}

// ─── Slingshot callbacks ──────────────────────────────────────────────────────

function onSlingshotTap() {
  if (isTransitioning || isPulling) return;
  const action = getItemClickAction(currentSectionIdx, currentItemIdx);
  if (isExternalLink(action)) {
    window.open(action, '_blank', 'noopener,noreferrer');
  }
}

function onSlingshotArm() {
  // Intentionally empty — gesture module handles touch-action: none.
  // onLock guards the expensive work.
}

function onSlingshotLock({ direction, pullVector, pullNormalized }) {
  if (isTransitioning || isPulling || isAsymptoteGameActive) return;

  const from   = { sectionIdx: currentSectionIdx, itemIdx: currentItemIdx };
  const target = direction === 'next'
    ? getNextTarget(from.sectionIdx, from.itemIdx)
    : getPrevTarget(from.sectionIdx, from.itemIdx);

  if (isSameTarget(target, from)) return;

  isPulling       = true;
  isTransitioning = true;
  pullTargetSectionIdx = target.sectionIdx;
  pullTargetItemIdx    = target.itemIdx;
  activeTarget = { sectionIdx: target.sectionIdx, itemIdx: target.itemIdx };

  stopActiveGifHeroPlayback();
  stopCurrentHeroSurfaceTracking();

  // Deactivate outgoing view
  {
    const fromSectionId = SPA_SECTIONS[from.sectionIdx]?.id;
    const fromItemId = SPA_SECTIONS[from.sectionIdx]?.items[from.itemIdx]?.id;
    if (fromSectionId && fromItemId) {
      try { window.__SPA_Views?.[fromSectionId]?.onDeactivate?.(fromItemId); } catch (_) {}
    }
  }

  // Use the already-cached surface immediately for non-GIF heroes so the first
  // pull frame is visible with no async delay.
  const fromHeroSpec = getHeroSpec(from.sectionIdx, from.itemIdx);
  if (
    !isGifHeroSpec(fromHeroSpec) &&
    currentHeroSurface &&
    currentHeroSurfaceKey === getHeroSurfaceKey(from.sectionIdx, from.itemIdx)
  ) {
    pullFromSurface = currentHeroSurface;
  }

  // Kick off rasterization in parallel. GIF heroes need a fresh live capture;
  // the to-surface always needs fresh rasterization.
  const nextHeroSpec = getHeroSpec(target.sectionIdx, target.itemIdx);
  if (isGifHeroSpec(nextHeroSpec)) {
    prepareToGifCanvas(target.sectionIdx, target.itemIdx, nextHeroSpec.src);
  }

  pullFromSurfacePromise = buildHeroSurface(from.sectionIdx, from.itemIdx, 'from')
    .then(s => { pullFromSurface = s; return s; })
    .catch(() => null);
  pullToSurfacePromise = buildHeroSurface(target.sectionIdx, target.itemIdx, 'to')
    .then(s => { pullToSurface = s; return s; })
    .catch(() => null);

  // Show transition canvas and hide hero DOM immediately
  const heroContainer    = document.getElementById('spa-hero-container');
  const transitionCanvas = document.getElementById('transition-canvas');
  const fallbackSize     = { width: 320, height: 320 };
  alignTransitionCanvas(transitionCanvas, pullFromSurface || fallbackSize, fallbackSize);
  heroContainer.style.visibility = 'hidden';
  heroContainer.style.opacity    = '0';
  heroContainer.style.transition = '';
  transitionCanvas.style.display    = 'block';
  transitionCanvas.style.opacity    = '1';
  transitionCanvas.style.transition = '';

  renderPullPreview(pullVector, pullNormalized);
}

function onSlingshotPull({ pullVector, pullNormalized }) {
  if (!isPulling) return;
  renderPullPreview(pullVector, pullNormalized);
}

async function onSlingshotRelease({ pullNormalized }) {
  if (!isPulling) return;

  if (pullNormalized < SLINGSHOT_MIN_RELEASE) {
    cancelSlingshot();
    return;
  }

  // Await surfaces — typically already resolved, but guard against fast swipes
  let fromSurface, toSurface;
  try {
    [fromSurface, toSurface] = await Promise.all([pullFromSurfacePromise, pullToSurfacePromise]);
  } catch (_) {
    cancelSlingshot();
    return;
  }
  if (!fromSurface || !toSurface) {
    cancelSlingshot();
    return;
  }

  const targetSectionIdx = pullTargetSectionIdx;
  const targetItemIdx    = pullTargetItemIdx;
  const heroContainer    = document.getElementById('spa-hero-container');
  const transitionCanvas = document.getElementById('transition-canvas');

  // Re-align canvas to actual resolved surface sizes before starting animation.
  // Resizing the canvas clears it — the animation starts on the next rAF, so
  // the last pull preview frame remains visible for one frame (seamless handoff).
  alignTransitionCanvas(transitionCanvas, fromSurface, toSurface);
  const ctx = transitionCanvas.getContext('2d');

  try {
    if (pullPreviewParticles && pullPreviewParticles.length > 0) {
      // True slingshot: reform directly from the pulled particle positions.
      // The canvas was just re-aligned, so we need to remap particle positions
      // to the new canvas coordinate space (center offset may have shifted).
      const newCW = transitionCanvas.width;
      const newCH = transitionCanvas.height;
      // Use the recorded canvas dimensions from when pullPreviewParticlesBase was sampled.
      // alignTransitionCanvas at lock-time used max(fromSurface.width, 320) + 2*PADDING, which
      // may differ from fromSurface.width + 2*PADDING — using the wrong value causes the whole
      // cloud to jump bottom-right on release before snapping back.
      const oldCW = pullPreviewCanvasW || (fromSurface.width  + STAGE_PADDING_PX * 2);
      const oldCH = pullPreviewCanvasH || (fromSurface.height + STAGE_PADDING_PX * 2);
      const shiftX = (newCW - oldCW) / 2;
      const shiftY = (newCH - oldCH) / 2;
      const remapped = (shiftX === 0 && shiftY === 0)
        ? pullPreviewParticles
        : pullPreviewParticles.map(p => ({ x: p.x + shiftX, y: p.y + shiftY, color: p.color }));
      // Also remap the base rest-positions (used for snap-back phase in transitionFromPull)
      const remappedBase = !pullPreviewParticlesBase ? null
        : (shiftX === 0 && shiftY === 0)
          ? pullPreviewParticlesBase.map(p => ({ x: p.x, y: p.y, color: p.color }))
          : pullPreviewParticlesBase.map(p => ({ x: p.x + shiftX, y: p.y + shiftY, color: p.color }));
      await new Promise((resolve) => {
        transitionFromPull(remapped, toSurface, ctx, { fromParticlesBase: remappedBase }, resolve);
      });
    } else {
      // Fast swipe that didn't reach the particle phase: fall back to standard transition.
      await new Promise((resolve) => {
        transition(fromSurface.canvas, toSurface.canvas, { ctx, fromRegion: fromSurface, toRegion: toSurface }, resolve);
      });
    }
  } catch (_) {
    cancelSlingshot();
    return;
  }

  // Reveal + commit — wrapped so any unexpected DOM error still resets state.
  try {
    // Reveal target hero — identical handoff sequence as runHeroTransition
    const preparedPlaybackKey = `prepared:${getHeroSurfaceKey(targetSectionIdx, targetItemIdx)}`;
    const targetHeroSpec      = getHeroSpec(targetSectionIdx, targetItemIdx);
    const preparedTargetCanvas = isGifHeroSpec(targetHeroSpec)
      ? getPreparedToGifCanvas(targetSectionIdx, targetItemIdx)
      : null;
    const canReusePreparedGif =
      preparedTargetCanvas instanceof window.HTMLCanvasElement &&
      activeGifPlayback?.playbackKey === preparedPlaybackKey &&
      activeGifPlayback?.hasPaintedFrame;

    renderHeroDOM(targetSectionIdx, targetItemIdx, {
      preparedGifCanvas:        canReusePreparedGif ? preparedTargetCanvas : null,
      preserveActiveGifPlayback: canReusePreparedGif
    });
    updateSectionNav(targetSectionIdx);
    updateItemDots(targetSectionIdx, targetItemIdx);

    heroContainer.style.visibility = 'visible';
    heroContainer.style.transition = `opacity ${REVEAL_HANDOFF_FADE_MS}ms ease-out`;
    transitionCanvas.style.transition = `opacity ${REVEAL_HANDOFF_FADE_MS}ms ease-in`;
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    heroContainer.style.opacity   = '1';
    transitionCanvas.style.opacity = '0';
    await new Promise((resolve) => window.setTimeout(resolve, REVEAL_HANDOFF_FADE_MS));
    transitionCanvas.style.display    = 'none';
    transitionCanvas.style.opacity    = '1';
    transitionCanvas.style.transition = '';
    heroContainer.style.transition    = '';

    // Commit navigation state
    currentSectionIdx   = targetSectionIdx;
    currentItemIdx      = targetItemIdx;
    preparedToGifCanvas = null;
    preparedToGifKey    = null;

    // Activate incoming view
    {
      const toSectionId = SPA_SECTIONS[currentSectionIdx]?.id;
      const toItemId = SPA_SECTIONS[currentSectionIdx]?.items[currentItemIdx]?.id;
      if (toSectionId && toItemId) {
        try { window.__SPA_Views?.[toSectionId]?.onActivate?.(toItemId); } catch (_) {}
      }
    }

    cleanupSlingshotPull();
    startCurrentHeroSurfaceTracking(currentSectionIdx, currentItemIdx);

    if (queuedTarget) {
      const latest = queuedTarget;
      queuedTarget = null;
      if (!isSameTarget(latest, { sectionIdx: currentSectionIdx, itemIdx: currentItemIdx })) {
        void goTo(latest.sectionIdx, latest.itemIdx, { transitionOptions: latest.transitionOptions || undefined });
      }
    }
  } catch (err) {
    console.warn('[slingshot] release reveal failed:', err);
    cancelSlingshot();
  }
}

function onSlingshotCancel() {
  if (!isPulling) return;
  cancelSlingshot();
}

function cancelSlingshot() {
  const heroContainer    = document.getElementById('spa-hero-container');
  const transitionCanvas = document.getElementById('transition-canvas');
  transitionCanvas.style.display    = 'none';
  transitionCanvas.style.opacity    = '1';
  transitionCanvas.style.transition = '';
  heroContainer.style.visibility = 'visible';
  heroContainer.style.opacity    = '1';
  heroContainer.style.transition = '';
  cleanupSlingshotPull();
  startCurrentHeroSurfaceTracking(currentSectionIdx, currentItemIdx);

  // Re-activate current view (slingshot cancelled)
  {
    const sectionId = SPA_SECTIONS[currentSectionIdx]?.id;
    const itemId = SPA_SECTIONS[currentSectionIdx]?.items[currentItemIdx]?.id;
    if (sectionId && itemId) {
      try { window.__SPA_Views?.[sectionId]?.onActivate?.(itemId); } catch (_) {}
    }
  }
}

function cleanupSlingshotPull() {
  isPulling            = false;
  isTransitioning      = false;
  activeTarget         = null;
  pullTargetSectionIdx = null;
  pullTargetItemIdx    = null;
  pullFromSurface      = null;
  pullToSurface        = null;
  pullFromSurfacePromise    = null;
  pullToSurfacePromise      = null;
  pullPreviewParticlesBase  = null;
  pullPreviewParticles      = null;
  pullPreviewCanvasW        = 0;
  pullPreviewCanvasH        = 0;
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

setupItemNav();
render();
startCurrentHeroSurfaceTracking(currentSectionIdx, currentItemIdx);

initSlingshot(document.getElementById('spa-hero-container'), {
  onArm:     onSlingshotArm,
  onTap:     onSlingshotTap,
  onLock:    onSlingshotLock,
  onPull:    onSlingshotPull,
  onRelease: onSlingshotRelease,
  onCancel:  onSlingshotCancel
});
