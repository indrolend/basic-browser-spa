// Asymptote — SPA-mounted idle game engine
//
// Exposes window.AsymptoteApp = { mount, activate, deactivate }
//
// When activated the game renders as a full-page overlay (z-index > SPA nav)
// so it fully owns the screen and pointer events — no slingshot bleed-through.
// State is module-scoped and persists across deactivate/activate cycles.

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
      canDo: function (s) { return s.resources.understanding >= 50 || s.resources.ticks >= 100; },
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

  var SECTIONS = ['generators', 'upgrades', 'sacrificeActions'];
  var SECTION_LABELS = { generators: 'gen', upgrades: 'upg', sacrificeActions: 'sacrifice' };
  var TICKS_PER_SEC = 10;
  var TICK_INTERVAL_MS = 100;

  // ── STATE ────────────────────────────────────────────────────────────────────

  var state = null;

  function createState() {
    var s = {
      resources: { understanding: 0, ticks: 0 },
      nav: {
        activeSection: 'generators',
        activeItemIndex: { generators: 0, upgrades: 0, sacrificeActions: 0 }
      },
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

  function getItemsForSection(section) {
    if (section === 'generators')       return GENERATORS;
    if (section === 'upgrades')         return UPGRADES;
    if (section === 'sacrificeActions') return SACRIFICE_ACTIONS;
    return [];
  }

  function getActiveItem() {
    var section = state.nav.activeSection;
    var items = getItemsForSection(section);
    return items[state.nav.activeItemIndex[section]] || null;
  }

  function getGeneratorCost(genId) {
    var def = null;
    for (var i = 0; i < GENERATORS.length; i++) {
      if (GENERATORS[i].id === genId) { def = GENERATORS[i]; break; }
    }
    var count = state.generators[genId].count;
    return Math.floor(def.baseCost * Math.pow(def.costMultiplier, count));
  }

  function getProductionPerSecond() {
    var total = 0;
    for (var i = 0; i < GENERATORS.length; i++) {
      var def = GENERATORS[i];
      total += state.generators[def.id].count * def.baseProduction;
    }
    return total * state.productionMultiplier;
  }

  function canDoActiveItem() {
    var section = state.nav.activeSection;
    var item = getActiveItem();
    if (!item) return false;
    if (section === 'generators') {
      return state.resources.understanding >= getGeneratorCost(item.id);
    }
    if (section === 'upgrades') {
      var data = state.upgrades[item.id];
      if (data.purchased) return false;
      if (state.resources.understanding < item.cost) return false;
      if (item.requires && !state.upgrades[item.requires].purchased) return false;
      return true;
    }
    if (section === 'sacrificeActions') {
      return item.canDo(state);
    }
    return false;
  }

  function doActiveItemAction() {
    var section = state.nav.activeSection;
    var item = getActiveItem();
    if (!item) return;

    if (section === 'generators') {
      var cost = getGeneratorCost(item.id);
      if (state.resources.understanding < cost) return;
      state.resources.understanding -= cost;
      state.generators[item.id].count++;
    } else if (section === 'upgrades') {
      if (!canDoActiveItem()) return;
      state.resources.understanding -= item.cost;
      state.upgrades[item.id].purchased = true;
      item.apply(state);
    } else if (section === 'sacrificeActions') {
      if (item.canDo(state)) item.execute(state);
    }

    dirty = true;
  }

  function clickUnderstanding() {
    state.resources.understanding += state.clickPower;
    dirty = true;
  }

  function navigateItem(dir) {
    var section = state.nav.activeSection;
    var items = getItemsForSection(section);
    var idx = state.nav.activeItemIndex[section];
    state.nav.activeItemIndex[section] = (idx + dir + items.length) % items.length;
    dirty = true;
  }

  // ── TICK LOOP ────────────────────────────────────────────────────────────────

  var tickInterval = null;
  var lastTickTime = null;
  var tickPaused = false;

  function startTick() {
    if (tickInterval !== null) return;
    lastTickTime = performance.now();
    tickPaused = false;
    tickInterval = setInterval(function () {
      if (tickPaused) return;
      var now = performance.now();
      // Cap dt at 1 second to prevent runaway accumulation
      var dt = Math.min((now - lastTickTime) / 1000, 1);
      lastTickTime = now;
      state.resources.understanding += getProductionPerSecond() * dt;
      state.resources.ticks += TICKS_PER_SEC * dt;
      dirty = true;
    }, TICK_INTERVAL_MS);

    // Pause tick while the tab is hidden so returning to the tab
    // doesn't burst multiple seconds of accumulated time.
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
      // Resume: reset lastTickTime so we don't charge for hidden time
      lastTickTime = performance.now();
      tickPaused = false;
    }
  }

  // ── RENDER LOOP ──────────────────────────────────────────────────────────────

  var renderFrameId = null;
  var dirty = false;

  function startRender() {
    if (renderFrameId !== null) return;
    (function loop() {
      renderView();
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

  function getItemLabel(section, item) {
    if (section === 'generators') {
      var count = state.generators[item.id].count;
      var cost = getGeneratorCost(item.id);
      return item.name + ' [' + count + '] — ' + fmt(cost) + ' ⊙';
    }
    if (section === 'upgrades') {
      if (state.upgrades[item.id].purchased) return item.name + ' ✓';
      return item.name + ' — ' + fmt(item.cost) + ' ⊙';
    }
    return item.name;
  }

  // ── DOM HELPERS ──────────────────────────────────────────────────────────────

  // Same touchend+onclick pattern used by the rest of the SPA (addActivationHandler).
  // touchend fires immediately on mobile (no 300ms delay); preventDefault blocks the
  // synthetic click so the handler never double-fires.
  function wire(el, handler) {
    el.addEventListener('touchend', function (e) { e.preventDefault(); handler(); });
    el.onclick = handler;
  }

  var overlayEl    = null;  // the full-page game overlay (<div class="asy-overlay">)
  var rootEl       = null;  // .asymptote-app inside the overlay
  var lastDotsKey  = null;  // tracks last rendered dots to avoid churn

  function q(sel)  { return rootEl ? rootEl.querySelector(sel)    : null; }
  function qa(sel) { return rootEl ? rootEl.querySelectorAll(sel) : []; }

  function setText(sel, text) {
    var el = q(sel);
    if (el && el.textContent !== text) el.textContent = text;
  }

  // ── VIEW RENDER ──────────────────────────────────────────────────────────────

  function renderView() {
    if (!rootEl || !state || !dirty) return;
    dirty = false;

    var section  = state.nav.activeSection;
    var item     = getActiveItem();
    var items    = getItemsForSection(section);
    var activeIdx = state.nav.activeItemIndex[section];
    var canDo    = canDoActiveItem();
    var pps      = getProductionPerSecond();

    // Stats row
    setText('.asy-stat-u',  fmt(state.resources.understanding));
    setText('.asy-stat-ps', fmt(pps) + '/s');
    setText('.asy-stat-t',  fmt(state.resources.ticks));

    // Section tabs
    qa('.asy-sec-tab').forEach(function (el) {
      el.classList.toggle('active', el.dataset.section === section);
    });

    // Item display
    if (item) {
      setText('.asy-item-name', getItemLabel(section, item));
      setText('.asy-item-desc', item.description);
    }

    // Item dots — only rebuild when section or active index changes
    var dotsKey = section + ':' + activeIdx + ':' + items.length;
    var dotsEl = q('.asy-item-dots');
    if (dotsEl && dotsKey !== lastDotsKey) {
      lastDotsKey = dotsKey;
      dotsEl.innerHTML = items.map(function (_, i) {
        return '<span class="asy-dot' + (i === activeIdx ? ' active' : '') + '"></span>';
      }).join('');
    }

    // Action button
    var actBtn = q('.asy-item-action');
    if (actBtn) {
      actBtn.disabled = !canDo;
      actBtn.classList.toggle('can-do', canDo);
    }
  }

  // ── OVERLAY BUILD ────────────────────────────────────────────────────────────

  function buildOverlay(onExit) {
    if (overlayEl) { overlayEl.remove(); overlayEl = null; }

    overlayEl = document.createElement('div');
    overlayEl.className = 'asy-overlay';

    overlayEl.innerHTML = [
      '<div class="asymptote-app">',

      // ── Top bar: stats + exit ──────────────────────────────────────────────
      '<div class="asy-top-bar">',
        '<div class="asy-stats">',
          '<span class="asy-stat"><span class="asy-label">⊙</span>',
            '<span class="asy-stat-u">0.0</span></span>',
          '<span class="asy-stat"><span class="asy-label">rate</span>',
            '<span class="asy-stat-ps">0.0/s</span></span>',
          '<span class="asy-stat"><span class="asy-label">t</span>',
            '<span class="asy-stat-t">0.0</span></span>',
        '</div>',
        '<button class="asy-exit-btn" type="button" aria-label="exit game">✕</button>',
      '</div>',

      // ── Section tabs ───────────────────────────────────────────────────────
      '<div class="asy-section-bar">',
        SECTIONS.map(function (s) {
          return '<button class="asy-sec-tab" type="button" data-section="' +
            s + '">' + SECTION_LABELS[s] + '</button>';
        }).join(''),
      '</div>',

      // ── Hero: +1 understanding button ──────────────────────────────────────
      '<div class="asy-hero-area">',
        '<button class="asy-click-btn" type="button">+1 UNDERSTANDING</button>',
      '</div>',

      // ── Item browser ───────────────────────────────────────────────────────
      '<div class="asy-item-browser">',
        '<div class="asy-item-row">',
          '<button class="asy-prev-item" type="button" aria-label="previous item">◀</button>',
          '<div class="asy-item-content">',
            '<div class="asy-item-name"></div>',
            '<div class="asy-item-desc"></div>',
          '</div>',
          '<button class="asy-next-item" type="button" aria-label="next item">▶</button>',
        '</div>',
        '<button class="asy-item-action" type="button">act</button>',
        '<div class="asy-item-dots"></div>',
      '</div>',

      '</div>'
    ].join('');

    rootEl = overlayEl.querySelector('.asymptote-app');

    // Wire all interactive elements with touchend+onclick for instant response
    wire(q('.asy-exit-btn'),   function () { onExit(); });
    wire(q('.asy-click-btn'),  clickUnderstanding);
    wire(q('.asy-prev-item'),  function () { navigateItem(-1); });
    wire(q('.asy-next-item'),  function () { navigateItem(1); });
    wire(q('.asy-item-action'), doActiveItemAction);

    qa('.asy-sec-tab').forEach(function (tab) {
      wire(tab, function () {
        state.nav.activeSection = tab.dataset.section;
        dirty = true;
      });
    });

    document.body.appendChild(overlayEl);
  }

  // ── PUBLIC API ───────────────────────────────────────────────────────────────

  // mount: render a minimal placeholder in the SPA hero container so the
  // particle transition has something to animate to/from.
  function mount(containerEl) {
    containerEl.innerHTML =
      '<div class="asy-placeholder">' +
        '<span class="asy-placeholder-text">ASYMPTOTE ENGINE</span>' +
      '</div>';
  }

  // activate: build the full-page overlay, start tick + render loops.
  // onExit() is called when the user taps the ✕ button.
  function activate(onExit) {
    if (!state) state = createState();
    buildOverlay(onExit);
    dirty = true;
    renderView();
    startTick();
    startRender();
  }

  // deactivate: remove the overlay, stop loops.
  // Called by gamesView when the SPA navigates away from games/asymptote.
  function deactivate() {
    stopTick();
    stopRender();
    if (overlayEl) {
      overlayEl.remove();
      overlayEl  = null;
      rootEl     = null;
      lastDotsKey = null;
    }
  }

  window.AsymptoteApp = { mount: mount, activate: activate, deactivate: deactivate };

}());
