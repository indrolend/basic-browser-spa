// SPA Overlay Manager
// OS-like overlay modals. While an overlay is open, swipe navigation is disabled.
//
// Public API:
//   window.__SPA_Overlay.open(id, payload)
//   window.__SPA_Overlay.close()
//   window.__SPA_Overlay.isOpen()

(function () {
  var overlayRoot = null;
  var _isOpen = false;
  var _boundEscape = null;
  var _openedAtMs = 0;

  // Default SoundCloud archives; can be overridden per open() payload.
  var SOUNDCLOUD_ACCOUNTS = [
    { label: '2024 Archive (Latest)', url: 'https://soundcloud.com/indrolend-783494030' },
    { label: '2024 Archive (Older)',  url: 'https://soundcloud.com/indrolend1'           },
    { label: '2023 Archive',      url: 'https://soundcloud.com/indrolend'            },
    { label: '2022 Archive',      url: 'https://soundcloud.com/indrolendarchive2022' }
  ];

  var overlayBuilders = {
    soundcloudArchiveMenu: function (payload) {
      var data = payload || {};
      var title = data.title || 'soundcloud';
      var subtitle = data.subtitle || 'Select an archive year';
      var entries = Array.isArray(data.links) && data.links.length ? data.links : SOUNDCLOUD_ACCOUNTS;

      var linksHtml = entries.map(function (entry) {
        if (!entry || !entry.url) return '';
        var label = entry.label || entry.url;
        return '<a class="spa-overlay-link" href="' + entry.url + '" target="_blank" rel="noopener">' +
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

  function open(id, payload) {
    var root = getRoot();
    if (!root) return;

    var builder = overlayBuilders[id];
    if (!builder) return;

    close();
    _isOpen = true;
    _openedAtMs = Date.now();

    var overlay = document.createElement('div');
    overlay.className = 'spa-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    overlay.innerHTML = builder(payload);

    root.innerHTML = '';
    root.appendChild(overlay);
    root.style.display = 'block';

    // Close when clicking the backdrop (root), not the overlay panel itself
    root.addEventListener('click', onBackdropClick);

    var closeBtn = overlay.querySelector('#spa-overlay-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', close);
    }

    var linkEls = overlay.querySelectorAll('.spa-overlay-link');
    for (var i = 0; i < linkEls.length; i++) {
      linkEls[i].addEventListener('click', close);
    }

    _boundEscape = function (e) {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', _boundEscape);

    // Trap focus on close button for accessibility
    if (closeBtn) closeBtn.focus();

    // Kick off important-word animation inside overlay
    if (window.__SPA_ImportantWords) {
      window.__SPA_ImportantWords.init(overlay);
    }
  }

  function onBackdropClick(e) {
    // Ignore the synthetic click that can follow a tap/pointerup which opened
    // the overlay, otherwise the menu appears to instantly close.
    if (Date.now() - _openedAtMs < 220) return;
    if (e.target === getRoot()) {
      close();
    }
  }

  function close() {
    var root = getRoot();
    if (!root) return;
    _isOpen = false;
    root.removeEventListener('click', onBackdropClick);
    if (_boundEscape) {
      document.removeEventListener('keydown', _boundEscape);
      _boundEscape = null;
    }
    root.style.display = 'none';
    root.innerHTML = '';
  }

  function isOpen() {
    return _isOpen;
  }

  window.__SPA_Overlay = {
    open: open,
    close: close,
    isOpen: isOpen
  };
}());
