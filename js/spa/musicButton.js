import manager from './musicManager.js';
import { openMusicPlayer } from './musicPlayerSection.js';

export function initMusicButton() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'spa-nav-btn music-nav-btn';
  btn.setAttribute('aria-label', 'Open music player');
  btn.textContent = '♪ Music';
  document.body.appendChild(btn);

  let pressTimer = null;
  btn.addEventListener('pointerdown', () => {
    pressTimer = setTimeout(() => manager.toggleEnabled(), 650);
  });
  btn.addEventListener('pointerup', () => {
    if (pressTimer) clearTimeout(pressTimer);
  });
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    openMusicPlayer();
  });
  btn.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    manager.toggleEnabled();
  });
}
