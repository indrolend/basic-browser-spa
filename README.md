# Basic Browser SPA

A small, static, browser-native single-page application template. The runtime lives in `main.js` and `js/spa/`; content is supplied by a replaceable content module selected from the entrypoint's `spa-content` meta tag.

The current root entrypoint preserves the Indrolend catalog as an example. Optional item adapters can add richer behavior without replacing the shell's navigation, hero, action, and transition semantics.

## Development

Serve the repository with any static HTTP server, then open the root page. No application backend is required.

Run the committed test suite with:

```sh
npm test
```

The SPA keeps content, optional item behavior, and the browser-native shell separate:

- content modules define sections, items, heroes, legacy click actions, and optional adapter declarations;
- item adapters register against a `section/item` key and declare a contract version;
- the shell resolves one primary action for the current item and owns pointer, keyboard, focus, and accessibility semantics;
- adapters may provide application enter/exit lifecycle and capturable hero probes;
- particle transitions operate on rasterized surfaces rather than product identities.

The repository also retains earlier experimental SPA modules under `js/spa/`. Treat `index.html`, `main.js`, the selected content module, and the modules imported by `main.js` as the production runtime authority.
