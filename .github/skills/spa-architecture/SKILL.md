---
name: spa-architecture
description: >-
  Use this skill when asked to refactor, simplify, extend, or debug the Homedev SPA.
  Trigger for prompts like "simplify main.js", "add a new section", "fix navigation",
  "the transition is broken", or "how does the SPA work". Provides the full mental model
  of the SPA's architecture, state machine, and module contracts.
---

# Homedev SPA — Architecture Skill

## Purpose

This skill gives you the full mental model of the Homedev SPA so you can make safe,
minimal changes without introducing regressions or complexity drift.

---

## Fundamental Constraint

**No build tooling. No framework. No npm.**  Every file is a plain browser script.
`main.js` is the single ES-module entry point; every other `js/spa/` file must be
a classic `<script>` that attaches its public API to `window`.

---

## Navigation Model

The SPA uses a **two-axis grid**:

- **Horizontal axis** — sections (Home → Social → Music → Games).
- **Vertical axis** — items within a section (e.g. TikTok / Instagram / YouTube inside Social).

State lives in `main.js` module-scope variables:

| Variable | Meaning |
|---|---|
| `currentSectionIdx` | Index into `SPA_SECTIONS[]` |
| `currentItemIdx` | Index into the current section's `items[]` |
| `isTransitioning` | Locks navigation while a particle transition is in flight |
| `queuedTarget` | Next `{sectionIdx, itemIdx}` buffered during a transition |
| `activeTarget` | The `{sectionIdx, itemIdx}` currently displayed |

**Navigation entry points**  
- `navigateTo(sectionIdx, itemIdx)` — primary programmatic navigation.
- Dot buttons in `#spa-dots` — click handlers call `navigateTo`.
- Slingshot gesture (`slingshotGesture.js`) — calls `navigateTo` on release.
- Keyboard left/right arrows — call `navigateTo`.

**Transition guard**  
Always respect `isTransitioning`.  Set it to `true` before starting a transition and
back to `false` (or flush `queuedTarget`) in the `onComplete` callback.

---

## Route Map

`js/spa/routes.js` exposes the **frozen** `window.__INDROLEND_ROUTES__` object.

```
{
  sectionOrder: ['home', 'social', 'music', 'games'],
  sections: { <sectionId>: { label, items: [itemId, …] } },
  items: { '<sectionId>/<itemId>': { label, transitionSource, scroll, clickAction } }
}
```

To add a new section or item:
1. Add an entry to `sectionOrder` / `sections` / `items` in `routes.js`.
2. Add the corresponding entry to the `SPA_SECTIONS` array in `main.js` (these two
   lists must stay in sync — a future refactor should unify them).
3. Create a view file in `js/spa/views/` if the item needs custom HTML.
4. Add a `<script>` tag in `index.html` before `main.js`.

---

## Hero Rendering Pipeline

Each item has a `hero` descriptor (`kind: 'text'|'image'` and `src`/`text`).

1. `main.js` calls `rasterizeHero(heroDescriptor)` → returns a `<canvas>`.
2. The canvas is displayed in `#spa-hero-container`.
3. On navigation, the **from-canvas** (current) and **to-canvas** (next) are passed to the
   transition engine.

`rasterizeHero.js` handles three hero kinds:
- `'text'` — renders text onto a canvas using a monospace font.
- `'image'` — draws a static image onto a canvas.
- `'gif'` — uses `gifler.min.js` to animate GIF frames onto a canvas.

---

## Particle Transition System

Two engines exist; `particleTransitionEngine.js` is the **production engine**:

```
window.__SPA_ParticleTransition.transition(fromCanvas, toCanvas, options, onComplete)
window.__SPA_ParticleTransition.transitionFromPull(pulledParticles, toRegion, ctx, options, onComplete)
```

**How it works**  
1. Sample pixel colours from `fromCanvas` at a 4 px grid → array of `{x, y, color}` particles.
2. Phase A (explode): animate particles flying outward (random velocity vectors).
3. Phase B (reassemble): animate particles flying toward their target positions on `toCanvas`.
4. Call `onComplete` when done; set `isTransitioning = false`.

**Slingshot pull preview**  
During a drag, `pullPreviewParticles` is updated every frame with a partial sample of the
destination canvas so the user sees a live particle preview under their finger.

**Do not duplicate** the transition logic.  Both `transitionEngine.js` (Phase 1 stub)
and `particleTransitionEngine.js` exist; prefer the latter for all new work.

---

## Overlay System

`overlayManager.js` exposes `window.__SPA_Overlay.show(config)` and `.hide()`.
Overlays render into `#spa-overlay-root`.  The `clickAction` field on a route item
can be `'overlay:<overlayName>'` to open an overlay instead of navigating to a URL.

---

## Refactoring Priorities

When simplifying `main.js`:
1. Extract gesture wiring (pointer/touch event listeners) into `gestures.js`.
2. Extract hero lifecycle (create, cache, destroy) into a `heroManager.js` module.
3. Extract dot/nav-button wiring into a `navUI.js` module.
4. Leave the state variables and `navigateTo` in `main.js` until the above is done.

**Do not** move things prematurely.  One cohesive chunk at a time.

---

## Common Pitfalls

- **Cross-origin canvas taint**: loading an image from a different origin onto a canvas
  will throw a SecurityError when `getImageData` is called.  Always ensure GIF/image
  sources are same-origin or served with correct CORS headers.
- **isTransitioning leak**: if `onComplete` is never called (animation cancelled midway),
  the SPA locks up.  Always guard with a timeout fallback.
- **Route sync drift**: `SPA_SECTIONS` in `main.js` and `window.__INDROLEND_ROUTES__`
  in `routes.js` list sections independently.  Edits must be made to both.
