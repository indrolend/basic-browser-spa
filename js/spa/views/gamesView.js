// SPA Games View — Asymptote engine adapter
// mount:        renders a placeholder in the hero container (for particle transition)
// onActivate:   launches the full-page game overlay; sets game mode (blocks SPA nav)
// onDeactivate: tears down overlay; clears game mode flag

(function () {
  function mount(itemId, containerEl) {
    if (itemId !== 'asymptote') return;
    if (window.AsymptoteApp) {
      window.AsymptoteApp.mount(containerEl);
    } else {
      containerEl.innerHTML =
        '<div class="asy-placeholder"><span class="asy-placeholder-text">ASYMPTOTE ENGINE</span></div>';
    }
  }

  function onActivate(itemId) {
    if (itemId !== 'asymptote') return;
    if (!window.AsymptoteApp) return;
    // Tell main.js to block slingshot + keyboard nav while game is running
    if (window.__SPA_SetGameMode) window.__SPA_SetGameMode(true);
    // Exit callback: navigate back to home/swarm
    function exitGame() {
      if (window.__SPA_GoHome) window.__SPA_GoHome();
    }
    window.AsymptoteApp.activate(exitGame);
  }

  function onDeactivate(itemId) {
    if (itemId !== 'asymptote') return;
    // Re-enable SPA navigation before overlay is torn down
    if (window.__SPA_SetGameMode) window.__SPA_SetGameMode(false);
    if (window.AsymptoteApp) window.AsymptoteApp.deactivate();
  }

  if (!window.__SPA_Views) window.__SPA_Views = {};
  window.__SPA_Views.games = {
    mount: mount,
    onActivate: onActivate,
    onDeactivate: onDeactivate
  };
}());
