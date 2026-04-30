// SPA Social View — TikTok / Instagram / YouTube
// Each item renders a particle-cluster canvas poster + a clickable important-word label.

(function () {
  var META = {
    tiktok:    { label: 'tiktok',    url: 'https://www.tiktok.com/@indrolend',               platform: 'tiktok'    },
    instagram: { label: 'instagram', url: 'https://www.instagram.com/indrolend.us',           platform: 'instagram' },
    youtube:   { label: 'youtube',   url: 'https://www.youtube.com/@indrolend',               platform: 'youtube'   }
  };

  var mountedCanvases = {};

  function getSafeExternalUrl(url) {
    if (typeof url !== 'string') return null;

    try {
      var parsed = new URL(url, window.location.origin);
      return parsed.protocol === 'https:' ? parsed.href : null;
    } catch (_) {
      return null;
    }
  }

  function mount(itemId, container) {
    var item = META[itemId];
    if (!item) return;

    container.textContent = '';

    var view = document.createElement('div');
    view.className = 'spa-poster-view';

    var canvasWrap = document.createElement('div');
    canvasWrap.className = 'spa-poster-canvas-wrap';

    var canvas = document.createElement('canvas');
    canvas.className = 'spa-poster-canvas';
    canvas.setAttribute('data-particle-cluster', item.platform);
    canvas.setAttribute('aria-label', item.label);
    canvasWrap.appendChild(canvas);

    var labelWrap = document.createElement('div');
    labelWrap.className = 'spa-poster-label';

    var link = document.createElement('a');
    link.className = 'spa-poster-link';
    var safeUrl = getSafeExternalUrl(item.url);
    link.href = safeUrl || '#';
    if (safeUrl) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.referrerPolicy = 'no-referrer';
    } else {
      link.addEventListener('click', function (e) {
        e.preventDefault();
      });
    }

    var word = document.createElement('span');
    word.className = 'important-word';
    word.textContent = item.label;
    link.appendChild(word);
    labelWrap.appendChild(link);

    view.appendChild(canvasWrap);
    view.appendChild(labelWrap);
    container.appendChild(view);

    // Store canvas reference; particle cluster is initialised in onActivate
    // so the canvas has correct dimensions when the view is actually visible.
    mountedCanvases[itemId] = canvas;
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
