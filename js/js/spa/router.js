// SPA Hash Router
// Manages view mounting/caching, hash-based navigation, and the nav indicator UI.
//
// Public API: window.__SPA_Router
//   .init()
//   .go(sectionId, itemId)
//   .nextSection() / .prevSection()
//   .nextItem()    / .prevItem()
//   .getCurrentRoute() → { sectionId, itemId }

(function () {
  var routes = null;        // set during init from window.__INDROLEND_ROUTES__
  var viewHost = null;
  var mountedViews = {};    // "sectionId/itemId" → DOM element
  var currentSection = null;
  var currentItem    = null;
  var transitioning  = false;

  // ─── helpers ────────────────────────────────────────────────────────────────

  function getViewHost() {
    if (!viewHost) viewHost = document.getElementById('spa-view-host');
    return viewHost;
  }

  function parseHash(hash) {
    var parts = (hash || '').replace(/^#\/?/, '').split('/');
    return { sectionId: parts[0] || 'home', itemId: parts[1] || null };
  }

  function buildHash(sectionId, itemId) {
    return '#/' + sectionId + (itemId ? '/' + itemId : '');
  }

  function defaultItem(sectionId) {
    var s = routes.sections[sectionId];
    return s ? s.items[0] : null;
  }

  function viewKey(sectionId, itemId) {
    return sectionId + '/' + itemId;
  }

  // ─── view mounting ──────────────────────────────────────────────────────────

  function mountView(sectionId, itemId) {
    var key = viewKey(sectionId, itemId);
    if (mountedViews[key]) return mountedViews[key];

    var host = getViewHost();
    if (!host) return null;

    var el = document.createElement('div');
    el.className = 'spa-view';
    el.dataset.spaView = key;
    el.style.display = 'none';

    // Delegate to section view module if available
    if (window.__SPA_Views && window.__SPA_Views[sectionId]) {
      window.__SPA_Views[sectionId].mount(itemId, el);
    } else {
      var meta  = routes.items[key];
      var label = meta ? meta.label : key;
      var fallback = document.createElement('div');
      fallback.className = 'spa-view-fallback';
      var word = document.createElement('span');
      word.className = 'important-word';
      word.textContent = label;
      fallback.appendChild(word);
      el.appendChild(fallback);
    }

    host.appendChild(el);
    mountedViews[key] = el;

    // Run important-word initialisation for any text in the new view
    if (window.__SPA_ImportantWords) {
      window.__SPA_ImportantWords.init(el);
    }

    return el;
  }

  // ─── view display ───────────────────────────────────────────────────────────

  function showView(sectionId, itemId, skipTransition) {
    var key       = viewKey(sectionId, itemId);
    var view      = mountView(sectionId, itemId);
    if (!view) return;

    var fromSectionId = currentSection;
    var fromItemId    = currentItem;
    var fromKey       = fromSectionId && fromItemId ? viewKey(fromSectionId, fromItemId) : null;
    var fromView      = fromKey ? mountedViews[fromKey] : null;

    // Notify old view it is being deactivated (e.g. stop particle loops)
    if (fromSectionId && window.__SPA_Views && window.__SPA_Views[fromSectionId] &&
        typeof window.__SPA_Views[fromSectionId].onDeactivate === 'function') {
      window.__SPA_Views[fromSectionId].onDeactivate(fromItemId);
    }

    function doShow() {
      // Hide every mounted view
      var keys = Object.keys(mountedViews);
      for (var i = 0; i < keys.length; i++) {
        mountedViews[keys[i]].style.display = 'none';
        mountedViews[keys[i]].classList.remove('spa-view-active');
      }

      view.style.display = '';
      view.classList.add('spa-view-active');

      currentSection = sectionId;
      currentItem    = itemId;
      transitioning  = false;

      updateNav();

      // Notify new view it is now active (e.g. start particle loops)
      if (window.__SPA_Views && window.__SPA_Views[sectionId] &&
          typeof window.__SPA_Views[sectionId].onActivate === 'function') {
        window.__SPA_Views[sectionId].onActivate(itemId, view);
      }
    }

    // Run transition only when switching between two real views
    if (!skipTransition && fromView && window.__SPA_Transition) {
      transitioning = true;
      var fromCanvas = null;
      if (window.__SPA_Views && window.__SPA_Views[fromSectionId] &&
          typeof window.__SPA_Views[fromSectionId].getTransitionCanvas === 'function') {
        fromCanvas = window.__SPA_Views[fromSectionId].getTransitionCanvas(fromItemId);
      }
      window.__SPA_Transition.transition(fromCanvas, null, doShow);
    } else {
      doShow();
    }
  }

  // ─── navigation API ─────────────────────────────────────────────────────────

  function navigate(sectionId, itemId, skipTransition) {
    if (transitioning) return;
    if (!routes.sections[sectionId]) return;

    itemId = itemId || defaultItem(sectionId);
    var items = routes.sections[sectionId].items;
    if (items.indexOf(itemId) === -1) itemId = defaultItem(sectionId);

    var newHash = buildHash(sectionId, itemId);

    if (window.location.hash === newHash) {
      // Already here — just make sure it's shown (e.g. on first load)
      showView(sectionId, itemId, skipTransition);
      return;
    }

    // Updating the hash fires hashchange → handleHashChange → showView
    window.location.hash = newHash;
  }

  function go(sectionId, itemId) {
    navigate(sectionId, itemId);
  }

  function nextSection() {
    if (!currentSection) return;
    var idx = routes.sectionOrder.indexOf(currentSection);
    if (idx < routes.sectionOrder.length - 1) {
      go(routes.sectionOrder[idx + 1]);
    }
  }

  function prevSection() {
    if (!currentSection) return;
    var idx = routes.sectionOrder.indexOf(currentSection);
    if (idx > 0) {
      go(routes.sectionOrder[idx - 1]);
    }
  }

  function nextItem() {
    if (!currentSection || !currentItem) return;
    var items = routes.sections[currentSection].items;
    var idx = items.indexOf(currentItem);
    if (idx < items.length - 1) {
      go(currentSection, items[idx + 1]);
    }
  }

  function prevItem() {
    if (!currentSection || !currentItem) return;
    var items = routes.sections[currentSection].items;
    var idx = items.indexOf(currentItem);
    if (idx > 0) {
      go(currentSection, items[idx - 1]);
    }
  }

  function getCurrentRoute() {
    return { sectionId: currentSection, itemId: currentItem };
  }

  // ─── nav UI ─────────────────────────────────────────────────────────────────

  function updateNav() {
    updateSectionLinks();
    updateItemDots();
  }

  function updateSectionLinks() {
    var sectionsEl = document.getElementById('spa-nav-sections');
    if (!sectionsEl) return;

    // Build links on first call
    if (!sectionsEl.dataset.built) {
      sectionsEl.dataset.built = 'true';
      routes.sectionOrder.forEach(function (sid) {
        var a = document.createElement('a');
        a.className = 'spa-nav-section-link';
        a.textContent = routes.sections[sid].label;
        a.href = buildHash(sid, routes.sections[sid].items[0]);
        a.dataset.section = sid;
        sectionsEl.appendChild(a);
      });
    }

    sectionsEl.querySelectorAll('.spa-nav-section-link').forEach(function (a) {
      a.classList.toggle('active', a.dataset.section === currentSection);
    });
  }

  function updateItemDots() {
    var itemNavEl = document.getElementById('spa-item-nav');
    if (!itemNavEl || !currentSection) return;

    var items = routes.sections[currentSection].items;
    itemNavEl.innerHTML = '';

    items.forEach(function (iid) {
      var btn = document.createElement('button');
      btn.className = 'spa-item-dot' + (iid === currentItem ? ' active' : '');
      btn.dataset.section = currentSection;
      btn.dataset.item    = iid;
      var meta = routes.items[viewKey(currentSection, iid)];
      btn.title = meta ? meta.label : iid;
      btn.setAttribute('aria-label', meta ? meta.label : iid);
      btn.addEventListener('click', function () { go(currentSection, iid); });
      itemNavEl.appendChild(btn);
    });
  }

  // ─── hash change handler ────────────────────────────────────────────────────

  function handleHashChange() {
    if (transitioning) return;
    var parsed = parseHash(window.location.hash);
    var sid    = parsed.sectionId;
    var iid    = parsed.itemId;

    if (!routes.sections[sid]) { sid = 'home'; iid = null; }
    iid = iid || defaultItem(sid);

    if (sid === currentSection && iid === currentItem) return;
    showView(sid, iid);
  }

  // ─── init ───────────────────────────────────────────────────────────────────

  function init() {
    routes = window.__INDROLEND_ROUTES__;
    if (!routes) { console.error('SPA: routes not loaded'); return; }

    window.addEventListener('hashchange', handleHashChange);

    var hash = window.location.hash;
    if (!hash || hash === '#' || hash === '#/') {
      window.location.hash = '#/home/swarm';
    } else {
      handleHashChange();
    }
  }

  window.__SPA_Router = {
    init:            init,
    go:              go,
    nextSection:     nextSection,
    prevSection:     prevSection,
    nextItem:        nextItem,
    prevItem:        prevItem,
    getCurrentRoute: getCurrentRoute
  };

  // Self-initialize on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', function () {
    init();
  });
}());
