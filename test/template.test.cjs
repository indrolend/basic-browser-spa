const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { readdir } = require('node:fs/promises');
const { dirname, relative, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const root = resolve(__dirname, '..');

async function filesBelow(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) found.push(...await filesBelow(path));
    else found.push(path);
  }
  return found;
}

test('runtime JavaScript parses in its actual script or module mode', async () => {
  const files = [resolve(root, 'main.js'), ...await filesBelow(resolve(root, 'js'))]
    .filter((path) => path.endsWith('.js'));

  for (const path of files) {
    const source = readFileSync(path, 'utf8');
    const name = relative(root, path);
    assert.doesNotMatch(source, /^(?:<<<<<<<|=======|>>>>>>>)/m, name);
    const isModule = path === resolve(root, 'main.js') || /^\s*(?:import|export)\s/m.test(source);
    const args = isModule ? ['--input-type=module', '--check'] : ['--check', '-'];
    const parsed = spawnSync(process.execPath, args, { input: source, encoding: 'utf8' });
    assert.equal(parsed.status, 0, `${name}\n${parsed.stderr}`);
  }
});

test('primary HTML entrypoint references committed local files', () => {
  const source = readFileSync(resolve(root, 'index.html'), 'utf8');
  const references = [...source.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
  const local = references.filter((path) => !/^(?:[a-z]+:|#|data:)/i.test(path));

  assert.ok(local.length > 0);
  for (const path of local) {
    assert.equal(existsSync(resolve(root, path)), true, path);
  }
});

test('content can be replaced and validated without editing the runtime', async () => {
  const modelUrl = pathToFileURL(resolve(root, 'js/spa/contentModel.js')).href;
  const { defineContent } = await import(modelUrl);
  const alternate = defineContent([
    {
      id: 'docs',
      label: 'Documentation',
      items: [
        { id: 'start', label: 'Start', hero: { kind: 'text', text: 'Hello' } },
        { id: 'diagram', label: 'Diagram', hero: { kind: 'image', src: 'example.png' } }
      ]
    }
  ]);

  assert.equal(alternate[0].id, 'docs');
  assert.equal(alternate[0].items[1].hero.kind, 'image');
  assert.equal(Object.isFrozen(alternate), true);
  assert.equal(Object.isFrozen(alternate[0].items), true);
  assert.throws(() => defineContent([
    { id: 'same', label: 'One', items: [{ id: 'item', label: 'One', hero: { kind: 'text', text: 'One' } }] },
    { id: 'same', label: 'Two', items: [{ id: 'item', label: 'Two', hero: { kind: 'text', text: 'Two' } }] }
  ]), /duplicate section id/);

  const runtime = readFileSync(resolve(root, 'main.js'), 'utf8');
  assert.match(runtime, /import \{ SPA_SECTIONS \} from '.\/js\/content\.js'/);
  assert.doesNotMatch(runtime, /const SPA_SECTIONS\s*=\s*\[/);
});

test('example content image heroes resolve to committed assets', async () => {
  const contentUrl = pathToFileURL(resolve(root, 'js/content.js')).href;
  const { SPA_SECTIONS } = await import(contentUrl);
  for (const section of SPA_SECTIONS) {
    for (const item of section.items) {
      if (item.hero.kind === 'image') {
        assert.equal(existsSync(resolve(root, item.hero.src)), true, item.hero.src);
      }
    }
  }
});

test('optional adapters load in order, deduplicate, and retry after failure', async () => {
  const loaderUrl = pathToFileURL(resolve(root, 'js/spa/adapterLoader.js')).href;
  const { createAdapterLoader } = await import(loaderUrl);
  const calls = [];
  const loader = createAdapterLoader({
    baseUrl: new URL('https://template.invalid/js/content.js'),
    loadModule: async (specifier) => { calls.push(specifier); }
  });
  const adapter = { id: 'demo', modules: ['./one.js', './two.js'] };

  await Promise.all([loader.load(adapter), loader.load(adapter)]);
  assert.deepEqual(calls, [
    'https://template.invalid/js/one.js',
    'https://template.invalid/js/two.js'
  ]);

  let attempts = 0;
  const retrying = createAdapterLoader({
    baseUrl: new URL('https://template.invalid/js/content.js'),
    loadModule: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('unavailable');
    }
  });
  await assert.rejects(retrying.load({ id: 'retry', modules: ['./adapter.js'] }), /unavailable/);
  await retrying.load({ id: 'retry', modules: ['./adapter.js'] });
  assert.equal(attempts, 2);
});

test('adapter declarations remain optional and validate relative modules', async () => {
  const modelUrl = pathToFileURL(resolve(root, 'js/spa/contentModel.js')).href;
  const { defineContent } = await import(modelUrl);
  assert.doesNotThrow(() => defineContent([
    { id: 'plain', label: 'Plain', items: [{ id: 'text', label: 'Text', hero: { kind: 'text', text: 'Text' } }] }
  ]));
  assert.throws(() => defineContent([
    {
      id: 'bad', label: 'Bad', items: [
        { id: 'adapter', label: 'Adapter', hero: { kind: 'text', text: 'Adapter' }, adapter: { id: 'bad', modules: ['https://outside.invalid/code.js'] } }
      ]
    }
  ]), /relative module paths/);
});
