// MusicButton.js
// Persistent spectrum analyzer button (canvas-based)
// Appears after 3 interactions, toggles MusicPlayerSection


export default class MusicButton {
  constructor() {
    this.visible = false;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 64;
    this.canvas.height = 64;
    this.canvas.style.position = 'fixed';
    this.canvas.style.right = '24px';
    this.canvas.style.bottom = '24px';
    this.canvas.style.zIndex = '1000';
    this.canvas.style.borderRadius = '50%';
    this.canvas.style.boxShadow = '0 2px 12px rgba(0,0,0,0.18)';
    this.canvas.style.background = 'rgba(24,24,32,0.92)';
    this.canvas.style.cursor = 'pointer';
    this.canvas.style.display = 'none';
    this.canvas.setAttribute('aria-label', 'Music Player');
    this.canvas.setAttribute('tabindex', '0');
    document.body.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d');
    this._bindEvents();
    this._startAnimation();
  }

  _bindEvents() {
    this.canvas.addEventListener('click', () => {
      if (window.toggleMusicPlayerSection) window.toggleMusicPlayerSection();
    });
    // Optional: keyboard accessibility
    this.canvas.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        if (window.toggleMusicPlayerSection) window.toggleMusicPlayerSection();
      }
    });
    // Long-press/context for mute toggle
    let pressTimer = null;
    this.canvas.addEventListener('mousedown', () => {
      pressTimer = setTimeout(() => {
        if (window.MusicManager) window.MusicManager.setMusicEnabled(!window.MusicManager.musicEnabled);
      }, 700);
    });
    this.canvas.addEventListener('mouseup', () => { clearTimeout(pressTimer); });
    this.canvas.addEventListener('mouseleave', () => { clearTimeout(pressTimer); });
    this.canvas.addEventListener('touchstart', () => {
      pressTimer = setTimeout(() => {
        if (window.MusicManager) window.MusicManager.setMusicEnabled(!window.MusicManager.musicEnabled);
      }, 700);
    });
    this.canvas.addEventListener('touchend', () => { clearTimeout(pressTimer); });
  }

  show() {
    this.visible = true;
    this.canvas.style.display = 'block';
  }

  hide() {
    this.visible = false;
    this.canvas.style.display = 'none';
  }

  _startAnimation() {
    const draw = () => {
      if (!this.visible) return requestAnimationFrame(draw);
      const analyser = window.MusicManager?.getAnalyserNode?.();
      const ctx = this.ctx;
      ctx.clearRect(0, 0, 64, 64);
      // Draw outer circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(32, 32, 31, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      // Draw spectrum bars
      if (analyser) {
        const arr = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(arr);
        const bars = 32;
        for (let i = 0; i < bars; i++) {
          const angle = (i / bars) * 2 * Math.PI;
          const mag = arr[i] / 255;
          const r0 = 20, r1 = 28 + mag * 8;
          const x0 = 32 + Math.cos(angle) * r0;
          const y0 = 32 + Math.sin(angle) * r0;
          const x1 = 32 + Math.cos(angle) * r1;
          const y1 = 32 + Math.sin(angle) * r1;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.strokeStyle = `rgba(180,220,255,${0.45 + 0.45 * mag})`;
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      }
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  }
}

// Expose a global for MusicManager to call when 3 interactions reached
window.showMusicButton = function() {
  if (!window.__musicButtonInstance) {
    window.__musicButtonInstance = new MusicButton();
  }
  window.__musicButtonInstance.show();
};
