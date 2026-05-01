// SPA About View
// Each about item is a full-screen panel with:
//   - A sticky header using the "important-word" fluctuating letter style
//   - A scrollable content body
// Vertical route-swipe is edge-gated (handled by gestures.js + routes.js metadata).

(function () {
  var ITEMS = {
    spotifyAnalytics: { label: 'spotify analytics'  },
    discography:      { label: 'discography'         },
    devHistory:       { label: 'development history' },
    journal:          { label: 'journal'             }
  };

  function mount(itemId, container) {
    var item = ITEMS[itemId];
    if (!item) return;

    container.innerHTML =
      '<div class="spa-poster-view spa-text-poster">' +
        '<div class="spa-text-poster-content">' +
          '<div class="spa-poster-label">' +
            '<span class="important-word">' + item.label + '</span>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  if (!window.__SPA_Views) window.__SPA_Views = {};
  window.__SPA_Views.about = {
    mount: mount
  };
}());
