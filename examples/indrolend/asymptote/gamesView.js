// Asymptote item adapter. The item-scoped contract is canonical; the
// section-scoped __SPA_Views.games object below is a temporary compatibility
// bridge for main.js while the shell migrates to item adapters.
import { registerItemAdapter } from '../../../js/spa/itemAdapterRegistry.js';

(function () {
  const ITEM_KEY = 'games/asymptote';
  const CONTRACT_VERSION = 1;
  let gameActive = false;

  function mount(containerEl) {
    if (window.AsymptoteApp) {
      window.AsymptoteApp.mount(containerEl);
    } else {
      const hero = document.createElement('div');
      hero.className = 'spa-hero spa-hero--linkable';
      const heroText = document.createElement('div');
      heroText.className = 'spa-hero-text';
      heroText.textContent = 'Asymptote Engine';
      hero.appendChild(heroText);
      containerEl.appendChild(hero);
    }
  }

  function activate() {
    // Selecting the item does not enter the application. Application entry is a
    // separate lifecycle transition triggered by the item's primary action.
  }

  function exitApplication() {
    if (!gameActive) return;
    gameActive = false;
    if (window.__SPA_SetGameMode) window.__SPA_SetGameMode(false);
    if (window.AsymptoteApp) window.AsymptoteApp.deactivate();
  }

  function deactivate() {
    // Leaving the item must also stop an application that is still active.
    exitApplication();
  }

  function getPrimaryAction() {
    return {
      type: 'application',
      label: 'Enter Asymptote Engine'
    };
  }

  function enterApplication() {
    if (gameActive) return;
    gameActive = true;
    if (window.__SPA_SetGameMode) window.__SPA_SetGameMode(true);
    if (window.AsymptoteApp) window.AsymptoteApp.enterGame();
  }

  function buildEntryProbe(containerEl) {
    return (window.AsymptoteApp && window.AsymptoteApp.buildEntryGameHeroProbe)
      ? window.AsymptoteApp.buildEntryGameHeroProbe(containerEl)
      : null;
  }

  function buildHeroProbe(containerEl) {
    return (window.AsymptoteApp && window.AsymptoteApp.buildMountHeroProbe)
      ? window.AsymptoteApp.buildMountHeroProbe(containerEl)
      : null;
  }

  const itemAdapter = registerItemAdapter(ITEM_KEY, {
    contractVersion: CONTRACT_VERSION,
    mount,
    activate,
    deactivate,
    getPrimaryAction,
    enterApplication,
    exitApplication,
    buildEntryProbe,
    buildHeroProbe
  });

  // Legacy section-view compatibility. Keep this thin: every method only routes
  // the matching item into the item-scoped adapter above.
  function isAsymptote(itemId) {
    return itemId === 'asymptote';
  }

  if (!window.__SPA_Views) window.__SPA_Views = {};
  window.__SPA_Views.games = {
    mount(itemId, containerEl) {
      if (isAsymptote(itemId)) itemAdapter.mount(containerEl);
    },
    onActivate(itemId) {
      if (isAsymptote(itemId)) itemAdapter.activate();
    },
    onDeactivate(itemId) {
      if (isAsymptote(itemId)) itemAdapter.deactivate();
    },
    canEnterGame(itemId) {
      return isAsymptote(itemId) && itemAdapter.getPrimaryAction()?.type === 'application';
    },
    onEnterGame(itemId) {
      if (isAsymptote(itemId)) itemAdapter.enterApplication();
    },
    buildEntryGameHeroProbe(itemId, containerEl) {
      return isAsymptote(itemId) ? itemAdapter.buildEntryProbe(containerEl) : null;
    },
    buildHeroProbe(itemId, containerEl) {
      return isAsymptote(itemId) ? itemAdapter.buildHeroProbe(containerEl) : null;
    },
    onExitGame(itemId) {
      if (isAsymptote(itemId)) itemAdapter.exitApplication();
    }
  };
}());
