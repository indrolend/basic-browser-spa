---
name: particle-system
description: >-
  Use this skill when working on any aspect of the particle transition effect, the
  particle cluster engine, slingshot gesture physics, or the canvas rendering pipeline.
  Trigger for prompts like "fix the particle transition", "improve the slingshot",
  "add a new transition effect", "particles look wrong", or "integrate the particle
  carousel into the home screen".
---

# Particle System — Architecture Skill

## Files in This System

| File | Role |
|---|---|
| `js/spa/particleTransitionEngine.js` | **Primary** transition engine — pixel-sampled particles |
| `js/spa/transitionEngine.js` | Legacy Phase-1 stub — simple fade; keep for reference but don't extend |
| `js/spa/engines/particle-clusters.js` | Standalone cluster renderer — intended for the Home hero |
| `js/spa/rasterizeHero.js` | Converts hero descriptors → `<canvas>` surfaces for the transition engine |
| `js/spa/slingshotGesture.js` | Drag gesture that feeds a live particle preview to the transition engine |
| `js/vendor/gifler.min.js` | Vendor library — renders animated GIF frames onto a `<canvas>` |

---

## `particleTransitionEngine.js` — Public API

```js
// Transition between two rasterized hero canvases
window.__SPA_ParticleTransition.transition(fromCanvas, toCanvas, options, onComplete)

// Continue a transition from an in-progress slingshot pull
window.__SPA_ParticleTransition.transitionFromPull(pulledParticles, toRegion, ctx, options, onComplete)
```

### `options` fields

| Field | Type | Default | Description |
|---|---|---|---|
| `duration` | `number` | `480` | Total animation time in ms |
| `particleSize` | `number` | `4` | Grid step for pixel sampling (px) |
| `explodeSpeed` | `number` | auto | Max velocity during explode phase |

### Lifecycle

```
sampleParticles(fromCanvas)
  → explode phase  (particles fly outward; canvas fades to black)
  → reassemble phase (particles converge to toCanvas pixel positions)
  → onComplete()
```

---

## `particle-clusters.js` — Cluster Renderer

The cluster engine renders an autonomous particle animation onto a `<canvas>` element.
It is designed to be the **live hero surface** for the Home section (`home/swarm` item).

### Integration Pattern (Home Section)

```js
// In main.js or homeView.js:
const clusterCanvas = document.createElement('canvas');
clusterCanvas.width  = heroContainer.offsetWidth;
clusterCanvas.height = heroContainer.offsetHeight;
heroContainer.appendChild(clusterCanvas);
window.__SPA_ParticleClusters.start(clusterCanvas);

// When navigating away, stop the animation loop and use clusterCanvas
// as the `fromCanvas` for the transition:
window.__SPA_ParticleClusters.stop();
navigateTo(targetSectionIdx, targetItemIdx, clusterCanvas);
```

This is the intended end state; the current `home/swarm` item still uses a text hero.

---

## Slingshot Gesture — How the Pull Preview Works

1. `slingshotGesture.js` fires `onPullStart(targetSectionIdx, targetItemIdx)`.
2. `main.js` begins rasterizing the **destination** hero (`pullToSurfacePromise`).
3. Once the destination canvas is ready, every animation frame:
   - Sample `PULL_PREVIEW_PARTICLE_COUNT` pixels from the destination canvas.
   - Store in `pullPreviewParticles` (module-scope).
   - Render the preview particles at a position offset by the drag distance.
4. On release, `slingshotGesture.js` fires `onPullRelease(velocity)`.
5. `main.js` calls `transitionFromPull(pullPreviewParticles, toRegion, ctx, …)`.

**Important**: `pullPreviewParticlesBase` is sampled **once** when Phase B of the pull
begins (after the destination canvas is ready).  `pullPreviewParticles` is the
per-frame subset used for rendering.  Never re-sample on every frame — it is expensive.

---

## Canvas Taint & CORS

All hero images and GIFs must be **same-origin** or served with `Access-Control-Allow-Origin: *`.
If `getImageData` throws a `SecurityError`:

1. Check the `src` URL — it must not be a cross-origin resource without CORS headers.
2. For development, serve the project with `serve .` (or any CORS-permissive local server)
   rather than opening `index.html` directly from the filesystem.

---

## Adding a New Transition Effect

1. Add a new exported function to `particleTransitionEngine.js` following the same
   signature as `transition(fromCanvas, toCanvas, options, onComplete)`.
2. Expose it on `window.__SPA_ParticleTransition.<effectName>`.
3. Wire it in `main.js` by selecting the effect based on the route item's
   `transitionSource` field (already stored in `window.__INDROLEND_ROUTES__.items`).

Effect ideas that fit the existing motif:
- **Vortex** — particles spiral inward/outward around screen centre.
- **Rain** — particles fall down and pile up before reassembling.
- **Swarm** — particles follow an organic boid-like path between positions.

---

## Performance Guidelines

- Keep `PARTICLE_SIZE` at `4` or larger; sampling every pixel is too slow on mobile.
- Use `requestAnimationFrame`; never `setInterval` for animation loops.
- Cancel in-flight `requestAnimationFrame` handles when navigation is cancelled or
  superseded (store the handle in a module-scoped variable and call `cancelAnimationFrame`).
- Avoid allocating new arrays inside the animation loop; mutate pre-allocated buffers.

---

## Debugging Tips

- Append `?spa_debug=1` to the URL to enable `spaDebug()` console output throughout
  the codebase.
- To inspect the particle canvas mid-transition: open DevTools, find `#transition-canvas`,
  and temporarily set `display: block` in the Styles panel.
- If the SPA is stuck (no navigation possible), check `isTransitioning` in the console:
  `window.__isTransitioning` — if `true`, an `onComplete` callback was never fired.
  Run `window.__SPA_resetTransitionLock?.()` if that helper exists, or reload the page.
