# Template distillation status

The primary root application is a runnable baseline, not yet a finished generic template.

Observed baseline at `c14e8c6`:

- the root `index.html` loads over HTTP without browser console errors;
- Home, Social, Music, and Games navigation controls render;
- runtime JavaScript parses in its actual classic-script or ES-module mode;
- the primary entrypoint's local files exist;
- routes, labels, hero assets, and optional game behavior remain Indrolend-specific;
- `js/spa.html` belongs to an older parallel SPA layout and references paths relative to that historical layout.

Content now lives in `js/content.js` and is validated by the generic `defineContent()` contract in `js/spa/contentModel.js`. Another user can replace sections, items, labels, actions, and text/image heroes without editing `main.js`.

The example remains Indrolend-specific. Asymptote is now a content-declared optional adapter: its scripts are absent from initial HTML hydration and load only when navigation targets the configured item. A configured text/image hero remains available when an adapter cannot load.

The next distillation checkpoint should replace the default content/assets with neutral examples and move the Indrolend catalog plus Asymptote adapter into a separate example directory. Do not copy the broken aggregate from `basicbrowserslim/main`; evaluate later Slim behavior from its tested recovery branch one feature at a time.
