const test = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

const root = resolve(__dirname, '..');
const moduleUrl = pathToFileURL(resolve(root, 'js/spa/primaryAction.js')).href;

test('primary action prefers adapter application capability over clickAction', async () => {
  const { resolvePrimaryAction } = await import(moduleUrl);
  const action = resolvePrimaryAction({
    item: { clickAction: '/fallback/' },
    adapter: { getPrimaryAction: () => ({ type: 'application', label: 'Enter Demo' }) },
    baseUrl: 'https://example.test/content.js'
  });

  assert.deepEqual(action, { type: 'application', label: 'Enter Demo' });
});

test('primary action normalizes links and overlays from legacy clickAction', async () => {
  const { resolvePrimaryAction } = await import(`${moduleUrl}?legacy-actions`);

  assert.deepEqual(resolvePrimaryAction({
    item: { clickAction: '/drift/' },
    baseUrl: 'https://example.test/examples/content.js'
  }), {
    type: 'link',
    href: 'https://example.test/drift/',
    external: false
  });

  assert.deepEqual(resolvePrimaryAction({
    item: { clickAction: 'overlay:soundcloudArchiveMenu' },
    baseUrl: 'https://example.test/examples/content.js'
  }), {
    type: 'overlay',
    overlayId: 'soundcloudArchiveMenu'
  });
});

test('primary action presentation is the single semantic source for cursor, focus and accessibility', async () => {
  const { getPrimaryActionPresentation } = await import(`${moduleUrl}?presentation`);

  assert.deepEqual(getPrimaryActionPresentation({ type: 'application', label: 'Enter Demo' }, 'Demo'), {
    role: 'button',
    ariaLabel: 'Enter Demo',
    actionable: true
  });
  assert.deepEqual(getPrimaryActionPresentation({ type: 'overlay', overlayId: 'menu' }, 'Archive'), {
    role: 'button',
    ariaLabel: 'Open Archive menu',
    actionable: true
  });
  assert.deepEqual(getPrimaryActionPresentation({ type: 'link', href: 'https://example.test' }, 'Site'), {
    role: 'link',
    ariaLabel: 'Open Site',
    actionable: true
  });
  assert.equal(getPrimaryActionPresentation(null, 'None'), null);
});
