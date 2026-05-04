import manager from './musicManager.js';
import { openMusicPlayer } from './musicPlayerSection.js';

export function initMusicButton() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'music-fab';
  btn.setAttribute('aria-label', 'Open music player');
  btn.hidden = true;

  const canvas = document.createElement('canvas');
  canvas.width = 56;
  canvas.height = 56;
  btn.appendChild(canvas);
  document.body.appendChild(btn);
  const ctx = canvas.getContext('2d');

  function updateVisibility() {
    btn.hidden = manager.interactionCount < 3;
  }

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

  function draw() {
    ctx.clearRect(0, 0, 56, 56);
    ctx.fillStyle = '#1b1b1b';
    ctx.beginPath(); ctx.arc(28, 28, 27, 0, Math.PI * 2); ctx.fill();
    const data = manager.getAnalyserData();
    const bars = 20;
    for (let i = 0; i < bars; i++) {
      const a = (i / bars) * Math.PI * 2;
      const amp = data ? data[Math.floor((i / bars) * data.length)] / 255 : 0.2;
      const len = 5 + amp * 10;
      const r1 = 12, r2 = r1 + len;
      ctx.strokeStyle = '#5ee87d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(28 + Math.cos(a) * r1, 28 + Math.sin(a) * r1);
      ctx.lineTo(28 + Math.cos(a) * r2, 28 + Math.sin(a) * r2);
      ctx.stroke();
    }
    requestAnimationFrame(draw);
  }

  manager.onChange(updateVisibility);
  updateVisibility();
  draw();
}
