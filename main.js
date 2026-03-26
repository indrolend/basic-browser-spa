// Homedev SPA - Minimal, modular, and particle transition ready
// Sections and items config
const SPA_SECTIONS = [
  {
    id: 'home',
    label: 'Home',
    items: [ { id: 'main', label: 'Home' } ]
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
  },
  {
    id: 'games',
    label: 'Games',
    items: [ { id: 'asymptote', label: 'Asymptote Engine' } ]
  },
  {
    id: 'about',
    label: 'About',
    items: [
      { id: 'discography', label: 'Discography' },
      { id: 'devHistory', label: 'Development History' },
      { id: 'journal', label: 'Journal' }
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
const transitionCanvas = document.getElementById('transition-canvas');
const transitionCtx = transitionCanvas.getContext('2d');


function render() {
  const section = SPA_SECTIONS[currentSectionIdx];
  const item = section.items[currentItemIdx];
  // Only clear the hero area, not the whole root
  const heroContainer = document.getElementById('spa-hero-container');
  heroContainer.innerHTML = '';

  // --- Top nav: sections ---
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
    if (idx === currentSectionIdx) {
      btn.style.fontWeight = 'bold';
      btn.style.background = '#333';
    } else {
      btn.style.fontWeight = 'normal';
      btn.style.background = '';
    }
    btn.onclick = () => {
      if (currentSectionIdx !== idx) {
        currentSectionIdx = idx;
        currentItemIdx = 0;
        triggerTransition(render);
      }
    };
    sectionNav.appendChild(btn);
  });

  // --- Main hero asset (only item name centered) ---
  const hero = document.createElement('div');
  hero.className = 'spa-hero';
  const assetBase = getAssetPath(section.id, item.id);
  const img = new window.Image();
  img.onload = function() {
    img.className = 'spa-hero-image';
    hero.appendChild(img);
  };
  img.onerror = function() {
    const text = document.createElement('div');
    text.className = 'spa-hero-text';
    text.textContent = item.label;
    hero.appendChild(text);
  };
  img.src = assetBase + '.gif';
  img.onerror = function() {
    img.src = assetBase + '.png';
    img.onerror = function() {
      img.src = assetBase + '.jpg';
      img.onerror = function() {
        const text = document.createElement('div');
        text.className = 'spa-hero-text';
        text.textContent = item.label;
        hero.appendChild(text);
      };
    };
  };
  heroContainer.appendChild(hero);
}


// Create the nav bar once at startup and never clear it
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

function prevItem() {
  if (currentItemIdx > 0) {
    currentItemIdx--;
  } else {
    currentSectionIdx = (currentSectionIdx - 1 + SPA_SECTIONS.length) % SPA_SECTIONS.length;
    currentItemIdx = SPA_SECTIONS[currentSectionIdx].items.length - 1;
  }
  triggerTransition(render);
}

function nextItem() {
  if (currentItemIdx < SPA_SECTIONS[currentSectionIdx].items.length - 1) {
    currentItemIdx++;
  } else {
    currentSectionIdx = (currentSectionIdx + 1) % SPA_SECTIONS.length;
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


// Particle transition integration (simple placeholder effect)
function triggerTransition(cb) {
  // Show a quick fade-out/fade-in effect using the transition canvas
  transitionCanvas.width = window.innerWidth;
  transitionCanvas.height = window.innerHeight;
  transitionCanvas.style.display = 'block';
  transitionCtx.fillStyle = '#111';
  transitionCtx.globalAlpha = 0;
  transitionCtx.fillRect(0, 0, transitionCanvas.width, transitionCanvas.height);
  let alpha = 0;
  function fadeOut() {
    alpha += 0.08;
    transitionCtx.globalAlpha = alpha;
    transitionCtx.fillRect(0, 0, transitionCanvas.width, transitionCanvas.height);
    if (alpha < 1) {
      requestAnimationFrame(fadeOut);
    } else {
      cb();
      fadeIn();
    }
  }
  function fadeIn() {
    alpha -= 0.08;
    transitionCtx.globalAlpha = alpha;
    transitionCtx.fillRect(0, 0, transitionCanvas.width, transitionCanvas.height);
    if (alpha > 0) {
      requestAnimationFrame(fadeIn);
    } else {
      transitionCanvas.style.display = 'none';
    }
  }
  fadeOut();
}

// Initial render and nav bar setup
setupItemNav();
render();
