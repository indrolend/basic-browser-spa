// SPA Games View — Asymptote engine adapter
// Delegates to window.AsymptoteApp for mount/lifecycle.

(function () {
  function mount(itemId, containerEl) {
    if (itemId !== 'asymptote') return;
    if (window.AsymptoteApp) {
      window.AsymptoteApp.mount(containerEl);
    } else {
      containerEl.innerHTML = '<div class="asy-load-msg">loading asymptote…</div>';
    }
  }

  function onActivate(itemId) {
    if (itemId !== 'asymptote') return;
    if (window.AsymptoteApp) window.AsymptoteApp.activate();
  }

  function onDeactivate(itemId) {
    if (itemId !== 'asymptote') return;
    if (window.AsymptoteApp) window.AsymptoteApp.deactivate();
  }

  if (!window.__SPA_Views) window.__SPA_Views = {};
  window.__SPA_Views.games = {
    mount: mount,
    onActivate: onActivate,
    onDeactivate: onDeactivate
  };
}());
