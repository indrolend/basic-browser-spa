// SPA Games View — Asymptote engine adapter
//
// mount:        renders a tappable "Asymptote Engine" hero in the hero container;
//               user must tap it to enter the game (no auto-start).
// onActivate:   idempotent — does nothing when game is already running.
// onDeactivate: stops the game tick/render loops; SPA restores DOM itself.
// onEnterGame:  entry point called by main.js onSlingshotTap when on asymptote item.

(function () {
  var gameActive = false;

  function mount(itemId, containerEl) {
    if (itemId !== 'asymptote') return;
    if (window.AsymptoteApp) {
      window.AsymptoteApp.mount(containerEl);
    } else {
      // Fallback if script not yet loaded
      var hero = document.createElement('div');
      hero.className = 'spa-hero spa-hero--linkable';
      var heroText = document.createElement('div');
      heroText.className = 'spa-hero-text';
      heroText.textContent = 'Asymptote Engine';
      hero.appendChild(heroText);
      containerEl.appendChild(hero);
    }
  }

  function onActivate(itemId) {
    if (itemId !== 'asymptote') return;
    // If game is already running (e.g. after a cancelled slingshot), do nothing.
    // The game manages its own state; we should not re-enter or reset it.
    if (gameActive) return;
    // Hero is the tappable entry screen rendered by mount().
    // Actual game entry waits for the user's tap → onEnterGame().
  }

  function onDeactivate(itemId) {
    if (itemId !== 'asymptote') return;
    if (!gameActive) return;
    gameActive = false;
    // Unblock SPA navigation so goTo() can complete the transition.
    if (window.__SPA_SetGameMode) window.__SPA_SetGameMode(false);
    // Stop game logic but keep the hero DOM intact so the particle transition
    // engine can capture it as the "from" surface before clearing it.
    if (window.AsymptoteApp) window.AsymptoteApp.deactivate();
  }

  function onEnterGame() {
    if (gameActive) return;
    gameActive = true;
    if (window.__SPA_SetGameMode) window.__SPA_SetGameMode(true);
    if (window.AsymptoteApp) window.AsymptoteApp.enterGame();
  }

  // buildHeroProbe: returns a { element, cleanup } probe that carries the
  // mount-animation canvas so particle transitions show the animated surface.
  function buildHeroProbe(itemId, containerEl) {
    if (itemId !== 'asymptote') return null;
    return (window.AsymptoteApp && window.AsymptoteApp.buildMountHeroProbe)
      ? window.AsymptoteApp.buildMountHeroProbe(containerEl)
      : null;
  }

  if (!window.__SPA_Views) window.__SPA_Views = {};
  window.__SPA_Views.games = {
    mount:          mount,
    onActivate:     onActivate,
    onDeactivate:   onDeactivate,
    onEnterGame:    onEnterGame,
    buildHeroProbe: buildHeroProbe
  };
}());
