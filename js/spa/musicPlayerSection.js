import manager from './musicManager.js';
import { initOrbHero } from './orbHero.js';

let orbCleanup = null;

export function initMusicPlayerSection() {
  if (!window.__SPA_Overlay?.register) return;
  window.__SPA_Overlay.register('musicPlayer', () => {
    return [
      '<div class="spa-overlay-title"><span class="important-word">music</span></div>',
      '<canvas id="music-orb" class="music-orb" width="280" height="280" aria-label="Music scrub orb" tabindex="0"></canvas>',
      '<div class="music-controls">',
      '<button class="spa-nav-btn" id="music-prev" type="button" aria-label="Previous track">◀</button>',
      '<button class="spa-nav-btn" id="music-toggle" type="button" aria-label="Toggle mute">mute</button>',
      '<button class="spa-nav-btn" id="music-next" type="button" aria-label="Next track">▶</button>',
      '</div>',
      '<button class="spa-overlay-close" id="spa-overlay-close-btn">✕ close</button>'
    ].join('');
  });

  document.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (!t.closest('.spa-overlay')) return;

    if (t.id === 'music-prev') manager.prevTrack();
    if (t.id === 'music-next') manager.nextTrack();
    if (t.id === 'music-toggle') manager.toggleEnabled();
  });

  const observer = new MutationObserver(() => {
    const orb = document.getElementById('music-orb');
    if (orb && !orb.dataset.bound) {
      orb.dataset.bound = '1';
      if (orbCleanup) orbCleanup.destroy();
      orbCleanup = initOrbHero(orb, manager);
      orb.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') manager.nextTrack();
        if (e.key === 'ArrowLeft') manager.prevTrack();
        if (e.key === ' ') { e.preventDefault(); manager.toggleEnabled(); }
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

export function openMusicPlayer() {
  window.__SPA_Overlay?.open('musicPlayer', {});
}
