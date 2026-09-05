import { readFileSync, writeFileSync } from 'node:fs';

// One-shot guarded migration: commit semantic navigation state before reveal.
const path = new URL('../main.js', import.meta.url);
let source = readFileSync(path, 'utf8');

function replaceOnce(search, replacement, label) {
  const before = source;
  source = source.replace(search, replacement);
  if (source === before) throw new Error(`refactor did not match: ${label}`);
}

replaceOnce(
`function awardCurrentDiscovery() {
  const sectionId = SPA_SECTIONS[currentSectionIdx]?.id;
  const itemId = SPA_SECTIONS[currentSectionIdx]?.items[currentItemIdx]?.id;
  if (sectionId && itemId) awardDiscovery(sectionId, itemId);
}`,
`function awardCurrentDiscovery() {
  const sectionId = SPA_SECTIONS[currentSectionIdx]?.id;
  const itemId = SPA_SECTIONS[currentSectionIdx]?.items[currentItemIdx]?.id;
  if (sectionId && itemId) awardDiscovery(sectionId, itemId);
}

function commitNavigationTarget(sectionIdx, itemIdx, { lockHome = false } = {}) {
  if (lockHome) homeSectionLocked = true;
  currentSectionIdx = sectionIdx;
  currentItemIdx = itemIdx;
  try { activateItem(sectionIdx, itemIdx); } catch (_) {}
  awardCurrentDiscovery();
}`,
  'navigation commit helper'
);

replaceOnce(
`    let didTransition = false;
    let didRenderDuringReveal = false;`,
`    let didTransition = false;
    let didRenderDuringReveal = false;
    let didCommit = false;`,
  'navigation commit state'
);

replaceOnce(
`          onBeforeReveal: async () => {
            closeOverlayForNavigation();
            if (shouldLockHomeOnCommit) {
              homeSectionLocked = true;
            }
            const preparedPlaybackKey = \`prepared:\${getHeroSurfaceKey(nextSectionIdx, nextItemIdx)}\`;`,
`          onBeforeReveal: async () => {
            closeOverlayForNavigation();
            commitNavigationTarget(nextSectionIdx, nextItemIdx, { lockHome: shouldLockHomeOnCommit });
            didCommit = true;
            const preparedPlaybackKey = \`prepared:\${getHeroSurfaceKey(nextSectionIdx, nextItemIdx)}\`;`,
  'commit before reveal'
);

replaceOnce(
`    currentSectionIdx = nextSectionIdx;
    currentItemIdx = nextItemIdx;
    preparedToGifCanvas = null;
    preparedToGifKey = null;

    try { activateItem(currentSectionIdx, currentItemIdx); } catch (_) {}
    awardCurrentDiscovery();`,
`    if (!didCommit) {
      commitNavigationTarget(nextSectionIdx, nextItemIdx, { lockHome: shouldLockHomeOnCommit });
      didCommit = true;
    }
    preparedToGifCanvas = null;
    preparedToGifKey = null;`,
  'single semantic commit fallback'
);

replaceOnce(
`    } else if (!didTransition) {
      closeOverlayForNavigation();
      if (shouldLockHomeOnCommit) {
        homeSectionLocked = true;
      }
      render();
    }`,
`    } else if (!didTransition) {
      closeOverlayForNavigation();
      render();
    }`,
  'remove duplicate home policy'
);

const helperIndex = source.indexOf('function commitNavigationTarget(');
const goToIndex = source.indexOf('async function goTo(');
const revealIndex = source.indexOf('commitNavigationTarget(nextSectionIdx, nextItemIdx', goToIndex);
const renderDestinationIndex = source.indexOf('renderHeroDOM(nextSectionIdx, nextItemIdx', goToIndex);
if (helperIndex < 0 || revealIndex < 0 || renderDestinationIndex < 0 || revealIndex > renderDestinationIndex) {
  throw new Error('semantic commit must occur before destination render');
}
if ((source.match(/currentSectionIdx = nextSectionIdx;/g) || []).length > 0) {
  throw new Error('goTo still assigns navigation indices outside commit helper');
}

writeFileSync(path, source);
