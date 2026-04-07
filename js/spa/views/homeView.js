// SPA Home View - first-load entrance intro (image-based)
// Uses Untitled_design.png directly: reveal -> particle burst -> "swipe" reform.

(function () {
  var root = null;
  var canvas = null;
  var ctx = null;
  var animId = null;

  var introHasPlayed = false;
  var introActive = false;
  var introStartAt = 0;
  var startRequested = false;

  var particles = null;
  var skipHandler = null;
  var resizeHandler = null;

  var homeImage = null;
  var imageInit = false;
  var imageLoaded = false;
  var imageError = false;

  var ACCENT = '#5ee87d';
  var INK = '#0a0a0a';
  var MONO_FONT = '"SF Mono", Menlo, Monaco, Consolas, monospace';

  var REVEAL_MS = 720;
  var HOLD_MS = 140;
  var BURST_MS = 320;
  var REFORM_MS = 520;
  var REST_HINT = 'swipe to move';

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeOutQuad(t) {
    var p = clamp(t, 0, 1);
    return 1 - (1 - p) * (1 - p);
  }

  function easeOutCubic(t) {
    var p = clamp(t, 0, 1);
    return 1 - Math.pow(1 - p, 3);
  }

  function easeInOutQuad(t) {
    var p = clamp(t, 0, 1);
    return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  }

  function sampleByCoverage(list, count) {
    if (!list.length || count <= 0) return [];
    var sampled = [];
    for (var i = 0; i < count; i += 1) {
      sampled.push(list[Math.floor((i * list.length) / count) % list.length]);
    }
    return sampled;
  }

  function getCanvasSize() {
    if (!root) return { cssW: 0, cssH: 0, dpr: 1 };
    var rect = root.getBoundingClientRect();
    var cssW = Math.max(300, Math.round(rect.width));
    var cssH = Math.max(280, Math.round(rect.height));
    var dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    return { cssW: cssW, cssH: cssH, dpr: dpr };
  }

  function clearCanvas() {
    var size = getCanvasSize();
    ctx.clearRect(0, 0, size.cssW, size.cssH);
  }

  function resizeCanvas() {
    if (!canvas || !ctx) return;
    var size = getCanvasSize();
    canvas.width = size.cssW * size.dpr;
    canvas.height = size.cssH * size.dpr;
    canvas.style.width = size.cssW + 'px';
    canvas.style.height = size.cssH + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(size.dpr, size.dpr);

    if (introActive) {
      finishIntro();
      return;
    }
    drawRestingState();
  }

  function getStageRect() {
    if (!canvas) return { x: 0, y: 0, width: 0, height: 0 };
    var size = getCanvasSize();
    var stageSize = Math.min(size.cssW * 0.82, size.cssH * 0.92, 580);
    return {
      x: (size.cssW - stageSize) / 2,
      y: (size.cssH - stageSize) / 2,
      width: stageSize,
      height: stageSize
    };
  }

  function getImageDrawRect(stage) {
    if (!homeImage || !imageLoaded) {
      return { x: stage.x, y: stage.y, width: stage.width, height: stage.height };
    }
    var iw = homeImage.naturalWidth || stage.width;
    var ih = homeImage.naturalHeight || stage.height;
    var scale = Math.min(stage.width / iw, stage.height / ih);
    var drawW = iw * scale;
    var drawH = ih * scale;
    return {
      x: stage.x + (stage.width - drawW) / 2,
      y: stage.y + (stage.height - drawH) / 2,
      width: drawW,
      height: drawH
    };
  }

  function drawImageReveal(progress, stage) {
    if (!imageLoaded) return;
    var rect = getImageDrawRect(stage);
    var p = clamp(progress, 0, 1);
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.width * p, rect.height);
    ctx.clip();
    ctx.globalAlpha = 0.15 + 0.85 * p;
    ctx.drawImage(homeImage, rect.x, rect.y, rect.width, rect.height);
    ctx.restore();
  }

  function getImageSourcePoints(stage) {
    if (!imageLoaded) return [];
    var rect = getImageDrawRect(stage);
    var offscreen = document.createElement('canvas');
    offscreen.width = Math.max(1, Math.round(rect.width));
    offscreen.height = Math.max(1, Math.round(rect.height));
    var offctx = offscreen.getContext('2d');
    offctx.clearRect(0, 0, offscreen.width, offscreen.height);
    offctx.drawImage(homeImage, 0, 0, offscreen.width, offscreen.height);

    var data = offctx.getImageData(0, 0, offscreen.width, offscreen.height).data;
    var points = [];
    for (var y = 0; y < offscreen.height; y += 4) {
      for (var x = 0; x < offscreen.width; x += 4) {
        var idx = (y * offscreen.width + x) * 4;
        var r = data[idx];
        var g = data[idx + 1];
        var b = data[idx + 2];
        var a = data[idx + 3];
        // Keep mostly dark pixels so we sample the line art, not the flat background.
        if (a > 40 && (r + g + b) < 440) {
          points.push({
            x: rect.x + x,
            y: rect.y + y,
            color: 'rgba(' + r + ',' + g + ',' + b + ',' + (a / 255) + ')'
          });
        }
      }
    }
    return points;
  }

  function buildWordTargets(stage, count) {
    var offscreen = document.createElement('canvas');
    offscreen.width = Math.max(1, Math.round(stage.width));
    offscreen.height = Math.max(1, Math.round(stage.height));
    var offctx = offscreen.getContext('2d');
    var fontSize = Math.round(stage.width * 0.19);
    offctx.clearRect(0, 0, offscreen.width, offscreen.height);
    offctx.font = '700 ' + fontSize + 'px ' + MONO_FONT;
    offctx.textAlign = 'center';
    offctx.textBaseline = 'middle';
    offctx.fillStyle = '#ffffff';
    offctx.fillText('swipe', offscreen.width / 2, offscreen.height * 0.52);
    var data = offctx.getImageData(0, 0, offscreen.width, offscreen.height).data;
    var points = [];
    for (var y = 0; y < offscreen.height; y += 5) {
      for (var x = 0; x < offscreen.width; x += 5) {
        if (data[(y * offscreen.width + x) * 4 + 3] > 40) {
          points.push({ x: stage.x + x, y: stage.y + y });
        }
      }
    }
    return sampleByCoverage(points, count);
  }

  function ensureParticles(stage) {
    if (particles) return;

    var sourceRaw = getImageSourcePoints(stage);
    var source = sampleByCoverage(sourceRaw, Math.min(Math.max(sourceRaw.length, 160), 280));

    if (!source.length) {
      // Fallback if image sampling fails.
      for (var i = 0; i < 180; i += 1) {
        source.push({
          x: stage.x + Math.random() * stage.width,
          y: stage.y + Math.random() * stage.height,
          color: 'rgba(10,10,10,1)'
        });
      }
    }

    var targets = buildWordTargets(stage, source.length);
    particles = source.map(function (point, index) {
      var angle = Math.random() * Math.PI * 2;
      var radius = 26 + Math.random() * Math.min(stage.width, stage.height) * 0.18;
      return {
        sx: point.x,
        sy: point.y,
        bx: point.x + Math.cos(angle) * radius,
        by: point.y + Math.sin(angle) * radius,
        tx: targets[index] ? targets[index].x : point.x,
        ty: targets[index] ? targets[index].y : point.y,
        color: point.color
      };
    });
  }

  function drawBurstParticles(progress) {
    if (!particles) return;
    var p = easeOutCubic(progress);
    ctx.save();
    particles.forEach(function (particle) {
      ctx.fillStyle = particle.color || INK;
      ctx.globalAlpha = 1 - p * 0.08;
      ctx.beginPath();
      ctx.arc(lerp(particle.sx, particle.bx, p), lerp(particle.sy, particle.by, p), 2.05, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawSwipeParticles(progress) {
    if (!particles) return;
    var p = easeInOutQuad(progress);
    ctx.save();
    particles.forEach(function (particle) {
      ctx.fillStyle = ACCENT;
      ctx.globalAlpha = 0.3 + p * 0.7;
      ctx.beginPath();
      ctx.arc(lerp(particle.bx, particle.tx, p), lerp(particle.by, particle.ty, p), 2.15, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawRestingState() {
    if (!ctx) return;
    clearCanvas();
    var size = getCanvasSize();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = ACCENT;
    ctx.font = '700 ' + Math.round(Math.min(size.cssW * 0.15, 84)) + 'px ' + MONO_FONT;
    ctx.fillText('swipe', size.cssW / 2, size.cssH * 0.46);
    ctx.fillStyle = 'rgba(240, 240, 240, 0.45)';
    ctx.font = '500 ' + Math.round(Math.min(size.cssW * 0.034, 18)) + 'px ' + MONO_FONT;
    ctx.fillText(REST_HINT, size.cssW / 2, size.cssH * 0.61);
    ctx.restore();
  }

  function drawLoadingState() {
    if (!ctx) return;
    clearCanvas();
    var size = getCanvasSize();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(240, 240, 240, 0.45)';
    ctx.font = '500 ' + Math.round(Math.min(size.cssW * 0.033, 17)) + 'px ' + MONO_FONT;
    ctx.fillText('loading...', size.cssW / 2, size.cssH * 0.56);
    ctx.restore();
  }

  function renderIntroFrame(now) {
    if (!introActive) return;

    if (!imageLoaded && !imageError) {
      drawLoadingState();
      animId = requestAnimationFrame(renderIntroFrame);
      return;
    }

    if (imageError) {
      finishIntro();
      return;
    }

    var elapsed = now - introStartAt;
    var stage = getStageRect();
    clearCanvas();

    if (elapsed < REVEAL_MS) {
      drawImageReveal(elapsed / REVEAL_MS, stage);
    } else if (elapsed < REVEAL_MS + HOLD_MS) {
      drawImageReveal(1, stage);
    } else if (elapsed < REVEAL_MS + HOLD_MS + BURST_MS) {
      ensureParticles(stage);
      drawBurstParticles((elapsed - REVEAL_MS - HOLD_MS) / BURST_MS);
    } else if (elapsed < REVEAL_MS + HOLD_MS + BURST_MS + REFORM_MS) {
      ensureParticles(stage);
      drawSwipeParticles((elapsed - REVEAL_MS - HOLD_MS - BURST_MS) / REFORM_MS);
    } else {
      finishIntro();
      return;
    }

    animId = requestAnimationFrame(renderIntroFrame);
  }

  function detachSkipListeners() {
    if (skipHandler) {
      window.removeEventListener('pointerdown', skipHandler, true);
      window.removeEventListener('keydown', skipHandler, true);
      skipHandler = null;
    }
  }

  function finishIntro() {
    introActive = false;
    introHasPlayed = true;
    startRequested = false;
    particles = null;
    detachSkipListeners();
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
    drawRestingState();
  }

  function beginIntroTimeline() {
    introActive = true;
    particles = null;
    introStartAt = performance.now();
    if (animId) cancelAnimationFrame(animId);
    animId = requestAnimationFrame(renderIntroFrame);
  }

  function ensureImageLoaded() {
    if (imageInit) return;
    imageInit = true;
    homeImage = new window.Image();
    homeImage.onload = function () {
      imageLoaded = true;
      if (startRequested && !introHasPlayed) beginIntroTimeline();
    };
    homeImage.onerror = function () {
      imageError = true;
      if (startRequested && !introHasPlayed) finishIntro();
    };
    homeImage.src = 'Untitled_design.png';
  }

  function startIntro() {
    if (!ctx || introHasPlayed) {
      drawRestingState();
      return;
    }

    startRequested = true;

    if (!skipHandler) {
      skipHandler = function () {
        if (introActive || startRequested) finishIntro();
      };
      window.addEventListener('pointerdown', skipHandler, true);
      window.addEventListener('keydown', skipHandler, true);
    }

    ensureImageLoaded();

    if (imageLoaded) {
      beginIntroTimeline();
    } else if (!imageError) {
      introActive = true;
      drawLoadingState();
      animId = requestAnimationFrame(renderIntroFrame);
    } else {
      finishIntro();
    }
  }

  function mount(itemId, container) {
    root = container;
    root.innerHTML = '<div class="spa-home-intro"><canvas class="spa-home-canvas" id="spa-home-canvas"></canvas></div>';
    canvas = root.querySelector('#spa-home-canvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();

    ensureImageLoaded();

    if (!resizeHandler) {
      resizeHandler = function () { resizeCanvas(); };
      window.addEventListener('resize', resizeHandler);
    }
  }

  function onActivate() {
    if (!canvas || !ctx) return;
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
    if (introHasPlayed) {
      drawRestingState();
      return;
    }
    startIntro();
  }

  function onDeactivate() {
    if (introActive) finishIntro();
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
  }

  function getTransitionCanvas() {
    return canvas;
  }

  function buildHeroProbe() {
    var probeRoot = root && root.querySelector('.spa-home-intro');
    if (!(probeRoot instanceof window.HTMLElement)) return null;
    return { element: probeRoot };
  }

  if (!window.__SPA_Views) window.__SPA_Views = {};
  window.__SPA_Views.home = {
    mount: mount,
    onActivate: onActivate,
    onDeactivate: onDeactivate,
    getTransitionCanvas: getTransitionCanvas,
    buildHeroProbe: buildHeroProbe
  };
}());
