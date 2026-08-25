const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { readdir } = require('node:fs/promises');
const { dirname, relative, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

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
