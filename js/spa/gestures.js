// SPA Gesture System
// Unified touch/pointer handler for horizontal section swipes and
// vertical item swipes with edge-gating for scrollable panels.
//
// Respects overlay state: swipes are ignored while an overlay is open.
// Public API: window.__SPA_Gestures.init()

(function () {
  var SWIPE_THRESHOLD_PX = 50;   // minimum distance to register as a swipe
  var AXIS_LOCK_RATIO    = 1.5;  // |dx|/|dy| must exceed this to prefer horizontal

  var startX = 0;
  var startY = 0;
  var startScrollTop = 0;
  var active = false;

  // ─── helpers ────────────────────────────────────────────────────────────────

  function getActiveScrollBody() {
    var host = document.getElementById('spa-view-host');
    if (!host) return null;
    var activeView = host.querySelector('.spa-view-active');
    if (!activeView) return null;
    return activeView.querySelector('.spa-scroll-body');
  }

  function isAtScrollTop(el) {
    return !el || el.scrollTop <= 1;
  }

  function isAtScrollBottom(el) {
    if (!el) return true;
    return el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
  }

  function currentItemMeta() {
    var router = window.__SPA_Router;
    if (!router) return null;
    var route  = router.getCurrentRoute();
    var routes = window.__INDROLEND_ROUTES__;
    if (!routes || !route.sectionId || !route.itemId) return null;
    return routes.items[route.sectionId + '/' + route.itemId] || null;
  }

  // ─── touch handlers ─────────────────────────────────────────────────────────

  function onTouchStart(e) {
    if (e.touches.length !== 1) return;
    var t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    active = true;

    var scrollBody = getActiveScrollBody();
    startScrollTop = scrollBody ? scrollBody.scrollTop : 0;
  }

  function onTouchEnd(e) {
    if (!active) return;
    active = false;

    if (!e.changedTouches || e.changedTouches.length === 0) return;

    var t   = e.changedTouches[0];
    var dx  = t.clientX - startX;
    var dy  = t.clientY - startY;
    var adx = Math.abs(dx);
    var ady = Math.abs(dy);

    if (adx < SWIPE_THRESHOLD_PX && ady < SWIPE_THRESHOLD_PX) return;

    // Ignore swipes while overlay is open
    if (window.__SPA_Overlay && window.__SPA_Overlay.isOpen()) return;

    var router = window.__SPA_Router;
    if (!router) return;

    var meta        = currentItemMeta();
    var isScrollable  = meta && meta.scroll && meta.scroll.mode === 'vertical';
    var edgeGated     = meta && meta.scroll && meta.scroll.edgeGatedSwipe;

    if (adx > ady * AXIS_LOCK_RATIO) {
      // ── Horizontal swipe → change section ──────────────────────────────────
      if (dx < 0) {
        router.nextSection();   // swipe left  = go forward
      } else {
        router.prevSection();   // swipe right = go back
      }
    } else if (ady > adx * AXIS_LOCK_RATIO) {
      // ── Vertical swipe → change item (with optional edge-gating) ───────────
      var scrollBody = getActiveScrollBody();

      if (isScrollable && edgeGated) {
        // Only navigate when the scroll container is at an edge
        if (dy < 0) {
          // Swipe up (finger moves up) → next item, only at scroll bottom
          if (isAtScrollBottom(scrollBody)) {
            router.nextItem();
          }
        } else {
          // Swipe down (finger moves down) → prev item, only at scroll top
          if (isAtScrollTop(scrollBody)) {
            router.prevItem();
          }
        }
      } else if (!isScrollable) {
        // Non-scrollable view: vertical swipe always navigates
        if (dy < 0) {
          router.nextItem();
        } else {
          router.prevItem();
        }
      }
      // If scrollable but NOT edge-gated, let the browser handle natural scroll.
    }
  }

  function onTouchCancel() {
    active = false;
  }

  // ─── init ───────────────────────────────────────────────────────────────────

  function init() {
    document.addEventListener('touchstart',  onTouchStart,  { passive: true });
    document.addEventListener('touchend',    onTouchEnd);
    document.addEventListener('touchcancel', onTouchCancel, { passive: true });
  }

  window.__SPA_Gestures = {
    init: init
  };

  document.addEventListener('DOMContentLoaded', function () {
    init();
  });
}());
