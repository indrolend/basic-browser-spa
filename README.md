# Basic Browser SPA

A small static SPA template built around a section/item navigation grammar and text or image hero surfaces. It uses browser-native JavaScript modules and requires no build step or framework.

## Run

```sh
python -m http.server 8000
```

Open `http://127.0.0.1:8000/`. Serve it over HTTP; do not open `index.html` through `file://`.

## Adapt the template

Edit [`js/content.js`](js/content.js). Each section contains one or more items:

```js
{
  id: 'work',
  label: 'Work',
  items: [
    { id: 'hello', label: 'Hello', hero: { kind: 'text', text: 'Hello world' } },
    { id: 'image', label: 'Image', hero: { kind: 'image', src: './assets/example.png' } },
    { id: 'link', label: 'Link', hero: { kind: 'text', text: 'Visit' }, clickAction: 'https://example.com' }
  ]
}
```

The content contract rejects duplicate identities and malformed heroes before the application starts. Relative image and adapter paths resolve from the content module, so catalogs can live outside `js/`.

Runtime behavior belongs in `main.js` and `js/spa/`. A normal site adaptation should not require changes there.

## Optional adapters

An item can load an application only when navigation targets it:

```js
adapter: {
  id: 'my-app',
  modules: ['./my-app/runtime.js', './my-app/view.js']
}
```

Modules load in order and concurrent requests are deduplicated. The configured hero remains the fallback if loading fails.

The previous Indrolend catalog and Asymptote application are preserved under [`examples/indrolend`](examples/indrolend/README.md); they are not part of default startup.

## Test

```sh
npm test
```

The tests check script/module parsing, primary entrypoint dependencies, content validation, asset ownership, and optional adapter loading behavior.

## Repository boundary

This repository owns the SPA navigation and lifecycle template. Particle Carousel and other visual engines remain separate reusable modules and should be integrated through explicit adapters rather than copied into this runtime.
