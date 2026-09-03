const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadEconomy() {
  const source = fs.readFileSync('js/spa/sharedEconomy.js', 'utf8')
    .replace(/export const IndrolendEconomy/, 'const IndrolendEconomy')
    .replace(/export function /g, 'function ')
    .concat('\nglobalThis.result = { IndrolendEconomy, awardDiscovery };');
  const values = new Map();
  const window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
  const context = {
    window,
    localStorage: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
    CustomEvent: class { constructor(name, init) { this.type = name; this.detail = init.detail; } },
    Date, JSON, Number, Object
  };
  vm.runInNewContext(source, context);
  return context.result;
}

test('discovery awards are idempotent', () => {
  const { IndrolendEconomy, awardDiscovery } = loadEconomy();
  assert.equal(awardDiscovery('games', 'drift'), true);
  assert.equal(awardDiscovery('games', 'drift'), false);
  assert.equal(IndrolendEconomy.getSnapshot().balance, 1);
});

test('spending cannot make the balance negative', () => {
  const { IndrolendEconomy } = loadEconomy();
  assert.equal(IndrolendEconomy.spend({ id: 'x', amount: 1 }), false);
  assert.equal(IndrolendEconomy.getSnapshot().balance, 0);
});
