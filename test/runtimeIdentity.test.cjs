const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { resolve } = require('node:path');

const moduleUrl = pathToFileURL(resolve(__dirname, '../js/spa/runtimeIdentity.js')).href;

function sampleSections() {
  return [
    { id: 'games', items: [
      {
        id: 'asymptote',
        adapter: { id: 'asymptote', key: 'games/asymptote', contractVersion: 1 }
      },
      { id: 'drift', clickAction: '/drift/' },
      { id: 'data', clickAction: 'https://example.test/data.zip' }
    ] }
  ];
}

test('runtime fingerprint is deterministic and changes when catalog truth changes', async () => {
  const { createRuntimeFingerprint } = await import(moduleUrl);
  const first = createRuntimeFingerprint(sampleSections());
  const second = createRuntimeFingerprint(sampleSections());
  assert.equal(first, second);
  assert.match(first, /^spa-[0-9a-f]{8}$/);

  const changed = sampleSections();
  changed[0].items.pop();
  assert.notEqual(createRuntimeFingerprint(changed), first);
});

test('runtime identity exposes the loaded catalog item ids and source URLs', async () => {
  const { createRuntimeIdentity } = await import(moduleUrl);
  const identity = createRuntimeIdentity({
    sections: sampleSections(),
    contentUrl: 'http://localhost/examples/indrolend/content.js',
    mainUrl: 'http://localhost/main.js'
  });

  assert.deepEqual(identity.sections, [
    { id: 'games', items: ['asymptote', 'drift', 'data'] }
  ]);
  assert.equal(identity.contentUrl, 'http://localhost/examples/indrolend/content.js');
  assert.equal(identity.mainUrl, 'http://localhost/main.js');
});
