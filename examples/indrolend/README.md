# Indrolend example

This preserves the previous personal catalog and optional Asymptote application without making either part of the neutral starter.

Serve the repository root, then open:

```text
http://127.0.0.1:8000/examples/indrolend/
```

The example entrypoint selects its catalog through the `spa-content` meta tag. It uses the same root runtime without modifying it.

The Games section currently lazy-loads Asymptote, links to the bundled offline Drift app at `/drift/`, and launches the separately deployed DATA browser game. `js/spa/sharedEconomy.js` provides the small cross-app contract: a versioned browser-local Signal ledger, idempotent award/spend transaction IDs, a live HUD event, and no server dependency. Discovering a catalog item awards one Signal once per browser profile; individual same-origin games may award additional Signal through `window.IndrolendEconomy`. DATA remains cross-origin until a deliberate `/data/` packaging strategy is selected, so it does not yet share this device-local ledger.
