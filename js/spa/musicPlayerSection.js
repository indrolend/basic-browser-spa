import manager from './musicManager.js';
import { initOrbHero3D } from './OrbHero3D.js';

let orbCleanup = null;
let offChange = null;

export function initMusicPlayerSection() {
  if (!window.__SPA_Overlay?.register) return;
  window.__SPA_Overlay.register('musicPlayer', () => {
    return [
      '<div class="spa-overlay-title"><span class="important-word">music</span></div>',
      '<div class="music-orb-container"><canvas id="music-orb" class="music-orb" aria-label="Music scrub orb" tabindex="0"></canvas></div>',
      '<div id="music-track-label" class="music-track-label"></div>',
      '<div class="music-controls">',
      '<button class="spa-nav-btn" id="music-toggle" type="button" aria-label="Toggle mute">mute</button>',
      '</div>',
      '<button class="spa-overlay-close" id="spa-overlay-close-btn">✕ close</button>'
    ].join('');
  }, {
    overlayClass: 'music-player-overlay'
  });

  document.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (!t.closest('.spa-overlay')) return;

    if (t.id === 'music-toggle') manager.toggleEnabled();
  });

  function updateLabel() {
    const el = document.getElementById('music-track-label');
    if (!el) return;
    el.textContent = manager.getTrackName();
    const toggle = document.getElementById('music-toggle');
    if (toggle) toggle.textContent = manager.musicEnabled ? 'mute' : 'unmute';
  }

  const observer = new MutationObserver(() => {
    // Force fullscreen overlay for music player
    const overlays = document.querySelectorAll('.spa-overlay');
    overlays.forEach(overlay => {
      if (!overlay.classList.contains('music-player-overlay')) {
        overlay.classList.add('music-player-overlay');
      }
    });
    const orb = document.getElementById('music-orb');
    if (orb && !orb.dataset.bound) {
      orb.dataset.bound = '1';
      if (orbCleanup) orbCleanup.destroy();
      // Make orb canvas fill container responsively
      function resizeOrbCanvas() {
        const container = orb.parentElement;
        if (!container) return;
        // Use the smaller of width/height for a square orb
        const size = Math.min(container.clientWidth, container.clientHeight);
        orb.width = size;
        orb.height = size;
        orb.style.width = size + 'px';
        orb.style.height = size + 'px';
      }
      resizeOrbCanvas();
      window.addEventListener('resize', resizeOrbCanvas);
      window.addEventListener('orientationchange', resizeOrbCanvas);
      // Also resize after overlay open (in case of late layout)
      setTimeout(resizeOrbCanvas, 100);
      orbCleanup = initOrbHero3D(orb, manager);
      // Clean up resize listener on destroy
      const oldDestroy = orbCleanup.destroy;
      orbCleanup.destroy = function() {
        window.removeEventListener('resize', resizeOrbCanvas);
        window.removeEventListener('orientationchange', resizeOrbCanvas);
        oldDestroy();
      };
      orb.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') manager.nextTrack();
        if (e.key === 'ArrowLeft') manager.prevTrack();
        if (e.key === ' ') { e.preventDefault(); manager.toggleEnabled(); }
      });
      updateLabel();
      if (offChange) { offChange(); offChange = null; }
      offChange = manager.onChange(updateLabel);
    } else if (!orb && orbCleanup) {
      orbCleanup.destroy();
      orbCleanup = null;
      if (offChange) { offChange(); offChange = null; }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

export function openMusicPlayer() {
  if (window.__SPA_Overlay?.isOpen?.()) {
    window.__SPA_Overlay.close({ restore: false });
    return;
  }
  window.__SPA_Overlay?.open('musicPlayer', {});
}
