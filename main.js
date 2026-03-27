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



function render() {
  const section = SPA_SECTIONS[currentSectionIdx];
  const item = section.items[currentItemIdx];
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

  // --- Main hero asset: DOM-based (img for GIF, div for text) ---
  const hero = document.createElement('div');
  hero.className = 'spa-hero';
  const gifMap = {
    tiktok: 'Tiktoklogospin.gif',
    instagram: 'Instagramlogospin.gif',
    youtube: 'Youtubelogospin.gif',
    spotify: 'Spotifylogospin.gif',
    appleMusic: 'Applemusiclogospin.gif',
    bandcamp: 'bandcamplogospin.gif',
    soundcloud: 'soundcloudlogospin.gif',
    cameralogo: 'cameralogospin.GIF',
  };
  const gifFile = gifMap[item.id];
  if (gifFile) {
    const img = document.createElement('img');
    img.className = 'spa-hero-image';
    img.src = `gifs/${gifFile}`;
    img.alt = item.label;
    img.width = 320;
    img.height = 320;
    hero.appendChild(img);
  } else {
    const textDiv = document.createElement('div');
    textDiv.className = 'spa-hero-text';
    textDiv.textContent = item.label;
    hero.appendChild(textDiv);
  }
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


// Particle transition integration (calls transition engine)
import { rasterizeHero } from './js/spa/rasterizeHero.js';
import { transition } from './js/spa/particleTransitionEngine.js';

async function triggerTransition(cb) {
  // 1. Rasterize current hero DOM to cropped canvas (before state change)
  const heroContainer = document.getElementById('spa-hero-container');
  const heroDiv = heroContainer.querySelector('.spa-hero');
  let from = null;
  if (heroDiv) {
    const img = heroDiv.querySelector('img');
    if (img) {
      from = await rasterizeHero({ type: 'gif', src: img.src });
    } else {
      const textDiv = heroDiv.querySelector('.spa-hero-text');
      if (textDiv) {
        from = await rasterizeHero({ type: 'text', text: textDiv.textContent });
      }
    }
  }

  // 2. Actually update state for next render
  cb();

  // 3. Rasterize new hero DOM to cropped canvas (after state change)
  const newHeroDiv = heroContainer.querySelector('.spa-hero');
  let to = null;
  if (newHeroDiv) {
    const img = newHeroDiv.querySelector('img');
    if (img) {
      to = await rasterizeHero({ type: 'gif', src: img.src });
    } else {
      const textDiv = newHeroDiv.querySelector('.spa-hero-text');
      if (textDiv) {
        to = await rasterizeHero({ type: 'text', text: textDiv.textContent });
      }
    }
  }

  // 4. If both cropped canvases exist, run the transition
  if (from && to) {
    // Hide hero DOM, show transition canvas
    heroContainer.style.visibility = 'hidden';
    const transitionCanvas = document.getElementById('transition-canvas');
    transitionCanvas.style.display = 'block';
    const ctx = transitionCanvas.getContext('2d');
    ctx.clearRect(0, 0, transitionCanvas.width, transitionCanvas.height);

    // Center the cropped regions in the transition canvas
    function centerDraw(ctx, src, region) {
      const dx = (transitionCanvas.width - region.width) / 2;
      const dy = (transitionCanvas.height - region.height) / 2;
      ctx.drawImage(region.canvas, 0, 0, region.width, region.height, dx, dy, region.width, region.height);
    }

    // Patch the transition engine to accept regions and center them
    await new Promise(res => {
      transition(
        from.canvas,
        to.canvas,
        {
          ctx,
          fromRegion: from,
          toRegion: to,
          centerDraw,
        },
        () => {
          // After transition, hide canvas, show hero DOM
          transitionCanvas.style.display = 'none';
          heroContainer.style.visibility = 'visible';
          res();
        }
      );
    });
  }
}

// Initial render and nav bar setup
setupItemNav();
render();
