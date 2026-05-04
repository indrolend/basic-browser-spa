// SPA Particle Transition Engine — Phase 1
// Provides a simple fade-to-black / fade-from-black transition using #spa-transition-canvas.
// If a fromCanvas is supplied, a minimal particle-sampling effect is used;
// otherwise a plain black cross-fade is performed.
//
// Public API: window.__SPA_Transition.transition(fromCanvas, toCanvas, done)

(function () {
  var DURATION = 480; // ms for full transition (half fade-out, half fade-in)
  var PARTICLE_COUNT = 60;

  function getCanvas() {
    return document.getElementById('spa-transition-canvas');
  }

  function resize(c) {
    c.width  = window.innerWidth;
    c.height = window.innerHeight;
  }

  // Sample pixel colours from a source canvas for a light particle effect
  function sampleParticles(src, count) {
    if (!src) return null;
    try {
      var sw = src.width, sh = src.height;
      if (sw === 0 || sh === 0) return null;
      var srcCtx = src.getContext('2d');
      if (!srcCtx) return null;
      var data = srcCtx.getImageData(0, 0, sw, sh).data;
      var particles = [];
      for (var i = 0; i < count; i++) {
        var px = Math.floor(Math.random() * sw);
        var py = Math.floor(Math.random() * sh);
        var idx = (py * sw + px) * 4;
        var r = data[idx], g = data[idx + 1], b = data[idx + 2];
        particles.push({
          x: (px / sw) * window.innerWidth,
          y: (py / sh) * window.innerHeight,
          vx: (Math.random() - 0.5) * 4,
          vy: (Math.random() - 0.5) * 4,
          color: 'rgb(' + r + ',' + g + ',' + b + ')',
          radius: Math.random() * 3 + 1
        });
      }
      return particles;
    } catch (e) {
      return null;
    }
  }

  function transition(fromCanvas, toCanvas, done) {
    var c = getCanvas();
    if (!c) {
      if (done) done();
      return;
    }

    resize(c);
    c.style.display = 'block';
    c.style.opacity = '1';
    var ctx = c.getContext('2d');

    var particles = sampleParticles(fromCanvas, PARTICLE_COUNT);
    var start = null;

    function step(ts) {
      if (!start) start = ts;
      var elapsed = ts - start;
      var progress = Math.min(elapsed / DURATION, 1);

      ctx.clearRect(0, 0, c.width, c.height);

      // Cross-fade overlay
      var alpha;
      if (progress < 0.5) {
        alpha = progress * 2;              // 0 → 1
      } else {
        alpha = 1 - (progress - 0.5) * 2; // 1 → 0
      }

      // Particle layer (only during first half — dispersal phase)
      if (particles && progress < 0.5) {
        var pAlpha = 1 - progress * 2;
        particles.forEach(function (p) {
          p.x += p.vx;
          p.y += p.vy;
          ctx.globalAlpha = pAlpha * 0.8;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;
      }

      // Black overlay
      ctx.fillStyle = 'rgba(0,0,0,' + alpha.toFixed(3) + ')';
      ctx.fillRect(0, 0, c.width, c.height);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        c.style.display = 'none';
        ctx.clearRect(0, 0, c.width, c.height);
        if (done) done();
      }
    }

    requestAnimationFrame(step);
  }

  window.__SPA_Transition = {
    transition: transition
  };
}());
