// SPA Home View — "swarm" panel
// Renders character-particle background identical to the one in pages/home.html.
// Exposes getTransitionCanvas() so the transition engine can sample its pixels.

(function () {
  var canvas      = null;
  var ctx         = null;
  var animId      = null;
  var particles   = [];

  var PARTICLE_COUNT   = 60;
  var MAX_SPEED        = 0.6;
  var CONNECTION_DIST  = 120;
  var REPULSE_DIST     = 150;
  var PARTICLE_COLOR   = 'rgba(94, 232, 125, 0.4)';
  var LINE_COLOR       = 'rgba(94, 232, 125, 0.1)';

  var mouse = { x: null, y: null };

  var charPool = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz@#$%&*?!+-=';

  function rndChar() {
    return charPool[Math.floor(Math.random() * charPool.length)];
  }

  function makeParticle() {
    var size = Math.floor(Math.random() * 6 + 10);
    return {
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * MAX_SPEED,
      vy: (Math.random() - 0.5) * MAX_SPEED,
      size: size,
      font: size + 'px "SF Mono", Menlo, Monaco, Consolas, monospace',
      char: rndChar(),
      changeInterval: Math.random() * 1200 + 300,
      lastChange: performance.now()
    };
  }

  function initParticles() {
    if (!canvas) return;
    particles = [];
    for (var i = 0; i < PARTICLE_COUNT; i++) particles.push(makeParticle());
  }

  function resizeCanvas() {
    if (!canvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function update() {
    var now = performance.now();
    particles.forEach(function (p) {
      if (now - p.lastChange > p.changeInterval) {
        p.char = rndChar();
        p.lastChange = now;
      }

      // Mouse repulsion
      if (mouse.x !== null) {
        var dx   = p.x - mouse.x;
        var dy   = p.y - mouse.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < REPULSE_DIST && dist > 0) {
          var force = (REPULSE_DIST - dist) / REPULSE_DIST;
          p.vx += (dx / dist) * force * 0.5;
          p.vy += (dy / dist) * force * 0.5;
        }
      }

      p.x  += p.vx;
      p.y  += p.vy;
      p.vx *= 0.99;
      p.vy *= 0.99;

      // Speed cap
      var spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      var cap = MAX_SPEED * 3;
      if (spd > cap) { p.vx = (p.vx / spd) * cap; p.vy = (p.vy / spd) * cap; }

      // Bounce
      if (p.x < 0)             { p.x = 0;             p.vx *= -1; }
      if (p.x > canvas.width)  { p.x = canvas.width;  p.vx *= -1; }
      if (p.y < 0)             { p.y = 0;             p.vy *= -1; }
      if (p.y > canvas.height) { p.y = canvas.height; p.vy *= -1; }
    });
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Characters
    ctx.fillStyle = PARTICLE_COLOR;
    particles.forEach(function (p) {
      ctx.font = p.font;
      ctx.fillText(p.char, p.x, p.y);
    });

    // Connections
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth   = 1;
    for (var i = 0; i < particles.length; i++) {
      for (var j = i + 1; j < particles.length; j++) {
        var ddx  = particles[i].x - particles[j].x;
        var ddy  = particles[i].y - particles[j].y;
        var dist = Math.sqrt(ddx * ddx + ddy * ddy);
        if (dist < CONNECTION_DIST) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
  }

  function animate() {
    update();
    draw();
    animId = requestAnimationFrame(animate);
  }

  // ─── view lifecycle ──────────────────────────────────────────────────────────

  function mount(itemId, container) {
    container.innerHTML =
      '<canvas class="spa-home-canvas" id="spa-home-canvas"></canvas>' +
      '<div class="spa-home-label"><span class="important-word">indrolend</span></div>';

    canvas = container.querySelector('#spa-home-canvas');
    ctx    = canvas.getContext('2d');

    resizeCanvas();
    initParticles();

    canvas.addEventListener('mousemove', function (e) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });
    canvas.addEventListener('mouseleave', function () {
      mouse.x = null;
      mouse.y = null;
    });

    window.addEventListener('resize', function () {
      resizeCanvas();
      initParticles();
    });
  }

  function onActivate() {
    if (!animId) animate();
  }

  function onDeactivate() {
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
  }

  function getTransitionCanvas() {
    return canvas;
  }

  if (!window.__SPA_Views) window.__SPA_Views = {};
  window.__SPA_Views.home = {
    mount:               mount,
    onActivate:          onActivate,
    onDeactivate:        onDeactivate,
    getTransitionCanvas: getTransitionCanvas
  };
}());
