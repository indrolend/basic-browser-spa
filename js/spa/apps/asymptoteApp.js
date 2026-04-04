// Asymptote — SPA-integrated idle game engine
//
// Renders game content directly into the existing SPA DOM elements
// (spa-section-nav, spa-hero-container, spa-dots) so the game looks
// visually identical to the main SPA navigation: same button styles,
// same hero text style, same dots, same swipe gesture.
//
// Entry flow:
//   1. User navigates to Games / Asymptote Engine (sees tappable text hero)
//   2. User taps the hero → gamesView.onEnterGame() → AsymptoteApp.enterGame()
//   3. SPA DOM is replaced in-place with game sections + hero + dots
//   4. Only exit: the ✕ nav button → window.__SPA_GoHome()
//
// Exposes window.AsymptoteApp = { mount, enterGame, stopGame, deactivate }
// Exposes window.__SPA_GameNav when game is active

(function () {

  // ── GAME DATA ────────────────────────────────────────────────────────────────

  var GENERATORS = [
    {
      id: 'brainSquisher',
      name: 'Brain Squisher',
      baseCost: 10,
      baseProduction: 0.1,
      costMultiplier: 1.15,
      description: 'Squish the BIG thing into a small thing that fits in your head. Density.'
    },
    {
      id: 'copyMachine',
      name: 'The Copy Machine',
      baseCost: 50,
      baseProduction: 1.0,
      costMultiplier: 1.15,
      description: 'Copy the vibes that work. Forget the rest. Bootleg reality.'
    },
    {
      id: 'layerCake',
      name: 'Layer Cake',
      baseCost: 250,
      baseProduction: 5.0,
      costMultiplier: 1.15,
      description: 'It stacks. Layers on layers on more layers. Complexity hides itself.'
    },
    {
      id: 'lastStep',
      name: 'The Last Step',
      baseCost: 1000,
      baseProduction: 25.0,
      costMultiplier: 1.15,
      description: 'The last bit is what kills you. Or saves you. The edge. The asymptote.'
    },
    {
      id: 'infiniteLoop',
      name: 'Infinite Loop',
      baseCost: 5000,
      baseProduction: 100.0,
      costMultiplier: 1.15,
      description: 'Copy the copy of the copy — it goes brrrr but you drift from what\'s real.'
    }
  ];

  var UPGRADES = [
    {
      id: 'chunking',
      name: 'Chunking',
      cost: 100,
      description: '2× clicks. Stop the flow. Make it chunks. Patterns are objects now.',
      apply: function (s) { s.clickPower *= 2; }
    },
    {
      id: 'networkEffect',
      name: 'Network Effect',
      cost: 500,
      description: '2× production. Everyone copies reality differently. Squad up for scale.',
      apply: function (s) { s.productionMultiplier *= 2; }
    },
    {
      id: 'focusMode',
      name: 'Focus Mode',
      cost: 1000,
      description: '2.5× clicks. Limited attention. Pick what matters. Ignore the rest.',
      requires: 'chunking',
      apply: function (s) { s.clickPower *= 2.5; }
    },
    {
      id: 'moveFast',
      name: 'Move Fast',
      cost: 5000,
      description: '2× production. Speed beats perfect. Errors are fine upstream.',
      requires: 'networkEffect',
      apply: function (s) { s.productionMultiplier *= 2; }
    }
  ];

  var SACRIFICE_ACTIONS = [
    {
      id: 'ticksToUnderstanding',
      name: 'Sacrifice Ticks',
      description: 'Convert 10 ticks into 1 understanding.',
      canDo: function (s) { return s.resources.ticks >= 10; },
      execute: function (s) {
        s.resources.ticks -= 10;
        s.resources.understanding += 1;
      }
    },
    {
      id: 'understandingToTicks',
      name: 'Convert Understanding',
      description: 'Convert 1 understanding into 5 ticks.',
      canDo: function (s) { return s.resources.understanding >= 1; },
      execute: function (s) {
        s.resources.understanding -= 1;
        s.resources.ticks += 5;
      }
    },
    {
      id: 'temporalCollapse',
      name: 'Temporal Collapse',
      description: 'Reset understanding + ticks. Gain permanent click power from the loss.',
      canDo: function (s) {
        return s.resources.understanding >= 50 || s.resources.ticks >= 100;
      },
      execute: function (s) {
        var bonus = Math.max(1, Math.floor(
          s.resources.understanding * 0.1 + s.resources.ticks * 0.05
        ));
        s.resources.understanding = 0;
        s.resources.ticks = 0;
        s.clickPower += bonus;
      }
    }
  ];

  // Game sections — mirrors the SPA_SECTIONS structure exactly.
  // sectionIdx 0 = understanding (the main click action)
  // sectionIdx 1 = generators
  // sectionIdx 2 = upgrades
  // sectionIdx 3 = sacrifice
  var GAME_SECTIONS = [
    {
      id: 'understanding',
      label: '⊙',
      items: [
        { id: 'click', name: '+1 UNDERSTANDING', description: 'Click to gain understanding. This is the work.' }
      ]
    },
    { id: 'generators',  label: 'gen',      items: GENERATORS        },
    { id: 'upgrades',    label: 'upg',      items: UPGRADES          },
    { id: 'sacrifice',   label: 'sacrifice', items: SACRIFICE_ACTIONS }
  ];

  var TICKS_PER_SEC    = 10;
  var TICK_INTERVAL_MS = 100;

  // ── STATE ────────────────────────────────────────────────────────────────────

  var state = null;

  function createState() {
    var s = {
      resources: { understanding: 0, ticks: 0 },
      sectionIdx: 0,
      itemIndices: { understanding: 0, generators: 0, upgrades: 0, sacrifice: 0 },
      clickPower: 1,
      productionMultiplier: 1,
      generators: {},
      upgrades: {}
    };
    for (var i = 0; i < GENERATORS.length; i++) {
      s.generators[GENERATORS[i].id] = { count: 0 };
    }
    for (var j = 0; j < UPGRADES.length; j++) {
      s.upgrades[UPGRADES[j].id] = { purchased: false };
    }
    return s;
  }

  // ── GAME LOGIC ───────────────────────────────────────────────────────────────

  function getCurrentSection() {
    return GAME_SECTIONS[state.sectionIdx];
  }

  function getCurrentItem() {
    var sec = getCurrentSection();
    return sec.items[state.itemIndices[sec.id]] || null;
  }

  function getGeneratorCost(genId) {
    var def = null;
    for (var i = 0; i < GENERATORS.length; i++) {
      if (GENERATORS[i].id === genId) { def = GENERATORS[i]; break; }
    }
    return Math.floor(def.baseCost * Math.pow(def.costMultiplier, state.generators[genId].count));
  }

  function getProductionPerSecond() {
    var total = 0;
    for (var i = 0; i < GENERATORS.length; i++) {
      var def = GENERATORS[i];
      total += state.generators[def.id].count * def.baseProduction;
    }
    return total * state.productionMultiplier;
  }

  function canDoCurrentItem() {
    var sec  = getCurrentSection();
    var item = getCurrentItem();
    if (!item) return false;
    if (sec.id === 'understanding') return true;
    if (sec.id === 'generators') {
      return state.resources.understanding >= getGeneratorCost(item.id);
    }
    if (sec.id === 'upgrades') {
      if (state.upgrades[item.id].purchased) return false;
      if (state.resources.understanding < item.cost) return false;
      if (item.requires && !state.upgrades[item.requires].purchased) return false;
      return true;
    }
    if (sec.id === 'sacrifice') {
      return item.canDo(state);
    }
    return false;
  }

  function doCurrentItemAction() {
    var sec  = getCurrentSection();
    var item = getCurrentItem();
    if (!item) return;

    if (sec.id === 'understanding') {
      state.resources.understanding += state.clickPower;
      dirty = true;
      return;
    }
    if (sec.id === 'generators') {
      var cost = getGeneratorCost(item.id);
      if (state.resources.understanding < cost) return;
      state.resources.understanding -= cost;
      state.generators[item.id].count++;
    } else if (sec.id === 'upgrades') {
      if (!canDoCurrentItem()) return;
      state.resources.understanding -= item.cost;
      state.upgrades[item.id].purchased = true;
      item.apply(state);
    } else if (sec.id === 'sacrifice') {
      if (item.canDo(state)) item.execute(state);
    }
    dirty = true;
  }

  // ── NAVIGATION ───────────────────────────────────────────────────────────────

  // Linear navigation mirrors the main SPA:
  //   next item in current section → or first item of next section
  //   prev item in current section → or last item of previous section
  function getNextGameTarget() {
    var sec     = GAME_SECTIONS[state.sectionIdx];
    var itemIdx = state.itemIndices[sec.id];
    if (itemIdx < sec.items.length - 1) {
      return { sectionIdx: state.sectionIdx, itemIdx: itemIdx + 1 };
    }
    var nextSecIdx = (state.sectionIdx + 1) % GAME_SECTIONS.length;
    return { sectionIdx: nextSecIdx, itemIdx: 0 };
  }

  function getPrevGameTarget() {
    var sec     = GAME_SECTIONS[state.sectionIdx];
    var itemIdx = state.itemIndices[sec.id];
    if (itemIdx > 0) {
      return { sectionIdx: state.sectionIdx, itemIdx: itemIdx - 1 };
    }
    var prevSecIdx = (state.sectionIdx - 1 + GAME_SECTIONS.length) % GAME_SECTIONS.length;
    var prevSec    = GAME_SECTIONS[prevSecIdx];
    return { sectionIdx: prevSecIdx, itemIdx: prevSec.items.length - 1 };
  }

  function navigateTo(secIdx, itemIdx) {
    state.sectionIdx = secIdx;
    state.itemIndices[GAME_SECTIONS[secIdx].id] = itemIdx;
    renderGameDOM();
    dirty = true;
  }

  // ── TICK LOOP ────────────────────────────────────────────────────────────────

  var tickInterval = null;
  var lastTickTime = null;
  var tickPaused   = false;

  function startTick() {
    if (tickInterval !== null) return;
    lastTickTime = performance.now();
    tickPaused   = false;
    tickInterval = setInterval(function () {
      if (tickPaused) return;
      var now = performance.now();
      var dt  = Math.min((now - lastTickTime) / 1000, 1);
      lastTickTime = now;
      state.resources.understanding += getProductionPerSecond() * dt;
      state.resources.ticks         += TICKS_PER_SEC * dt;
      dirty = true;
    }, TICK_INTERVAL_MS);
    // Pause tick when tab is hidden so returning doesn't burst accumulated time.
    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  function stopTick() {
    if (tickInterval !== null) {
      clearInterval(tickInterval);
      tickInterval = null;
      lastTickTime = null;
    }
    document.removeEventListener('visibilitychange', onVisibilityChange);
  }

  function onVisibilityChange() {
    if (document.hidden) {
      tickPaused = true;
    } else {
      lastTickTime = performance.now();
      tickPaused   = false;
    }
  }

  // ── RENDER LOOP ──────────────────────────────────────────────────────────────

  var renderFrameId   = null;
  var mountAnimFrameId = null;
  var dirty           = false;

  function startRender() {
    if (renderFrameId !== null) return;
    (function loop() {
      updateLiveDisplay();
      renderFrameId = requestAnimationFrame(loop);
    }());
  }

  function stopRender() {
    if (renderFrameId !== null) {
      cancelAnimationFrame(renderFrameId);
      renderFrameId = null;
    }
  }

  // ── FORMATTING ───────────────────────────────────────────────────────────────

  function fmt(n) {
    if (!isFinite(n) || isNaN(n)) return '—';
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
    return n.toFixed(1);
  }

  // The text displayed in the hero area for each section/item.
  // For the understanding section the label is constant; generators and upgrades
  // include cost/count which update every tick, so this is also used by updateLiveDisplay.
  function getItemHeroText(sec, item) {
    if (sec.id === 'generators') {
      var count = state.generators[item.id].count;
      var cost  = getGeneratorCost(item.id);
      return item.name + ' [' + count + '] — ' + fmt(cost) + ' ⊙';
    }
    if (sec.id === 'upgrades') {
      if (state.upgrades[item.id].purchased) return item.name + ' ✓';
      return item.name + ' — ' + fmt(item.cost) + ' ⊙';
    }
    return item.name;
  }

  // ── DOM HELPERS ──────────────────────────────────────────────────────────────

  // Same touchend+onclick dual-wiring as addActivationHandler in main.js:
  // touchend fires immediately on mobile (no 300ms delay), preventDefault blocks
  // the synthetic click so the handler never double-fires.
  function wire(el, handler) {
    el.addEventListener('touchend', function (e) { e.preventDefault(); handler(); });
    el.onclick = handler;
  }

  function setElText(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
  }

  // ── LIVE DISPLAY UPDATE ──────────────────────────────────────────────────────

  // Called every rAF — only updates text nodes and the affordability class.
  // Does NOT rebuild DOM structure; that only happens on navigateTo().
  function updateLiveDisplay() {
    if (!dirty) return;
    dirty = false;

    // Stats (in spa-section-nav)
    var sectionNav = document.getElementById('spa-section-nav');
    if (sectionNav) {
      var pps = getProductionPerSecond();
      setElText(sectionNav.querySelector('.asy-stat-u'),  fmt(state.resources.understanding));
      setElText(sectionNav.querySelector('.asy-stat-ps'), fmt(pps) + '/s');
      setElText(sectionNav.querySelector('.asy-stat-t'),  fmt(state.resources.ticks));
    }

    // Hero text (generators/upgrades update as count/cost change)
    var heroContainer = document.getElementById('spa-hero-container');
    var heroTextEl    = heroContainer && heroContainer.querySelector('.spa-hero-text');
    if (heroTextEl) {
      var sec  = getCurrentSection();
      var item = getCurrentItem();
      if (item && sec.id !== 'understanding') {
        setElText(heroTextEl, getItemHeroText(sec, item));
      }
    }

    // Affordability indicator — dim hero text when item can't be actioned
    var heroEl = heroContainer && heroContainer.querySelector('.spa-hero');
    if (heroEl) {
      var canDo   = canDoCurrentItem();
      var secId   = getCurrentSection().id;
      heroEl.classList.toggle('asy-hero--dim', secId !== 'understanding' && !canDo);
    }
  }

  // ── GAME DOM RENDER ──────────────────────────────────────────────────────────

  // Renders the complete game UI into the three shared SPA DOM nodes.
  // Called on game entry and on every navigateTo().
  function renderGameDOM() {
    renderSectionNav();
    renderHero();
    renderDots();
  }

  // Replaces #spa-section-nav with game section tabs + stats row + exit button.
  // Uses .spa-nav-btn so buttons look identical to the main SPA nav.
  function renderSectionNav() {
    var sectionNav = document.getElementById('spa-section-nav');
    if (!sectionNav) return;
    sectionNav.innerHTML = '';

    // Stats bar — 100% width forces tabs onto the next flex row automatically
    var statsBar = document.createElement('div');
    statsBar.className = 'asy-stats-bar';
    statsBar.innerHTML =
      '<span class="asy-stat"><span class="asy-label">⊙</span>' +
        '<span class="asy-stat-u">—</span></span>' +
      '<span class="asy-stat"><span class="asy-label">rate</span>' +
        '<span class="asy-stat-ps">—</span></span>' +
      '<span class="asy-stat"><span class="asy-label">t</span>' +
        '<span class="asy-stat-t">—</span></span>';
    sectionNav.appendChild(statsBar);

    // Section buttons — .spa-nav-btn = visually identical to Home / Social / etc.
    GAME_SECTIONS.forEach(function (sec, idx) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'spa-nav-btn';
      btn.textContent = sec.label;
      btn.style.fontWeight = idx === state.sectionIdx ? 'bold'  : 'normal';
      btn.style.background = idx === state.sectionIdx ? '#333'  : '';
      btn.setAttribute('aria-current', idx === state.sectionIdx ? 'page' : 'false');
      wire(btn, (function (i) { return function () { navigateTo(i, 0); }; }(idx)));
      sectionNav.appendChild(btn);
    });

    // Exit button — same .spa-nav-btn base with a distinct label
    var exitBtn = document.createElement('button');
    exitBtn.type = 'button';
    exitBtn.className = 'spa-nav-btn asy-exit-btn';
    exitBtn.textContent = '✕';
    exitBtn.setAttribute('aria-label', 'exit game');
    wire(exitBtn, function () {
      if (window.__SPA_GoHome) window.__SPA_GoHome();
    });
    sectionNav.appendChild(exitBtn);

    // Seed stats immediately so there's no blank flash
    dirty = true;
  }

  // Renders the current section's current item as a .spa-hero inside
  // #spa-hero-container — identical structure to normal SPA text heroes.
  function renderHero() {
    var heroContainer = document.getElementById('spa-hero-container');
    if (!heroContainer) return;
    heroContainer.innerHTML = '';

    var sec  = getCurrentSection();
    var item = getCurrentItem();
    if (!item) return;

    var canDo    = canDoCurrentItem();
    var dimClass = (sec.id !== 'understanding' && !canDo) ? ' asy-hero--dim' : '';

    var hero = document.createElement('div');
    hero.className = 'spa-hero spa-hero--text spa-hero--linkable' + dimClass;
    hero.setAttribute('role', 'button');
    hero.setAttribute('tabindex', '0');
    hero.setAttribute('aria-label', item.name);

    // Keyboard: Enter / Space activates the current item action
    hero.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        doCurrentItemAction();
      }
    });

    var heroText = document.createElement('div');
    heroText.className = 'spa-hero-text';
    heroText.textContent = getItemHeroText(sec, item);
    hero.appendChild(heroText);

    if (item.description) {
      var desc = document.createElement('div');
      desc.className = 'spa-hero-subtext';
      desc.textContent = item.description;
      hero.appendChild(desc);
    }

    heroContainer.appendChild(hero);
  }

  // Replaces #spa-dots with item dots for the current section.
  // Uses .spa-dot — identical to the main SPA item dots.
  function renderDots() {
    var dotsBar = document.getElementById('spa-dots');
    if (!dotsBar) return;
    dotsBar.innerHTML = '';

    var sec     = getCurrentSection();
    var items   = sec.items;
    var itemIdx = state.itemIndices[sec.id];

    if (items.length <= 1) return;

    items.forEach(function (item, idx) {
      var dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'spa-dot';
      dot.setAttribute('role', 'tab');
      dot.setAttribute('aria-label', item.name || '');
      dot.setAttribute('aria-selected', idx === itemIdx ? 'true' : 'false');
      wire(dot, (function (i) { return function () { navigateTo(state.sectionIdx, i); }; }(idx)));
      dotsBar.appendChild(dot);
    });
  }

  // ── HERO PROBE ───────────────────────────────────────────────────────────────

  // Builds an off-screen .spa-hero/.spa-hero-text element for a given game
  // section/item so main.js can rasterize it as a transition surface.
  // Mirrors createTextProbe() in main.js exactly.
  function buildGameHeroProbe(secIdx, itemIdx) {
    var sec  = GAME_SECTIONS[secIdx];
    var item = sec && sec.items[itemIdx];
    if (!sec || !item) return null;

    var heroContainer = document.getElementById('spa-hero-container');
    if (!heroContainer) return null;

    var probeHero = document.createElement('div');
    probeHero.className = 'spa-hero spa-hero--text';
    probeHero.setAttribute('data-probe', '1');
    probeHero.style.position = 'absolute';
    probeHero.style.pointerEvents = 'none';
    probeHero.style.margin = '0';
    probeHero.style.left = '-9999px';
    probeHero.style.top  = '-9999px';

    // Match width of the live hero so font wrapping is identical
    var liveHeroEl = heroContainer.querySelector('.spa-hero:not([data-probe])');
    if (liveHeroEl) {
      var liveRect = liveHeroEl.getBoundingClientRect();
      if (liveRect.width > 0) probeHero.style.width = liveRect.width + 'px';
    } else {
      probeHero.style.width = Math.max(220, Math.min(heroContainer.clientWidth || 320, 608)) + 'px';
    }

    var probeText = document.createElement('div');
    probeText.className = 'spa-hero-text';
    probeText.textContent = getItemHeroText(sec, item);

    probeHero.appendChild(probeText);
    heroContainer.appendChild(probeHero);

    return { element: probeHero, cleanup: function () { probeHero.remove(); } };
  }

  // ── NAVIGATION ─ (instant, no particle effect — used by dot/tab clicks) ──────

  // Immediate navigation (dot clicks, section-tab clicks).
  function navigateInDir(dir) {
    var target = (dir === 'next') ? getNextGameTarget() : getPrevGameTarget();
    navigateTo(target.sectionIdx, target.itemIdx);
  }

  // ── MOUNT ANIMATION ─ (entrance canvas: y=1/x graph with sequencing dots) ──

  function startMountAnimation(canvas) {
    var ctx       = canvas.getContext('2d');
    var DOT_N     = 22;
    var DOT_R     = 4.5;   // CSS px — solid dot radius
    var GLOW_R    = 11;    // CSS px — outer glow radius
    var CYCLE_MS  = 3500;
    var SEQ_MS    = 2200;  // time until all dots have lit up
    var HOLD_MS   = 2700;  // time at which fade-out begins
    var AR        = [94, 232, 125]; // accent #5ee87d components

    // Pre-compute dot curve positions: log-spaced x from 3.2 → 0.3 so dots
    // are denser near the y-axis asymptote (matching y=1/x curvature).
    var dots = [];
    for (var i = 0; i < DOT_N; i++) {
      var t  = i / (DOT_N - 1);
      var cx = Math.exp(Math.log(3.2) + (Math.log(0.3) - Math.log(3.2)) * t);
      dots.push({ cx: cx, cy: 1 / cx });
    }

    var startTime = null;

    function frame(now) {
      mountAnimFrameId = requestAnimationFrame(frame);
      if (!startTime) startTime = now;
      var elapsed = (now - startTime) % CYCLE_MS;

      var rect = canvas.getBoundingClientRect();
      var dpr  = window.devicePixelRatio || 1;
      var cssW = Math.round(rect.width);
      var cssH = Math.round(rect.height);
      if (cssW < 10 || cssH < 10) return;

      var physW = Math.round(cssW * dpr);
      var physH = Math.round(cssH * dpr);
      if (canvas.width !== physW || canvas.height !== physH) {
        canvas.width  = physW;
        canvas.height = physH;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      // Layout: plot area with padding
      var padL  = 46, padR  = 26, padT  = 26, padB  = 44;
      var plotW = cssW - padL - padR;
      var plotH = cssH - padT - padB;
      var RANGE = 3.5; // curve units shown on each axis
      var sx    = plotW / RANGE;
      var sy    = plotH / RANGE;

      function canX(cx) { return padL + cx * sx; }
      function canY(cy) { return (cssH - padB) - cy * sy; }

      // ── Axes ──
      ctx.strokeStyle = 'rgba(72, 72, 72, 0.9)';
      ctx.lineWidth   = 1.5;
      ctx.lineCap     = 'round';

      // Y-axis  (x=0 asymptote)
      ctx.beginPath();
      ctx.moveTo(padL, cssH - padB);
      ctx.lineTo(padL, padT);
      ctx.stroke();
      // Y-axis arrowhead
      ctx.beginPath();
      ctx.moveTo(padL - 4, padT + 9);
      ctx.lineTo(padL, padT + 1);
      ctx.lineTo(padL + 4, padT + 9);
      ctx.stroke();

      // X-axis  (y=0 asymptote)
      ctx.beginPath();
      ctx.moveTo(padL, cssH - padB);
      ctx.lineTo(cssW - padR, cssH - padB);
      ctx.stroke();
      // X-axis arrowhead
      ctx.beginPath();
      ctx.moveTo(cssW - padR - 9, cssH - padB - 4);
      ctx.lineTo(cssW - padR - 1, cssH - padB);
      ctx.lineTo(cssW - padR - 9, cssH - padB + 4);
      ctx.stroke();

      // Axis labels
      var labelSize = Math.max(10, Math.round(cssW * 0.03));
      ctx.fillStyle  = 'rgba(78, 78, 78, 0.9)';
      ctx.font       = labelSize + 'px sans-serif';
      ctx.textAlign  = 'center';
      ctx.fillText('x', cssW - padR + 3, cssH - padB + 13);
      ctx.textAlign  = 'left';
      ctx.fillText('y', padL + 5, padT + 5);

      // ── Sequencing dots ──
      var eFrac    = elapsed / CYCLE_MS;
      var seqFrac  = SEQ_MS  / CYCLE_MS;
      var holdFrac = HOLD_MS / CYCLE_MS;
      var slotFrac = seqFrac / (DOT_N - 1);

      for (var i = 0; i < DOT_N; i++) {
        var activateAt = (i / (DOT_N - 1)) * seqFrac;
        var opacity;
        if (eFrac < activateAt) {
          opacity = 0;
        } else if (eFrac < holdFrac) {
          var progress = (eFrac - activateAt) / Math.max(slotFrac * 0.55, 0.001);
          opacity = Math.min(1, progress);
        } else {
          opacity = Math.max(0, 1 - (eFrac - holdFrac) / (1 - holdFrac));
        }
        if (opacity <= 0.01) continue;

        var px = canX(dots[i].cx);
        var py = canY(dots[i].cy);
        if (py < -GLOW_R || py > cssH + GLOW_R || px < -GLOW_R || px > cssW + GLOW_R) continue;

        // Outer glow
        var grd = ctx.createRadialGradient(px, py, 0, px, py, GLOW_R);
        grd.addColorStop(0, 'rgba(' + AR[0] + ',' + AR[1] + ',' + AR[2] + ',' + (opacity * 0.7) + ')');
        grd.addColorStop(1, 'rgba(' + AR[0] + ',' + AR[1] + ',' + AR[2] + ',0)');
        ctx.beginPath();
        ctx.arc(px, py, GLOW_R, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        // Solid dot
        ctx.beginPath();
        ctx.arc(px, py, DOT_R, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + AR[0] + ',' + AR[1] + ',' + AR[2] + ',' + opacity + ')';
        ctx.fill();
      }
    }

    mountAnimFrameId = requestAnimationFrame(frame);
  }

  function stopMountAnimation() {
    if (mountAnimFrameId !== null) {
      cancelAnimationFrame(mountAnimFrameId);
      mountAnimFrameId = null;
    }
  }

  // ── PUBLIC API ───────────────────────────────────────────────────────────────

  // mount: called by the SPA when the user navigates to Games / Asymptote Engine.
  // Renders the "Asymptote Engine" text hero with the animated graph canvas behind it.
  // The user must tap it to enter the game; nothing starts automatically.
  function mount(containerEl) {
    stopMountAnimation();
    containerEl.innerHTML = '';

    var hero = document.createElement('div');
    hero.className = 'spa-hero';
    hero.style.position = 'relative';
    hero.setAttribute('tabindex', '0');
    hero.setAttribute('aria-label', 'Enter Asymptote Engine');

    // Keyboard entry
    hero.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (window.__SPA_Views && window.__SPA_Views.games) {
          window.__SPA_Views.games.onEnterGame();
        }
      }
    });

    // Canvas animation (behind the text)
    var canvas = document.createElement('canvas');
    canvas.style.position   = 'absolute';
    canvas.style.top        = '0';
    canvas.style.right      = '0';
    canvas.style.bottom     = '0';
    canvas.style.left       = '0';
    canvas.style.width      = '100%';
    canvas.style.height     = '100%';
    canvas.style.zIndex     = '0';
    canvas.style.pointerEvents = 'none';
    hero.appendChild(canvas);

    var heroText = document.createElement('div');
    heroText.className        = 'spa-hero-text';
    heroText.style.position   = 'relative';
    heroText.style.zIndex     = '1';
    heroText.textContent      = 'Asymptote Engine';
    hero.appendChild(heroText);

    containerEl.appendChild(hero);
    startMountAnimation(canvas);
  }

  // enterGame: called when the user taps the "Asymptote Engine" hero.
  // Replaces the SPA nav/hero/dots with game content and starts the loops.
  function enterGame() {
    stopMountAnimation();
    if (!state) state = createState();
    renderGameDOM();
    dirty = true;
    startTick();
    startRender();

    window.__SPA_GameNav = {
      // Read current game position
      getFromTarget: function () {
        var sec = getCurrentSection();
        return { sectionIdx: state.sectionIdx, itemIdx: state.itemIndices[sec.id] };
      },
      // Compute next/prev game target without changing state
      getToTarget: function (direction) {
        return direction === 'next' ? getNextGameTarget() : getPrevGameTarget();
      },
      // Build an off-screen hero probe for the given game item (for rasterization)
      buildHeroProbe: function (secIdx, itemIdx) {
        return buildGameHeroProbe(secIdx, itemIdx);
      },
      // Navigate game to a specific section/item and rebuild DOM
      commitTo: function (secIdx, itemIdx) {
        navigateTo(secIdx, itemIdx);
      },
      // Instant navigation (dot / section-tab clicks; no particle effect)
      navigateNext: function () { navigateInDir('next'); },
      navigatePrev: function () { navigateInDir('prev'); },
      // Action tap — activates current item
      onTap: doCurrentItemAction
    };
  }

  // stopGame: stops tick + render but keeps the DOM intact so the transition
  // engine can capture the current game hero as the particle "from" surface.
  // Called by gamesView.onDeactivate before goTo() kicks off the transition.
  function stopGame() {
    stopTick();
    stopRender();
    window.__SPA_GameNav = null;
  }

  // deactivate: called when the SPA has finished navigating away from
  // games/asymptote. The SPA restores spa-section-nav / dots / hero itself.
  function deactivate() {
    stopMountAnimation();
    stopGame();
  }

  window.AsymptoteApp = {
    mount:      mount,
    enterGame:  enterGame,
    stopGame:   stopGame,
    deactivate: deactivate
  };

}());
