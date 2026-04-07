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

  function mount(itemId, container) {
    var item = META[itemId];
    if (!item) return;

    if (item.type === 'canvas') {
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

    } else {
      // Text poster for SoundCloud
      container.innerHTML =
        '<div class="spa-poster-view spa-text-poster">' +
          '<div class="spa-text-poster-content">' +
            '<div class="spa-poster-label">' +
              '<button class="spa-poster-link spa-soundcloud-btn">' +
                '<span class="important-word">' + item.label + '</span>' +
              '</button>' +
            '</div>' +
            '<p class="spa-poster-hint">tap to browse archives</p>' +
          '</div>' +
        '</div>';

      var btn = container.querySelector('.spa-soundcloud-btn');
      if (btn) {
        btn.type = 'button';
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
