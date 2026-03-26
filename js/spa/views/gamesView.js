// SPA Games View — Asymptote Engine placeholder

(function () {
  function mount(itemId, container) {
    if (itemId !== 'asymptote') return;

    container.innerHTML =
      '<div class="spa-poster-view spa-text-poster">' +
        '<div class="spa-text-poster-content">' +
          '<div class="spa-poster-label">' +
            '<a class="spa-poster-link" href="asymptote/index.html">' +
              '<span class="important-word">Asymptote engine</span>' +
            '</a>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  if (!window.__SPA_Views) window.__SPA_Views = {};
  window.__SPA_Views.games = {
    mount: mount
  };
}());
