// Asymptote — SPA-mounted idle game engine
// Exposes window.AsymptoteApp = { mount, activate, deactivate }
// State is module-scoped so it survives mount/deactivate cycles.

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
    if (section === 'generators')     return GENERATORS;
    if (section === 'upgrades')       return UPGRADES;
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

  function navigateSection(dir) {
    var idx = SECTIONS.indexOf(state.nav.activeSection);
    state.nav.activeSection = SECTIONS[(idx + dir + SECTIONS.length) % SECTIONS.length];
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

  function startTick() {
    if (tickInterval !== null) return;
    lastTickTime = performance.now();
    tickInterval = setInterval(function () {
      var now = performance.now();
      var dt = (now - lastTickTime) / 1000;
      lastTickTime = now;
      state.resources.understanding += getProductionPerSecond() * dt;
      state.resources.ticks += TICKS_PER_SEC * dt;
      dirty = true;
    }, TICK_INTERVAL_MS);
  }

  function stopTick() {
    if (tickInterval !== null) {
      clearInterval(tickInterval);
      tickInterval = null;
      lastTickTime = null;
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

  // ── DOM REFS ─────────────────────────────────────────────────────────────────

  var rootEl = null;

  function q(sel) { return rootEl ? rootEl.querySelector(sel) : null; }
  function qa(sel) { return rootEl ? rootEl.querySelectorAll(sel) : []; }

  // ── VIEW RENDER ──────────────────────────────────────────────────────────────

  function renderView() {
    if (!rootEl || !state || !dirty) return;
    dirty = false;

    var section = state.nav.activeSection;
    var item = getActiveItem();
    var items = getItemsForSection(section);
    var activeIdx = state.nav.activeItemIndex[section];
    var canDo = canDoActiveItem();
    var pps = getProductionPerSecond();

    // Top bar
    setText('.asy-stat-u', fmt(state.resources.understanding));
    setText('.asy-stat-ps', fmt(pps) + '/s');
    setText('.asy-stat-t', fmt(state.resources.ticks) + ' t');

    // Section tabs
    qa('.asy-sec-tab').forEach(function (el) {
      el.classList.toggle('active', el.dataset.section === section);
    });

    // Item display
    if (item) {
      setText('.asy-item-name', getItemLabel(section, item));
      setText('.asy-item-desc', item.description);
    }

    // Item dots
    var dotsEl = q('.asy-item-dots');
    if (dotsEl) {
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

  function setText(sel, text) {
    var el = q(sel);
    if (el && el.textContent !== text) el.textContent = text;
  }

  // ── DOM BUILD ────────────────────────────────────────────────────────────────

  function buildDOM(containerEl) {
    containerEl.innerHTML = [
      '<div class="asymptote-app">',

      // Top bar
      '<div class="asy-top-bar">',
        '<span class="asy-stat"><span class="asy-label">⊙</span><span class="asy-stat-u">0</span></span>',
        '<span class="asy-stat"><span class="asy-label">rate</span><span class="asy-stat-ps">0/s</span></span>',
        '<span class="asy-stat"><span class="asy-label">t</span><span class="asy-stat-t">0 t</span></span>',
      '</div>',

      // Section nav
      '<div class="asy-section-bar">',
        '<button class="asy-sec-nav asy-prev-sec" aria-label="previous section">◀</button>',
        '<div class="asy-sec-tabs">',
          SECTIONS.map(function (s) {
            return '<button class="asy-sec-tab" data-section="' + s + '">' + SECTION_LABELS[s] + '</button>';
          }).join(''),
        '</div>',
        '<button class="asy-sec-nav asy-next-sec" aria-label="next section">▶</button>',
      '</div>',

      // Middle: item browser
      '<div class="asy-middle">',
        '<button class="asy-item-nav asy-prev-item" aria-label="previous item">▲</button>',
        '<div class="asy-item-content">',
          '<div class="asy-item-name"></div>',
          '<div class="asy-item-desc"></div>',
          '<div class="asy-item-dots"></div>',
          '<button class="asy-item-action">act</button>',
        '</div>',
        '<button class="asy-item-nav asy-next-item" aria-label="next item">▼</button>',
      '</div>',

      // Bottom bar
      '<div class="asy-bottom-bar">',
        '<button class="asy-click-btn">+1 UNDERSTANDING</button>',
      '</div>',

      '</div>'
    ].join('');

    rootEl = containerEl.querySelector('.asymptote-app');

    // Event wiring
    q('.asy-click-btn').addEventListener('click', clickUnderstanding);
    q('.asy-prev-sec').addEventListener('click', function () { navigateSection(-1); });
    q('.asy-next-sec').addEventListener('click', function () { navigateSection(1); });
    q('.asy-prev-item').addEventListener('click', function () { navigateItem(-1); });
    q('.asy-next-item').addEventListener('click', function () { navigateItem(1); });
    q('.asy-item-action').addEventListener('click', doActiveItemAction);

    qa('.asy-sec-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        state.nav.activeSection = tab.dataset.section;
        dirty = true;
      });
    });
  }

  // ── PUBLIC API ───────────────────────────────────────────────────────────────

  function mount(containerEl) {
    if (!state) state = createState();
    buildDOM(containerEl);
    dirty = true;
    renderView();
  }

  function activate() {
    dirty = true;
    startTick();
    startRender();
  }

  function deactivate() {
    stopTick();
    stopRender();
  }

  window.AsymptoteApp = { mount: mount, activate: activate, deactivate: deactivate };

}());
