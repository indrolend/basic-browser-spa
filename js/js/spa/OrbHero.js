// OrbHero.js
// Animated, interactive vinyl/particle orb for music player


export default class OrbHero {
  constructor() {
    this.size = 320;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    this.ctx = this.canvas.getContext('2d');
    this.center = { x: this.size / 2, y: this.size / 2 };
    this.radius = 110;
    this.particleCount = 48;
    this.baseSpinRate = 0.012; // radians/frame
    this.spin = 0;
    this.spinVel = this.baseSpinRate;
    this.isScratching = false;
    this.lastPointerAngle = null;
    this.lastPointerTime = null;
    this.lastSpinVel = this.baseSpinRate;
    this.springBack = false;
    this._bindEvents();
    this._animating = false;
  }

  _bindEvents() {
    this.canvas.addEventListener('pointerdown', this._onPointerDown.bind(this));
    window.addEventListener('pointermove', this._onPointerMove.bind(this));
    window.addEventListener('pointerup', this._onPointerUp.bind(this));
    this.canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  }

  _getPointerAngle(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left - this.center.x;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top - this.center.y;
    return Math.atan2(y, x);
  }

  _onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    this.isScratching = true;
    this.springBack = false;
    this.lastPointerAngle = this._getPointerAngle(e);
    this.lastPointerTime = performance.now();
    this.lastSpinVel = 0;
    window.MusicManager?.pause();
    e.preventDefault();
  }

  _onPointerMove(e) {
    if (!this.isScratching) return;
    const angle = this._getPointerAngle(e);
    const now = performance.now();
    if (this.lastPointerAngle !== null) {
      let delta = angle - this.lastPointerAngle;
      // Normalize to [-PI, PI]
      if (delta > Math.PI) delta -= 2 * Math.PI;
      if (delta < -Math.PI) delta += 2 * Math.PI;
      this.spin += delta;
      // Map delta to audio scrub
      const duration = window.MusicManager?.getDuration?.() || 1;
      const curTime = window.MusicManager?.getCurrentTime?.() || 0;
      const newTime = curTime + (delta / (2 * Math.PI)) * duration;
      window.MusicManager?.scrubToPosition(newTime);
      // Track velocity for spring-back
      const dt = (now - this.lastPointerTime) / 1000;
      if (dt > 0) this.lastSpinVel = delta / dt;
    }
    this.lastPointerAngle = angle;
    this.lastPointerTime = now;
  }

  _onPointerUp(e) {
    if (!this.isScratching) return;
    this.isScratching = false;
    this.springBack = true;
    // Use lastSpinVel for spring ease
    this.springStartVel = this.lastSpinVel;
    this.springStartTime = performance.now();
    window.MusicManager?.play();
  }

  start() {
    if (this._animating) return;
    this._animating = true;
    this._animate();
  }

  stop() {
    this._animating = false;
  }

  _animate() {
    if (!this._animating) return;
    // Spring-back logic
    if (this.springBack) {
      const t = (performance.now() - this.springStartTime) / 600;
      // Damped spring: ease velocity to baseSpinRate
      this.spinVel = this.springStartVel * Math.exp(-2 * t) + this.baseSpinRate * (1 - Math.exp(-2 * t));
      if (Math.abs(this.spinVel - this.baseSpinRate) < 0.0005) {
        this.spinVel = this.baseSpinRate;
        this.springBack = false;
      }
    } else if (!this.isScratching) {
      this.spinVel = this.baseSpinRate;
    }
    if (!this.isScratching) this.spin += this.spinVel;

    // Draw orb
    this._draw();
    requestAnimationFrame(() => this._animate());
  }

  _draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.size, this.size);
    // Outer glow
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.center.x, this.center.y, this.radius + 16, 0, 2 * Math.PI);
    ctx.shadowColor = 'rgba(120,180,255,0.18)';
    ctx.shadowBlur = 32;
    ctx.strokeStyle = 'rgba(120,180,255,0.12)';
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.restore();

    // Particles
    const analyser = window.MusicManager?.getAnalyserNode?.();
    let spectrum = new Uint8Array(this.particleCount);
    if (analyser) {
      analyser.getByteFrequencyData(spectrum);
    }
    for (let i = 0; i < this.particleCount; i++) {
      const angle = this.spin + (i / this.particleCount) * 2 * Math.PI;
      const amp = (spectrum[i] || 0) / 255;
      const r = this.radius + Math.sin(angle * 2 + this.spin) * 6 + amp * 24;
      const x = this.center.x + Math.cos(angle) * r;
      const y = this.center.y + Math.sin(angle) * r;
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, 7 + amp * 6, 0, 2 * Math.PI);
      ctx.fillStyle = `rgba(${180 + amp * 60},${200 + amp * 40},255,${0.32 + 0.45 * amp})`;
      ctx.shadowColor = `rgba(120,180,255,${0.18 + 0.25 * amp})`;
      ctx.shadowBlur = 16 + amp * 16;
      ctx.fill();
      ctx.restore();
    }

    // Vinyl center
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.center.x, this.center.y, 32, 0, 2 * Math.PI);
    ctx.fillStyle = '#222b3a';
    ctx.shadowColor = 'rgba(120,180,255,0.12)';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();

    // Center dot
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.center.x, this.center.y, 8, 0, 2 * Math.PI);
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.8;
    ctx.fill();
    ctx.restore();
  }
}
