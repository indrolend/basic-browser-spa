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

  // --- Main hero asset: always a canvas ---
  const hero = document.createElement('div');
  hero.className = 'spa-hero';
  const heroCanvas = document.createElement('canvas');
  heroCanvas.className = 'spa-hero-image';
  heroCanvas.width = 320;
  heroCanvas.height = 320;
  hero.appendChild(heroCanvas);
  heroContainer.appendChild(hero);

  // Map item.id to the correct GIF filename in /gifs
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
    const img = new window.Image();
    img.onload = function() {
      // Draw GIF to canvas, centered
      const ctx = heroCanvas.getContext('2d');
      ctx.clearRect(0, 0, heroCanvas.width, heroCanvas.height);
      const scale = Math.min(heroCanvas.width / img.width, heroCanvas.height / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (heroCanvas.width - w) / 2, (heroCanvas.height - h) / 2, w, h);
    };
    img.onerror = function() {
      // Fallback to text if GIF fails
      const ctx = heroCanvas.getContext('2d');
      ctx.clearRect(0, 0, heroCanvas.width, heroCanvas.height);
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, heroCanvas.width, heroCanvas.height);
      ctx.font = 'bold 2.5rem SF Mono, Menlo, Monaco, Consolas, monospace';
      ctx.fillStyle = '#5ee87d';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.label, heroCanvas.width / 2, heroCanvas.height / 2);
    };
    img.src = `gifs/${gifFile}`;
  } else {
    // No GIF for this item, fallback to text
    const ctx = heroCanvas.getContext('2d');
    ctx.clearRect(0, 0, heroCanvas.width, heroCanvas.height);
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, heroCanvas.width, heroCanvas.height);
    ctx.font = 'bold 2.5rem SF Mono, Menlo, Monaco, Consolas, monospace';
    ctx.fillStyle = '#5ee87d';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.label, heroCanvas.width / 2, heroCanvas.height / 2);
  }
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
  // Get the hero canvas before state change
  const heroContainer = document.getElementById('spa-hero-container');
  const prevCanvas = heroContainer.querySelector('canvas');
  let prevImageData = null;
  if (prevCanvas) {
    // Copy the current hero canvas to an offscreen canvas
    const offscreen = document.createElement('canvas');
    offscreen.width = prevCanvas.width;
    offscreen.height = prevCanvas.height;
    offscreen.getContext('2d').drawImage(prevCanvas, 0, 0);
    prevImageData = offscreen;
  }

  // Actually update state for next render
  cb();

  // Get the new hero canvas after state change
  const newCanvas = heroContainer.querySelector('canvas');
  if (prevImageData && newCanvas) {
    // Save the new hero image as an offscreen canvas for the transition destination
    const toImage = document.createElement('canvas');
    toImage.width = newCanvas.width;
    toImage.height = newCanvas.height;
    toImage.getContext('2d').drawImage(newCanvas, 0, 0);
    // Start with the previous image drawn on the hero canvas
    newCanvas.getContext('2d').drawImage(prevImageData, 0, 0);
    await new Promise(res => {
      transition(
        prevImageData,
        toImage,
        { ctx: newCanvas.getContext('2d') },
        () => {
          // After transition, redraw the final hero asset (image or text)
          // Find the current item and GIF mapping
          const section = SPA_SECTIONS[currentSectionIdx];
          const item = section.items[currentItemIdx];
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
          const ctx = newCanvas.getContext('2d');
          if (gifFile) {
            const img = new window.Image();
            img.onload = function() {
              ctx.clearRect(0, 0, newCanvas.width, newCanvas.height);
              const scale = Math.min(newCanvas.width / img.width, newCanvas.height / img.height);
              const w = img.width * scale;
              const h = img.height * scale;
              ctx.drawImage(img, (newCanvas.width - w) / 2, (newCanvas.height - h) / 2, w, h);
            };
            img.onerror = function() {
              ctx.clearRect(0, 0, newCanvas.width, newCanvas.height);
              ctx.fillStyle = '#111';
              ctx.fillRect(0, 0, newCanvas.width, newCanvas.height);
              ctx.font = 'bold 2.5rem SF Mono, Menlo, Monaco, Consolas, monospace';
              ctx.fillStyle = '#5ee87d';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(item.label, newCanvas.width / 2, newCanvas.height / 2);
            };
            img.src = `gifs/${gifFile}`;
          } else {
            ctx.clearRect(0, 0, newCanvas.width, newCanvas.height);
            ctx.fillStyle = '#111';
            ctx.fillRect(0, 0, newCanvas.width, newCanvas.height);
            ctx.font = 'bold 2.5rem SF Mono, Menlo, Monaco, Consolas, monospace';
            ctx.fillStyle = '#5ee87d';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(item.label, newCanvas.width / 2, newCanvas.height / 2);
          }
          res();
        }
      );
    });
  }
}

// Initial render and nav bar setup
setupItemNav();
render();
