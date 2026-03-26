// Homedev SPA - Minimal, modular, and particle transition ready
// Sections and items config
const SPA_SECTIONS = [
  {
    id: 'home',
    label: 'Home',
    items: [ { id: 'main', label: 'Home' } ]
  },
  {
    id: 'about',
    label: 'About',
    items: [
      { id: 'spotifyAnalytics', label: 'Spotify Analytics' },
      { id: 'discography', label: 'Discography' },
      { id: 'devHistory', label: 'Development History' },
      { id: 'journal', label: 'Journal' }
    ]
  },
  {
    id: 'games',
    label: 'Games',
    items: [ { id: 'asymptote', label: 'Asymptote Engine' } ]
  },
  {
    id: 'social',
    label: 'Social',
    items: [
      { id: 'tiktok', label: 'TikTok' },
      { id: 'instagram', label: 'Instagram' },
      { id: 'youtube', label: 'YouTube' }
    ]
  },
  {
    id: 'music',
    label: 'Music',
    items: [
      { id: 'spotify', label: 'Spotify' },
      { id: 'appleMusic', label: 'Apple Music' },
      { id: 'bandcamp', label: 'Bandcamp' },
      { id: 'soundcloud', label: 'SoundCloud' }
    ]
  }
];

// Utility: get asset path for an item
function getAssetPath(sectionId, itemId) {
  return `assets/${sectionId}/${itemId}`;
}

// State
let currentSectionIdx = 0;
let currentItemIdx = 0;

// DOM
const root = document.getElementById('spa-root');

function render() {
  const section = SPA_SECTIONS[currentSectionIdx];
  const item = section.items[currentItemIdx];
  root.innerHTML = '';
  const hero = document.createElement('div');
  hero.className = 'spa-hero';

  // Try to load image/gif asset
  const assetBase = getAssetPath(section.id, item.id);
  const img = new window.Image();
  img.onload = function() {
    img.className = 'spa-hero-image';
    hero.appendChild(img);
    renderNav(hero);
  };
  img.onerror = function() {
    // Fallback to text
    const text = document.createElement('div');
    text.className = 'spa-hero-text';
    text.textContent = item.label;
    hero.appendChild(text);
    renderNav(hero);
  };
  img.src = assetBase + '.gif';
  img.onerror = function() {
    img.src = assetBase + '.png';
    img.onerror = function() {
      img.src = assetBase + '.jpg';
      img.onerror = function() {
        // Fallback to text
        const text = document.createElement('div');
        text.className = 'spa-hero-text';
        text.textContent = item.label;
        hero.appendChild(text);
        renderNav(hero);
      };
    };
  };
  root.appendChild(hero);
}

function renderNav(container) {
  const nav = document.createElement('div');
  nav.style.marginTop = '2rem';
  // Prev
  const prevBtn = document.createElement('button');
  prevBtn.className = 'spa-nav-btn';
  prevBtn.textContent = '← Prev';
  prevBtn.onclick = prevItem;
  nav.appendChild(prevBtn);
  // Next
  const nextBtn = document.createElement('button');
  nextBtn.className = 'spa-nav-btn';
  nextBtn.textContent = 'Next →';
  nextBtn.onclick = nextItem;
  nav.appendChild(nextBtn);
  container.appendChild(nav);
}

function prevItem() {
  if (currentItemIdx > 0) {
    currentItemIdx--;
  } else if (currentSectionIdx > 0) {
    currentSectionIdx--;
    currentItemIdx = SPA_SECTIONS[currentSectionIdx].items.length - 1;
  }
  triggerTransition(render);
}

function nextItem() {
  if (currentItemIdx < SPA_SECTIONS[currentSectionIdx].items.length - 1) {
    currentItemIdx++;
  } else if (currentSectionIdx < SPA_SECTIONS.length - 1) {
    currentSectionIdx++;
    currentItemIdx = 0;
  }
  triggerTransition(render);
}

// Keyboard navigation
window.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prevItem();
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextItem();
});

// Touch navigation (swipe)
let touchStartX = null;
let touchStartY = null;
window.addEventListener('touchstart', e => {
  if (e.touches.length === 1) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }
});
window.addEventListener('touchend', e => {
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

// Particle transition integration (placeholder)
function triggerTransition(cb) {
  // TODO: Integrate particlecarousel.engine.js here
  // For now, just call cb immediately
  cb();
}

// Initial render
render();
