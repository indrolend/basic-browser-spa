// SPA Social View — TikTok / Instagram / YouTube
// Each item renders a particle-cluster canvas poster + a clickable important-word label.

(function () {
  var META = {
    tiktok:    { label: 'tiktok',    url: 'https://www.tiktok.com/@indrolend',               platform: 'tiktok'    },
    instagram: { label: 'instagram', url: 'https://www.instagram.com/indrolend.us',           platform: 'instagram' },
    youtube:   { label: 'youtube',   url: 'https://www.youtube.com/@indrolend',               platform: 'youtube'   }
  };

  var mountedCanvases = {};

  function mount(itemId, container) {
    var item = META[itemId];
    if (!item) return;

    container.innerHTML =
      '<div class="spa-poster-view">' +
        '<div class="spa-poster-canvas-wrap">' +
          '<canvas data-particle-cluster="' + item.platform + '" class="spa-poster-canvas" aria-label="' + item.label + '"></canvas>' +
        '</div>' +
        '<div class="spa-poster-label">' +
          '<a class="spa-poster-link" href="' + item.url + '" target="_blank" rel="noopener">' +
            '<span class="important-word">' + item.label + '</span>' +
          '</a>' +
        '</div>' +
      '</div>';

    // Store canvas reference; particle cluster is initialised in onActivate
    // so the canvas has correct dimensions when the view is actually visible.
    var cv = container.querySelector('[data-particle-cluster]');
    if (cv) mountedCanvases[itemId] = cv;
  }

  // Called after the view becomes visible — safe to read layout dimensions here.
  function onActivate(itemId) {
    var item = META[itemId];
    if (!item) return;
    var cv = mountedCanvases[itemId];
    if (cv && window.__SPA_initParticleCluster) {
      window.__SPA_initParticleCluster(cv, item.platform);
    }
  }

  function getTransitionCanvas(itemId) {
    return mountedCanvases[itemId] || null;
  }

  if (!window.__SPA_Views) window.__SPA_Views = {};
  window.__SPA_Views.social = {
    mount:               mount,
    onActivate:          onActivate,
    getTransitionCanvas: getTransitionCanvas
  };
}());
