# Copilot Instructions — Homedev SPA

## Project Overview

This is **Homedev SPA** — a personal link-in-bio style Single Page Application built
with **vanilla HTML, CSS, and JavaScript** (no framework, no build step, no package.json).
The developer is learning to code; code quality, clarity, and simplicity are the top
priorities over cleverness or performance micro-optimisations.

## Repository Layout

```
index.html                  — single entry point
main.js                     — SPA controller (navigation, state, hero rendering)
style.css                   — global dark-theme styles
js/
  spa/
    routes.js               — frozen route map (window.__INDROLEND_ROUTES__)
    router.js               — hash/popstate router
    overlayManager.js       — modal/overlay system
    rasterizeHero.js        — renders hero images & text to <canvas>
    transitionEngine.js     — simple particle fade transition (Phase 1)
    particleTransitionEngine.js — full pixel-sampled particle transition (Phase 2)
    slingshotGesture.js     — drag-to-navigate slingshot gesture
    gestures.js             — general touch/pointer gesture helpers
    typography/
      importantWords.js     — animated text highlight effect
    apps/
      asymptoteApp.js       — in-page Asymptote game engine
    engines/
      particle-clusters.js  — standalone particle cluster renderer
    views/
      homeView.js, socialView.js, musicView.js, gamesView.js, aboutView.js
  vendor/
    gifler.min.js           — GIF frame playback on <canvas>
gifs/                       — animated logo GIFs (spin effects)
```

## Architecture Principles

1. **No build tooling.** Every file is loaded via a plain `<script>` tag in `index.html`
   or via `<script type="module">` for `main.js`. Do not introduce bundlers, TypeScript,
   or npm dependencies.
2. **Global namespace pattern.** Non-module scripts expose their API on `window`
   (e.g. `window.__SPA_Transition`, `window.__INDROLEND_ROUTES__`).  `main.js` is the
   only ES-module file and it orchestrates everything.
3. **One source of truth for routes.** `js/spa/routes.js` is the canonical route map.
   Never duplicate section/item lists elsewhere; always read from
   `window.__INDROLEND_ROUTES__`.
4. **Separation of concerns.** Each file has one responsibility. Do not add unrelated
   logic to an existing file; create a new file instead.
5. **Avoid complexity drift.** The codebase has a history of becoming bloated.  Prefer
   the simplest solution that works.  Delete dead code when refactoring.
6. **Particle transitions are a core motif.** The particle-sampled canvas transition
   (`particleTransitionEngine.js`) is the signature visual effect of this SPA.  Keep
   it intact and use it consistently.

## Coding Style

- Vanilla JS (ES2020 features are fine; avoid bleeding-edge proposals).
- Prefer `const`/`let` over `var`.
- Use descriptive variable names; avoid single-letter names except in tight loops.
- Keep functions short and single-purpose.
- Comments should explain *why*, not *what*.
- Do not add `console.log` statements to production code; use the existing
  `spaDebug()` helper (gated by `?spa_debug=1`).

## Testing & Serving

- Serve the project with any static file server, e.g. `serve .` or `python3 -m http.server`.
- There is no automated test suite yet.  Manually verify navigation, transitions, and
  gesture behaviour in a browser after changes.

## Key Goals for Ongoing Development

- **Simplify `main.js`** — it has grown large; refactor cohesive chunks into their own
  files/modules when the opportunity arises.
- **Particle carousel integration** — the particle cluster engine (`engines/particle-clusters.js`)
  should be the primary visual source for the home-section hero transition.
- **Keep the `about` section** structure in `routes.js` even though it is hidden; it
  will be re-enabled once its views are refactored.
