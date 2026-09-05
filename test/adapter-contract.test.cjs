const test = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

const root = resolve(__dirname, '..');

test('adapter loader verifies item contract and retries stale modules once', async () => {
  const loaderUrl = pathToFileURL(resolve(root, 'js/spa/adapterLoader.js')).href;
  const { createAdapterLoader } = await import(loaderUrl);

  const calls = [];
  let registration = null;
  const loader = createAdapterLoader({
    baseUrl: new URL('https://template.invalid/examples/content.js'),
    resolveRegistration: () => registration,
    loadModule: async (specifier) => {
      calls.push(specifier);
      if (specifier.includes('spa_adapter_retry=1')) {
        registration = { contractVersion: 1 };
      }
    }
  });

  await loader.load({
    id: 'demo',
    key: 'games/demo',
    contractVersion: 1,
    modules: ['./demo.js']
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0], 'https://template.invalid/examples/demo.js');
  assert.match(calls[1], /spa_adapter_contract=1/);
  assert.match(calls[1], /spa_adapter_retry=1/);
});

test('adapter loader rejects a module that never satisfies its declared contract', async () => {
  const loaderUrl = pathToFileURL(resolve(root, 'js/spa/adapterLoader.js')).href;
  const { createAdapterLoader } = await import(`${loaderUrl}?reject-contract`);

  const loader = createAdapterLoader({
    baseUrl: new URL('https://template.invalid/examples/content.js'),
    resolveRegistration: () => null,
    loadModule: async () => {}
  });

  await assert.rejects(loader.load({
    id: 'broken',
    key: 'games/broken',
    contractVersion: 1,
    modules: ['./broken.js']
  }), /did not register games\/broken/);
});

test('adapter loader deduplicates by item key rather than display id', async () => {
  const loaderUrl = pathToFileURL(resolve(root, 'js/spa/adapterLoader.js')).href;
  const { createAdapterLoader } = await import(`${loaderUrl}?item-key-dedupe`);
  const calls = [];
  const registrations = new Map([
    ['games/one', { contractVersion: 1 }],
    ['games/two', { contractVersion: 1 }]
  ]);
  const loader = createAdapterLoader({
    baseUrl: new URL('https://template.invalid/examples/content.js'),
    resolveRegistration: (key) => registrations.get(key) || null,
    loadModule: async (specifier) => { calls.push(specifier); }
  });

  await loader.load({ id: 'shared', key: 'games/one', contractVersion: 1, modules: ['./one.js'] });
  await loader.load({ id: 'shared', key: 'games/two', contractVersion: 1, modules: ['./two.js'] });

  assert.deepEqual(calls, [
    'https://template.invalid/examples/one.js',
    'https://template.invalid/examples/two.js'
  ]);
});

test('item adapter registry is keyed by section/item and exposes contract capabilities', async () => {
  const registryUrl = pathToFileURL(resolve(root, 'js/spa/itemAdapterRegistry.js')).href;
  const registry = await import(`${registryUrl}?registry-test`);
  registry.clearItemAdaptersForTesting();

  const adapter = registry.registerItemAdapter('games/demo', {
    contractVersion: 1,
    getPrimaryAction() { return { type: 'application' }; },
    enterApplication() {},
    exitApplication() {}
  });

  assert.equal(registry.getItemAdapter('games/demo'), adapter);
  assert.equal(adapter.getPrimaryAction().type, 'application');
  assert.throws(() => registry.registerItemAdapter('bad-key', { contractVersion: 1 }), /section\/item/);
});

test('application adapters must expose symmetric enter and exit lifecycle', async () => {
  const registryUrl = pathToFileURL(resolve(root, 'js/spa/itemAdapterRegistry.js')).href;
  const registry = await import(`${registryUrl}?application-lifecycle`);
  registry.clearItemAdaptersForTesting();

  assert.throws(() => registry.registerItemAdapter('games/demo', {
    contractVersion: 1,
    getPrimaryAction() { return { type: 'application' }; },
    enterApplication() {}
  }), /enterApplication and exitApplication/);
});

test('item adapter registry permits contract-safe refresh and rejects downgrade', async () => {
  const registryUrl = pathToFileURL(resolve(root, 'js/spa/itemAdapterRegistry.js')).href;
  const registry = await import(`${registryUrl}?registry-refresh`);
  registry.clearItemAdaptersForTesting();

  const first = registry.registerItemAdapter('games/demo', { contractVersion: 1, marker: 'first' });
  const refreshed = registry.registerItemAdapter('games/demo', { contractVersion: 1, marker: 'refresh' });
  const upgraded = registry.registerItemAdapter('games/demo', { contractVersion: 2, marker: 'upgrade' });

  assert.notEqual(first, refreshed);
  assert.equal(registry.getItemAdapter('games/demo'), upgraded);
  assert.throws(
    () => registry.registerItemAdapter('games/demo', { contractVersion: 1 }),
    /cannot replace contract 2 with older contract 1/
  );
});

test('content model validates item-scoped adapter key and contract version together', async () => {
  const modelUrl = pathToFileURL(resolve(root, 'js/spa/contentModel.js')).href;
  const { defineContent } = await import(`${modelUrl}?adapter-contract`);

  assert.doesNotThrow(() => defineContent([{
    id: 'games',
    label: 'Games',
    items: [{
      id: 'demo',
      label: 'Demo',
      hero: { kind: 'text', text: 'Demo' },
      adapter: {
        id: 'demo',
        key: 'games/demo',
        contractVersion: 1,
        modules: ['./demo.js']
      }
    }]
  }]));

  assert.throws(() => defineContent([{
    id: 'games',
    label: 'Games',
    items: [{
      id: 'demo',
      label: 'Demo',
      hero: { kind: 'text', text: 'Demo' },
      adapter: { id: 'demo', key: 'games/wrong', contractVersion: 1, modules: ['./demo.js'] }
    }]
  }]), /key must be games\/demo/);
});
