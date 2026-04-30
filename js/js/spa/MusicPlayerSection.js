// MusicPlayerSection.js
// Modal/section for music player, contains OrbHero and controls


import OrbHero from './OrbHero.js';

export default class MusicPlayerSection {
  constructor() {
    this.visible = false;
    this._buildDOM();
    this._bindEvents();
    this._updateUI();
  }

  _buildDOM() {
    this.overlay = document.createElement('div');
    this.overlay.style.position = 'fixed';
    this.overlay.style.left = '0';
    this.overlay.style.top = '0';
    this.overlay.style.width = '100vw';
    this.overlay.style.height = '100vh';
    this.overlay.style.background = 'rgba(16,18,24,0.92)';
    this.overlay.style.zIndex = '2000';
    this.overlay.style.display = 'none';
    this.overlay.style.justifyContent = 'center';
    this.overlay.style.alignItems = 'center';
    this.overlay.style.flexDirection = 'column';
    this.overlay.style.transition = 'opacity 0.18s';
    this.overlay.tabIndex = -1;
    this.overlay.style.outline = 'none';
    this.overlay.style.display = 'flex';

    // OrbHero
    this.orbHero = new OrbHero();
    this.overlay.appendChild(this.orbHero.canvas);

    // Controls
    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.gap = '24px';
    controls.style.marginTop = '32px';
    controls.style.alignItems = 'center';

    // Prev
    this.prevBtn = document.createElement('button');
    this.prevBtn.innerHTML = '⏮️';
    this.prevBtn.style.fontSize = '2rem';
    this.prevBtn.style.background = 'none';
    this.prevBtn.style.border = 'none';
    this.prevBtn.style.cursor = 'pointer';
    controls.appendChild(this.prevBtn);

    // Mute toggle
    this.toggleBtn = document.createElement('button');
    this.toggleBtn.innerHTML = '🔊';
    this.toggleBtn.style.fontSize = '2rem';
    this.toggleBtn.style.background = 'none';
    this.toggleBtn.style.border = 'none';
    this.toggleBtn.style.cursor = 'pointer';
    controls.appendChild(this.toggleBtn);

    // Next
    this.nextBtn = document.createElement('button');
    this.nextBtn.innerHTML = '⏭️';
    this.nextBtn.style.fontSize = '2rem';
    this.nextBtn.style.background = 'none';
    this.nextBtn.style.border = 'none';
    this.nextBtn.style.cursor = 'pointer';
    controls.appendChild(this.nextBtn);

    this.overlay.appendChild(controls);

    // Close button (top right)
    this.closeBtn = document.createElement('button');
    this.closeBtn.innerHTML = '✕';
    this.closeBtn.style.position = 'absolute';
    this.closeBtn.style.top = '24px';
    this.closeBtn.style.right = '24px';
    this.closeBtn.style.fontSize = '2rem';
    this.closeBtn.style.background = 'none';
    this.closeBtn.style.border = 'none';
    this.closeBtn.style.color = '#fff';
    this.closeBtn.style.cursor = 'pointer';
    this.overlay.appendChild(this.closeBtn);

    document.body.appendChild(this.overlay);
  }

  _bindEvents() {
    this.closeBtn.addEventListener('click', () => this.hide());
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });
    this.toggleBtn.addEventListener('click', () => {
      if (window.MusicManager) {
        window.MusicManager.setMusicEnabled(!window.MusicManager.musicEnabled);
        this._updateUI();
      }
    });
    this.nextBtn.addEventListener('click', () => {
      window.MusicManager?.nextRandomTrack();
    });
    this.prevBtn.addEventListener('click', () => {
      // For now, just random track (no strict prev)
      window.MusicManager?.nextRandomTrack();
    });
    document.addEventListener('keydown', (e) => {
      if (this.visible && (e.key === 'Escape' || e.key === 'Esc')) this.hide();
    });
  }

  _updateUI() {
    const enabled = window.MusicManager?.musicEnabled;
    this.toggleBtn.innerHTML = enabled ? '🔊' : '🔇';
  }

  show() {
    this.visible = true;
    this.overlay.style.display = 'flex';
    this.overlay.style.opacity = '1';
    this._updateUI();
    this.orbHero.start();
    setTimeout(() => { this.overlay.focus(); }, 10);
  }

  hide() {
    this.visible = false;
    this.overlay.style.opacity = '0';
    setTimeout(() => {
      if (!this.visible) this.overlay.style.display = 'none';
      this.orbHero.stop();
    }, 180);
  }
}

// Expose a global for MusicButton to toggle
window.toggleMusicPlayerSection = function() {
  if (!window.__musicPlayerSectionInstance) {
    window.__musicPlayerSectionInstance = new MusicPlayerSection();
  }
  const inst = window.__musicPlayerSectionInstance;
  if (inst.visible) inst.hide();
  else inst.show();
};
