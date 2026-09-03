# Template distillation status

The primary root application is now a neutral runnable template baseline.

Observed baseline at `c14e8c6`:

- the root `index.html` loads over HTTP without browser console errors;
- neutral Start, Explore, and Finish navigation controls render;
- runtime JavaScript parses in its actual classic-script or ES-module mode;
- the primary entrypoint's local files exist;
- the previous Indrolend catalog, media, and optional game live under `examples/indrolend/`;
- `js/spa.html` belongs to an older parallel SPA layout and references paths relative to that historical layout.

Content now lives in `js/content.js` and is validated by the generic `defineContent()` contract in `js/spa/contentModel.js`. Another user can replace sections, items, labels, actions, and text/image heroes without editing `main.js`.

The default catalog contains only neutral text examples. The preserved Indrolend example demonstrates content-relative image assets and a lazy Asymptote adapter without contributing scripts or media to default startup.

The next distillation checkpoint should classify and remove the stale parallel `js/spa.html` implementation after verifying that its remaining views and gesture code contain no behavior absent from the tested root runtime. Do not copy the broken aggregate from `basicbrowserslim/main`; evaluate later Slim behavior from its tested recovery branch one feature at a time.
