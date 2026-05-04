// SPA Overlay Manager
// OS-like overlay modals. While an overlay is open, swipe navigation is disabled.
//
// Public API:
//   window.__SPA_Overlay.open(id, payload)
//   window.__SPA_Overlay.openInline(id, payload, host)
//   window.__SPA_Overlay.close()
//   window.__SPA_Overlay.isOpen()
//   window.__SPA_Overlay.buildProbe(id, payload, options)

(function () {
  var overlayRoot = null;
  var _isOpen = false;
  var _boundEscape = null;
  var _openedAtMs = 0;
  var _tapSuppressUntilMs = 0;
  var _activeMode = null;
  var _inlineHost = null;

  // Default SoundCloud archives; can be overridden per open() payload.
  var SOUNDCLOUD_ACCOUNTS = [
    { label: '2024 Archive (Latest)', url: 'https://soundcloud.com/indrolend-783494030' },
    { label: '2024 Archive (Older)',  url: 'https://soundcloud.com/indrolend1'           },
    { label: '2023 Archive',      url: 'https://soundcloud.com/indrolend'            },
    { label: '2022 Archive',      url: 'https://soundcloud.com/indrolendarchive2022' }
  ];

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeExternalUrl(value) {
    if (typeof value !== 'string') return null;

    try {
      var url = new URL(value, window.location.origin);
      return url.protocol === 'https:' ? url.href : null;
    } catch (_) {
      return null;
    }
  }

  var overlayBuilders = {
    soundcloudArchiveMenu: function (payload) {
      var data = payload || {};
      var title = escapeHtml(data.title || 'soundcloud');
      var subtitle = escapeHtml(data.subtitle || 'Select an archive year');
      var entries = Array.isArray(data.links) && data.links.length ? data.links : SOUNDCLOUD_ACCOUNTS;

      var linksHtml = entries.map(function (entry) {
        var safeUrl = normalizeExternalUrl(entry && entry.url);
        if (!safeUrl) return '';
        var label = escapeHtml((entry && entry.label) || safeUrl);
        return '<a class="spa-overlay-link" href="' + safeUrl + '" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">' +
               label +
               '</a>';
      }).join('');

      return '<div class="spa-overlay-title"><span class="important-word">' + title + '</span></div>' +
             '<p class="spa-overlay-subtitle">' + subtitle + '</p>' +
             '<div class="spa-overlay-links">' + linksHtml + '</div>' +
             '<button class="spa-overlay-close" id="spa-overlay-close-btn">\u2715 close</button>';
    }
  };

  function getRoot() {
    if (!overlayRoot) {
      overlayRoot = document.getElementById('spa-overlay-root');
      if (!overlayRoot) {
        overlayRoot = document.createElement('div');
        overlayRoot.id = 'spa-overlay-root';
        overlayRoot.setAttribute('role', 'dialog');
        overlayRoot.setAttribute('aria-modal', 'true');
        overlayRoot.setAttribute('aria-label', 'Overlay');
        document.body.appendChild(overlayRoot);
      }
    }
    return overlayRoot;
  }

  function createOverlayElement(id, payload, options) {
    var builder = overlayBuilders[id];
    if (!builder) return null;

    var opts = options || {};
    var overlay = document.createElement('div');
    overlay.className = 'spa-overlay' + (opts.inline ? ' spa-overlay--inline' : '');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', opts.inline ? 'false' : 'true');
    overlay.innerHTML = builder(payload);
    return overlay;
  }

  function bindOverlayControls(overlay) {
    var closeBtn = overlay.querySelector('#spa-overlay-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('pointerdown', function (e) {
        e.stopPropagation();
      });
      closeBtn.addEventListener('touchend', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof window.__SPA_CloseCurrentOverlayWithTransition === 'function') {
          window.__SPA_CloseCurrentOverlayWithTransition();
        } else {
          close();
        }
      }, { passive: false });
      closeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof window.__SPA_CloseCurrentOverlayWithTransition === 'function') {
          window.__SPA_CloseCurrentOverlayWithTransition();
        } else {
          close();
        }
      });
    }

    var linkEls = overlay.querySelectorAll('.spa-overlay-link');
    for (var i = 0; i < linkEls.length; i++) {
      linkEls[i].addEventListener('pointerdown', function (e) {
        e.stopPropagation();
      });
      linkEls[i].addEventListener('click', close);
    }

    _boundEscape = function (e) {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', _boundEscape);

    if (closeBtn) closeBtn.focus();

    if (window.__SPA_ImportantWords) {
      window.__SPA_ImportantWords.init(overlay);
    }
  }

  function buildProbe(id, payload, options) {
    var overlay = createOverlayElement(id, payload, options);
    if (!overlay) return null;

    overlay.setAttribute('data-probe', '1');
    overlay.style.position = 'absolute';
    overlay.style.left = '-9999px';
    overlay.style.top = '-9999px';
    overlay.style.margin = '0';
    overlay.style.pointerEvents = 'none';

    document.body.appendChild(overlay);
    return {
      element: overlay,
      cleanup: function () {
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }
    };
  }

  function open(id, payload) {
    var root = getRoot();
    if (!root) return;

    var overlay = createOverlayElement(id, payload);
    if (!overlay) return;

    close({ restore: false });
    _isOpen = true;
    _activeMode = 'modal';
    _inlineHost = null;
    _openedAtMs = Date.now();
    _tapSuppressUntilMs = _openedAtMs + 220;

    root.innerHTML = '';
    root.appendChild(overlay);
    root.style.display = 'block';

    // Close when clicking the backdrop (root), not the overlay panel itself
    root.addEventListener('click', onBackdropClick);
    bindOverlayControls(overlay);
  }

  function openInline(id, payload, host) {
    var hostEl = host || document.getElementById('spa-hero-container');
    if (!hostEl) return;

    var overlay = createOverlayElement(id, payload, { inline: true });
    if (!overlay) return;

    close({ restore: false });
    _isOpen = true;
    _activeMode = 'inline';
    _inlineHost = hostEl;
    _openedAtMs = Date.now();
    _tapSuppressUntilMs = _openedAtMs + 220;

    hostEl.innerHTML = '';
    hostEl.appendChild(overlay);
    bindOverlayControls(overlay);
  }

  function onBackdropClick(e) {
    // Ignore the synthetic click that can follow a tap/pointerup which opened
    // the overlay, otherwise the menu appears to instantly close.
    if (Date.now() - _openedAtMs < 220) return;
    if (e.target === getRoot()) {
      close();
    }
  }

  function close(options) {
    var root = getRoot();
    if (!root) return;

    var opts = options || {};
    var shouldRestoreInlineHero = opts.restore !== false;

    _isOpen = false;
    _tapSuppressUntilMs = Date.now() + 260;
    root.removeEventListener('click', onBackdropClick);
    if (_boundEscape) {
      document.removeEventListener('keydown', _boundEscape);
      _boundEscape = null;
    }
    root.style.display = 'none';
    root.innerHTML = '';

    if (_activeMode === 'inline') {
      if (shouldRestoreInlineHero && typeof window.__SPA_RestoreCurrentItemHero === 'function') {
        window.__SPA_RestoreCurrentItemHero();
      } else if (_inlineHost) {
        _inlineHost.innerHTML = '';
      }
    }

    _activeMode = null;
    _inlineHost = null;
  }

  function isOpen() {
    return _isOpen;
  }

  function shouldSuppressTap() {
    return Date.now() < _tapSuppressUntilMs;
  }

  window.__SPA_Overlay = {
    open: open,
    openInline: openInline,
    close: close,
    isOpen: isOpen,
    shouldSuppressTap: shouldSuppressTap,
    buildProbe: buildProbe
  };
}());
