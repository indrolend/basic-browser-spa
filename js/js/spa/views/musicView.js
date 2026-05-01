// SPA Music View — Spotify / Apple Music / Bandcamp / SoundCloud
// Canvas-poster items use particle-clusters.js; SoundCloud is a text-poster
// that opens the soundcloudArchiveMenu overlay.

(function () {
  var META = {
    spotify:    { label: 'spotify',     type: 'canvas', url: 'https://open.spotify.com/artist/59X3431NBfd6xWMc3Zlh0v', platform: 'spotify'    },
    appleMusic: { label: 'apple music', type: 'canvas', url: 'https://music.apple.com/us/artist/onliner/1663334902',   platform: 'applemusic' },
    bandcamp:   { label: 'bandcamp',    type: 'canvas', url: 'https://indrolend.bandcamp.com',                         platform: 'bandcamp'   },
    soundcloud: { label: 'soundcloud',  type: 'text',   overlay: 'soundcloudArchiveMenu' }
  };

  var SOUNDCLOUD_LINKS = [
    { label: '2024 Archive (Latest)', url: 'https://soundcloud.com/indrolend-783494030' },
    { label: '2024 Archive (Older)',  url: 'https://soundcloud.com/indrolend1' },
    { label: '2023 Archive',      url: 'https://soundcloud.com/indrolend' },
    { label: '2022 Archive',      url: 'https://soundcloud.com/indrolendarchive2022' }
  ];

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

    if (item.type === 'canvas') {
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

    } else {
      // Text poster for SoundCloud
      var textView = document.createElement('div');
      textView.className = 'spa-poster-view spa-text-poster';

      var textContent = document.createElement('div');
      textContent.className = 'spa-text-poster-content';

      var labelWrapText = document.createElement('div');
      labelWrapText.className = 'spa-poster-label';

      var btn = document.createElement('button');
      btn.className = 'spa-poster-link spa-soundcloud-btn';
      btn.type = 'button';

      var btnWord = document.createElement('span');
      btnWord.className = 'important-word';
      btnWord.textContent = item.label;
      btn.appendChild(btnWord);
      labelWrapText.appendChild(btn);

      var hint = document.createElement('p');
      hint.className = 'spa-poster-hint';
      hint.textContent = 'tap to browse archives';

      textContent.appendChild(labelWrapText);
      textContent.appendChild(hint);
      textView.appendChild(textContent);
      container.appendChild(textView);

      btn.addEventListener('click', function () {
        if (window.__SPA_Overlay) {
          window.__SPA_Overlay.open(item.overlay, {
            title: 'soundcloud',
            subtitle: 'Select an archive year',
            links: SOUNDCLOUD_LINKS
          });
        }
      });
    }
  }

  // Called after the view becomes visible — safe to read layout dimensions here.
  function onActivate(itemId) {
    var item = META[itemId];
    if (!item || item.type !== 'canvas') return;
    var cv = mountedCanvases[itemId];
    if (cv && window.__SPA_initParticleCluster) {
      window.__SPA_initParticleCluster(cv, item.platform);
    }
  }

  function getTransitionCanvas(itemId) {
    return mountedCanvases[itemId] || null;
  }

  if (!window.__SPA_Views) window.__SPA_Views = {};
  window.__SPA_Views.music = {
    mount:               mount,
    onActivate:          onActivate,
    getTransitionCanvas: getTransitionCanvas
  };
}());
