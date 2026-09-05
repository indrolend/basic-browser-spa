import { readFileSync, writeFileSync } from 'node:fs';

const path = new URL('../main.js', import.meta.url);
let source = readFileSync(path, 'utf8');

function replaceOnce(search, replacement, label) {
  const before = source;
  source = source.replace(search, replacement);
  if (source === before) throw new Error(`refactor did not match: ${label}`);
}

function replaceAllLiteral(search, replacement, label) {
  const count = source.split(search).length - 1;
  if (!count) throw new Error(`refactor did not match: ${label}`);
  source = source.split(search).join(replacement);
  return count;
}

// Explicit item/adapter/action authorities.
replaceOnce(
  "import { createAdapterLoader } from './js/spa/adapterLoader.js';\nimport { awardDiscovery, mountEconomyHud } from './js/spa/sharedEconomy.js';",
  "import { createAdapterLoader } from './js/spa/adapterLoader.js';\nimport { getItemAdapter } from './js/spa/itemAdapterRegistry.js';\nimport { resolvePrimaryAction, getPrimaryActionPresentation } from './js/spa/primaryAction.js';\nimport { PARTICLE_SIZE, sampleSurfaceParticles } from './js/spa/particleSampling.js';\nimport { awardDiscovery, mountEconomyHud } from './js/spa/sharedEconomy.js';",
  'runtime imports'
);

replaceOnce(
  'const adapterLoader = createAdapterLoader({ baseUrl: CONTENT_BASE_URL });',
  "const adapterLoader = createAdapterLoader({\n  baseUrl: CONTENT_BASE_URL,\n  resolveRegistration: getItemAdapter\n});",
  'adapter loader registration authority'
);

replaceOnce(
`async function ensureItemAdapter(sectionIdx, itemIdx) {
  const item = SPA_SECTIONS[sectionIdx]?.items[itemIdx];
  if (!item?.adapter) return true;
  try {
    await adapterLoader.load(item.adapter);
    return true;
  } catch (error) {
    console.warn(\`[adapter] \${item.adapter.id} unavailable; using the configured fallback hero\`, error);
    return false;
  }
}`,
`function getItemKey(sectionIdx, itemIdx) {
  const section = SPA_SECTIONS[sectionIdx];
  const item = section?.items[itemIdx];
  return section?.id && item?.id ? \`\${section.id}/\${item.id}\` : null;
}

function getRegisteredItemAdapter(sectionIdx, itemIdx) {
  const key = getItemKey(sectionIdx, itemIdx);
  return key ? getItemAdapter(key) : null;
}

async function ensureItemAdapter(sectionIdx, itemIdx) {
  const item = SPA_SECTIONS[sectionIdx]?.items[itemIdx];
  if (!item?.adapter) return true;
  try {
    await adapterLoader.load(item.adapter);
    return true;
  } catch (error) {
    console.warn(\`[adapter] \${item.adapter.id} unavailable; using the configured fallback hero\`, error);
    return false;
  }
}

function getItemPrimaryAction(sectionIdx, itemIdx) {
  const item = SPA_SECTIONS[sectionIdx]?.items[itemIdx];
  if (!item) return null;
  return resolvePrimaryAction({
    item,
    adapter: getRegisteredItemAdapter(sectionIdx, itemIdx),
    baseUrl: window.location.href
  });
}

function activateItem(sectionIdx, itemIdx) {
  const adapter = getRegisteredItemAdapter(sectionIdx, itemIdx);
  if (adapter?.activate) {
    adapter.activate();
    return;
  }
  const sectionId = SPA_SECTIONS[sectionIdx]?.id;
  const itemId = SPA_SECTIONS[sectionIdx]?.items[itemIdx]?.id;
  if (sectionId && itemId) window.__SPA_Views?.[sectionId]?.onActivate?.(itemId);
}

function deactivateItem(sectionIdx, itemIdx) {
  const adapter = getRegisteredItemAdapter(sectionIdx, itemIdx);
  if (adapter?.deactivate) {
    adapter.deactivate();
    return;
  }
  const sectionId = SPA_SECTIONS[sectionIdx]?.id;
  const itemId = SPA_SECTIONS[sectionIdx]?.items[itemIdx]?.id;
  if (sectionId && itemId) window.__SPA_Views?.[sectionId]?.onDeactivate?.(itemId);
}

function awardCurrentDiscovery() {
  const sectionId = SPA_SECTIONS[currentSectionIdx]?.id;
  const itemId = SPA_SECTIONS[currentSectionIdx]?.items[currentItemIdx]?.id;
  if (sectionId && itemId) awardDiscovery(sectionId, itemId);
}`,
  'item capability helpers'
);

// Generalize the shell ownership flag while preserving old globals as aliases.
replaceAllLiteral('isGameModeActive', 'isApplicationModeActive', 'application mode state name');
replaceAllLiteral('exitGameToCurrentItem', 'exitApplicationToCurrentItem', 'application exit function name');
replaceAllLiteral('enterCurrentGameWithTransition', 'enterCurrentApplicationWithTransition', 'application enter function name');

replaceOnce(
`// ─── Game mode flag ───────────────────────────────────────────────────────────
// Set to true while an embedded game is active.
// Blocks slingshot navigation and keyboard arrow nav so the player can't
// accidentally swipe or key out of the game.
let isApplicationModeActive = false;
window.__SPA_SetGameMode = (active) => { isApplicationModeActive = !!active; };
// Navigate to home when explicitly requested.
window.__SPA_GoHome = () => goTo(0, 0);
// Exit the active game by transitioning back to the current item's entry hero.
window.__SPA_ExitGameToCurrentItem = () => { void exitApplicationToCurrentItem(); };
// Enter the active game by transitioning from the entry hero into the game view.
window.__SPA_EnterCurrentGame = () => { void enterCurrentApplicationWithTransition(); };`,
`// ─── Application ownership ───────────────────────────────────────────────────
// True while the current item's embedded application owns interaction.
let isApplicationModeActive = false;
window.__SPA_SetApplicationMode = (active) => { isApplicationModeActive = !!active; };
// Compatibility alias for adapters that still call the older game-specific API.
window.__SPA_SetGameMode = window.__SPA_SetApplicationMode;
// Navigate to home when explicitly requested.
window.__SPA_GoHome = () => goTo(0, 0);
window.__SPA_ExitApplicationToCurrentItem = () => { void exitApplicationToCurrentItem(); };
window.__SPA_EnterCurrentApplication = () => { void enterCurrentApplicationWithTransition(); };
// Compatibility aliases while Asymptote internals migrate.
window.__SPA_ExitGameToCurrentItem = window.__SPA_ExitApplicationToCurrentItem;
window.__SPA_EnterCurrentGame = window.__SPA_EnterCurrentApplication;`,
  'application globals'
);

// Application exit is not item deactivation: the selected item remains current.
replaceOnce(
`    const restoreEntryHero = () => {
      try {
        if (sectionId && itemId) {
          window.__SPA_Views?.[sectionId]?.onDeactivate?.(itemId);
        } else {
          window.__SPA_SetGameMode(false);
        }
      } catch (_) {
        window.__SPA_SetGameMode(false);
      }

      renderHeroDOM(currentSectionIdx, currentItemIdx);
      updateSectionNav(currentSectionIdx);
      updateItemDots(currentSectionIdx, currentItemIdx);
    };`,
`    const restoreEntryHero = () => {
      try {
        const adapter = getRegisteredItemAdapter(currentSectionIdx, currentItemIdx);
        if (adapter?.exitApplication) adapter.exitApplication();
        else window.__SPA_SetApplicationMode(false);
      } catch (_) {
        window.__SPA_SetApplicationMode(false);
      }

      renderHeroDOM(currentSectionIdx, currentItemIdx);
      updateSectionNav(currentSectionIdx);
      updateItemDots(currentSectionIdx, currentItemIdx);
    };`,
  'application exit lifecycle'
);

replaceOnce(
`    try {
      if (sectionId && itemId) {
        window.__SPA_Views?.[sectionId]?.onDeactivate?.(itemId);
      } else {
        window.__SPA_SetGameMode(false);
      }
    } catch (_) {
      window.__SPA_SetGameMode(false);
    }`,
`    try {
      const adapter = getRegisteredItemAdapter(currentSectionIdx, currentItemIdx);
      if (adapter?.exitApplication) adapter.exitApplication();
      else window.__SPA_SetApplicationMode(false);
    } catch (_) {
      window.__SPA_SetApplicationMode(false);
    }`,
  'application exit fallback'
);

// Enter applications through the item adapter contract.
replaceOnce(
`async function enterCurrentApplicationWithTransition() {
  if (isTransitioning || isPulling || isApplicationModeActive) return;

  const section = SPA_SECTIONS[currentSectionIdx];
  const item = section?.items[currentItemIdx];
  const view = window.__SPA_Views?.[section?.id];

  if (!item || !view?.canEnterGame?.(item.id) || typeof view?.onEnterGame !== 'function') return;

  isTransitioning = true;
  stopCurrentHeroSurfaceTracking();

  try {
    const heroContainer = document.getElementById('spa-hero-container');
    const gameProbe = view.buildEntryGameHeroProbe?.(item.id, heroContainer);

    if (!gameProbe) {
      view.onEnterGame(item.id);
      return;
    }

    const [fromSurface, toSurface] = await Promise.all([
      buildHeroSurface(currentSectionIdx, currentItemIdx, 'from'),
      rasterizeWithCleanup({
        type: 'textElement',
        element: gameProbe.element,
        cleanup: gameProbe.cleanup
      })
    ]);

    if (fromSurface && toSurface) {
      await runHeroTransition(fromSurface, toSurface, {
        timingProfile: 'releaseLike',
        onBeforeReveal: async () => {
          view.onEnterGame(item.id);
        }
      });
    } else {
      view.onEnterGame(item.id);
    }
  } catch (err) {
    console.warn('[game entry transition] failed, entering game directly:', err);
    view.onEnterGame(item.id);
  } finally {
    isTransitioning = false;
    startCurrentHeroSurfaceTracking(currentSectionIdx, currentItemIdx);
  }
}`,
`async function enterCurrentApplicationWithTransition() {
  if (isTransitioning || isPulling || isApplicationModeActive) return;

  const adapter = getRegisteredItemAdapter(currentSectionIdx, currentItemIdx);
  const action = getItemPrimaryAction(currentSectionIdx, currentItemIdx);
  if (action?.type !== 'application' || typeof adapter?.enterApplication !== 'function') return;

  isTransitioning = true;
  stopCurrentHeroSurfaceTracking();

  try {
    const heroContainer = document.getElementById('spa-hero-container');
    const entryProbe = adapter.buildEntryProbe?.(heroContainer);

    if (!entryProbe) {
      adapter.enterApplication();
      return;
    }

    const [fromSurface, toSurface] = await Promise.all([
      buildHeroSurface(currentSectionIdx, currentItemIdx, 'from'),
      rasterizeWithCleanup({
        type: 'textElement',
        element: entryProbe.element,
        cleanup: entryProbe.cleanup
      })
    ]);

    if (fromSurface && toSurface) {
      await runHeroTransition(fromSurface, toSurface, {
        onBeforeReveal: async () => {
          adapter.enterApplication();
        }
      });
    } else {
      adapter.enterApplication();
    }
  } catch (err) {
    console.warn('[application entry transition] failed, entering directly:', err);
    adapter.enterApplication();
  } finally {
    isTransitioning = false;
    startCurrentHeroSurfaceTracking(currentSectionIdx, currentItemIdx);
  }
}`,
  'application entry orchestration'
);

// Unified semantic action execution.
replaceOnce(
`function runItemClickAction(action) {
  const safeUrl = getSafeExternalUrl(action);

  if (safeUrl) {
    if (new URL(safeUrl).origin === window.location.origin) {
      window.location.assign(safeUrl);
      return;
    }
    const newWindow = window.open(safeUrl, '_blank', 'noopener,noreferrer');
    if (newWindow) {
      newWindow.opener = null;
    }
    return;
  }

  if (isOverlayAction(action) && window.__SPA_Overlay) {
    void openOverlayWithTransition(action);
  }
}`,
`function runPrimaryAction(action) {
  if (!action) return;

  if (action.type === 'application') {
    void enterCurrentApplicationWithTransition();
    return;
  }

  if (action.type === 'overlay') {
    void openOverlayWithTransition(\`overlay:\${action.overlayId}\`);
    return;
  }

  if (action.type === 'link') {
    if (!action.external) {
      window.location.assign(action.href);
      return;
    }
    const newWindow = window.open(action.href, '_blank', 'noopener,noreferrer');
    if (newWindow) newWindow.opener = null;
  }
}`,
  'primary action execution'
);

// Item adapters own richer hero presentation; section views remain fallback only.
replaceOnce(
`  // Delegate to registered view module if available
  const sectionId = SPA_SECTIONS[sectionIdx]?.id;
  const itemId = item?.id;
  if (sectionId && itemId) awardDiscovery(sectionId, itemId);
  if (sectionId && itemId && window.__SPA_Views?.[sectionId]?.mount) {
    try {
      window.__SPA_Views[sectionId].mount(itemId, heroContainer);
      if (heroContainer.childElementCount > 0) return;
    } catch (err) {
      console.warn('[SPA_Views] mount failed for', sectionId + '/' + itemId, err);
      // Fall through to default hero rendering
    }
  }`,
`  const sectionId = SPA_SECTIONS[sectionIdx]?.id;
  const itemId = item?.id;
  const adapter = getRegisteredItemAdapter(sectionIdx, itemIdx);
  if (adapter?.mount) {
    try {
      adapter.mount(heroContainer);
    } catch (err) {
      console.warn('[item adapter] mount failed for', getItemKey(sectionIdx, itemIdx), err);
    }
  } else if (sectionId && itemId && window.__SPA_Views?.[sectionId]?.mount) {
    try {
      window.__SPA_Views[sectionId].mount(itemId, heroContainer);
    } catch (err) {
      console.warn('[SPA_Views] mount failed for', sectionId + '/' + itemId, err);
    }
  }`,
  'item adapter hero mount'
);

replaceOnce(
`  const hero = document.createElement('div');
  hero.className = 'spa-hero';
  hero.setAttribute('draggable', 'false');
  hero.addEventListener('dragstart', (e) => e.preventDefault());

  const clickAction = getItemClickAction(sectionIdx, itemIdx);
  if (isExternalLink(clickAction) || isOverlayAction(clickAction)) {
    hero.classList.add('spa-hero--linkable');
    hero.setAttribute('role', 'link');
    hero.setAttribute('aria-label', isOverlayAction(clickAction)
      ? \`Open \${item.label} menu\`
      : \`Open \${item.label}\`);
    hero.setAttribute('tabindex', '0');

    hero.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!isTransitioning && !isPulling) {
          runItemClickAction(clickAction);
        }
      }
    });
  }`,
`  let hero = heroContainer.querySelector('.spa-hero');
  if (!(hero instanceof window.HTMLElement)) {
    hero = document.createElement('div');
    hero.className = 'spa-hero';
  }
  hero.setAttribute('draggable', 'false');
  hero.addEventListener('dragstart', (e) => e.preventDefault());

  const primaryAction = getItemPrimaryAction(sectionIdx, itemIdx);
  const actionPresentation = getPrimaryActionPresentation(primaryAction, item.label);
  if (actionPresentation?.actionable) {
    hero.classList.add('spa-hero--linkable');
    hero.setAttribute('role', actionPresentation.role);
    hero.setAttribute('aria-label', actionPresentation.ariaLabel);
    hero.setAttribute('tabindex', '0');
    hero.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!isTransitioning && !isPulling) runPrimaryAction(primaryAction);
      }
    });
  }

  // Adapter-mounted heroes are complete presentations; the shell still owns
  // their actionability semantics above.
  if (hero.parentElement === heroContainer) return;`,
  'primary action presentation'
);

replaceAllLiteral(
  'if (isExternalLink(clickAction) || isOverlayAction(clickAction)) {',
  'if (actionPresentation?.actionable) {',
  'gif actionability'
);

// Rich probes come from the current item adapter before any legacy section view.
replaceOnce(
`  if (typeof window.__SPA_Views?.[section.id]?.buildHeroProbe !== 'function') return false;
  const container = document.getElementById('spa-hero-container');
  return !!(container?.querySelector('canvas'));`,
`  const adapter = getRegisteredItemAdapter(sectionIdx, itemIdx);
  const hasProbe = typeof adapter?.buildHeroProbe === 'function' ||
    typeof window.__SPA_Views?.[section.id]?.buildHeroProbe === 'function';
  if (!hasProbe) return false;
  const container = document.getElementById('spa-hero-container');
  return !!(container?.querySelector('canvas'));`,
  'procedural canvas capability'
);

replaceOnce(
`      const viewProbe = window.__SPA_Views?.[sectionId]?.buildHeroProbe?.(itemId, container);
      if (viewProbe) {
        return { type: 'textElement', element: viewProbe.element, cleanup: viewProbe.cleanup };
      }`,
`      const adapter = getRegisteredItemAdapter(sectionIdx, itemIdx);
      const viewProbe = adapter?.buildHeroProbe?.(container) ||
        window.__SPA_Views?.[sectionId]?.buildHeroProbe?.(itemId, container);
      if (viewProbe) {
        return { type: 'textElement', element: viewProbe.element, cleanup: viewProbe.cleanup };
      }`,
  'item probe capability'
);

// Navigation lifecycle dispatches through the item adapter authority first.
replaceOnce(
`  // Deactivate outgoing view
  {
    const fromSectionId = SPA_SECTIONS[currentSectionIdx]?.id;
    const fromItemId = SPA_SECTIONS[currentSectionIdx]?.items[currentItemIdx]?.id;
    if (fromSectionId && fromItemId) {
      try { window.__SPA_Views?.[fromSectionId]?.onDeactivate?.(fromItemId); } catch (_) {}
    }
  }`,
`  try { deactivateItem(currentSectionIdx, currentItemIdx); } catch (_) {}`,
  'goTo outgoing lifecycle'
);

replaceOnce(
`    // Activate incoming view
    {
      const toSectionId = SPA_SECTIONS[currentSectionIdx]?.id;
      const toItemId = SPA_SECTIONS[currentSectionIdx]?.items[currentItemIdx]?.id;
      if (toSectionId && toItemId) {
        try { window.__SPA_Views?.[toSectionId]?.onActivate?.(toItemId); } catch (_) {}
      }
    }`,
`    try { activateItem(currentSectionIdx, currentItemIdx); } catch (_) {}
    awardCurrentDiscovery();`,
  'goTo incoming lifecycle'
);

// Slingshot lifecycle uses the same helpers.
replaceOnce(
`  // Deactivate outgoing view
  {
    const fromSectionId = SPA_SECTIONS[from.sectionIdx]?.id;
    const fromItemId = SPA_SECTIONS[from.sectionIdx]?.items[from.itemIdx]?.id;
    if (fromSectionId && fromItemId) {
      try { window.__SPA_Views?.[fromSectionId]?.onDeactivate?.(fromItemId); } catch (_) {}
    }
  }`,
`  try { deactivateItem(from.sectionIdx, from.itemIdx); } catch (_) {}`,
  'slingshot outgoing lifecycle'
);

replaceOnce(
`    // Activate incoming view
    {
      const toSectionId = SPA_SECTIONS[currentSectionIdx]?.id;
      const toItemId = SPA_SECTIONS[currentSectionIdx]?.items[currentItemIdx]?.id;
      if (toSectionId && toItemId) {
        try { window.__SPA_Views?.[toSectionId]?.onActivate?.(toItemId); } catch (_) {}
      }
    }`,
`    try { activateItem(currentSectionIdx, currentItemIdx); } catch (_) {}
    awardCurrentDiscovery();`,
  'slingshot incoming lifecycle'
);

replaceOnce(
`  // Re-activate current view (slingshot cancelled)
  {
    const sectionId = SPA_SECTIONS[currentSectionIdx]?.id;
    const itemId = SPA_SECTIONS[currentSectionIdx]?.items[currentItemIdx]?.id;
    if (sectionId && itemId) {
      try { window.__SPA_Views?.[sectionId]?.onActivate?.(itemId); } catch (_) {}
    }
  }`,
`  try { activateItem(currentSectionIdx, currentItemIdx); } catch (_) {}`,
  'cancelled pull lifecycle'
);

replaceOnce(
`{
  const sectionId = SPA_SECTIONS[currentSectionIdx]?.id;
  const itemId = SPA_SECTIONS[currentSectionIdx]?.items[currentItemIdx]?.id;
  if (sectionId && itemId) {
    try { window.__SPA_Views?.[sectionId]?.onActivate?.(itemId); } catch (_) {}
  }
}

startCurrentHeroSurfaceTracking(currentSectionIdx, currentItemIdx);`,
`try { activateItem(currentSectionIdx, currentItemIdx); } catch (_) {}
awardCurrentDiscovery();

startCurrentHeroSurfaceTracking(currentSectionIdx, currentItemIdx);`,
  'boot lifecycle and discovery'
);

// Tap and weak-pull activation derive from the same PrimaryAction.
replaceOnce(
`function runWeakPullTapFallbackIfNeeded() {
  const action = getItemClickAction(currentSectionIdx, currentItemIdx);
  if (isOverlayAction(action)) {
    runItemClickAction(action);
  }
}`,
`function runWeakPullTapFallbackIfNeeded() {
  const action = getItemPrimaryAction(currentSectionIdx, currentItemIdx);
  if (action?.type === 'overlay') runPrimaryAction(action);
}`,
  'weak pull primary action'
);

replaceOnce(
`  // Tap on the Asymptote Engine hero — enter the game.
  const section = SPA_SECTIONS[currentSectionIdx];
  const item    = section?.items[currentItemIdx];
  const view = window.__SPA_Views?.[section?.id];
  if (item && view?.canEnterGame?.(item.id) && typeof view?.onEnterGame === 'function') {
    if (typeof window.__SPA_EnterCurrentGame === 'function') {
      window.__SPA_EnterCurrentGame();
    } else {
      view.onEnterGame(item.id);
    }
    return;
  }

  const action = getItemClickAction(currentSectionIdx, currentItemIdx);
  runItemClickAction(action);`,
`  runPrimaryAction(getItemPrimaryAction(currentSectionIdx, currentItemIdx));`,
  'slingshot tap primary action'
);

// One particle-sampling policy for transition and pull preview.
replaceOnce(
`const SLINGSHOT_PARTICLE_SIZE = 4;
const SLINGSHOT_MIN_RELEASE   = 0.15;`,
`const SLINGSHOT_PARTICLE_SIZE = PARTICLE_SIZE;
const SLINGSHOT_MIN_RELEASE   = 0.15;`,
  'shared particle size'
);

replaceOnce(
/function samplePullParticles\(surface, canvasW, canvasH\) \{[\s\S]*?\n\}\n\nfunction renderPullPreview/,
`function samplePullParticles(surface, canvasW, canvasH) {
  return sampleSurfaceParticles(surface, canvasW, canvasH, { includeOffsets: true });
}

function renderPullPreview`,
  'shared pull particle sampling'
);

// Delete false timing vocabulary: only the engine's actual "chained" profile is named.
replaceAllLiteral("        timingProfile: 'releaseLike',\n", '', 'releaseLike call options');
replaceAllLiteral("  const transitionOptions = navOptions.transitionOptions || { timingProfile: 'releaseLike' };", "  const transitionOptions = navOptions.transitionOptions || {};", 'default navigation timing');
replaceAllLiteral("timingProfile: 'releaseLikeChained'", "timingProfile: 'chained'", 'desktop chained timing');
replaceOnce(
`  if (!isChained) {
    return {
      transitionOptions: {
      }
    };
  }`,
`  if (!isChained) {
    return { transitionOptions: {} };
  }`,
  'compact default desktop timing'
);

// Rendering no longer awards discovery; semantic navigation/boot commits do.
if (source.includes('renderHeroDOM(sectionIdx, itemIdx') && source.includes('awardDiscovery(sectionId, itemId)')) {
  throw new Error('awardDiscovery still occurs in renderHeroDOM');
}

// The section-scoped bridge may remain as a fallback, but canonical application
// entry and actionability must no longer depend on game-specific view methods.
for (const forbidden of [
  'view?.canEnterGame',
  'view?.onEnterGame',
  'buildEntryGameHeroProbe?.',
  'runItemClickAction(',
  "timingProfile: 'releaseLike'",
  "timingProfile: 'releaseLikeChained'",
  'function samplePullParticles(surface, canvasW, canvasH) {\n  const offscreen'
]) {
  if (source.includes(forbidden)) throw new Error(`stale runtime contract remains: ${forbidden}`);
}

writeFileSync(path, source);
