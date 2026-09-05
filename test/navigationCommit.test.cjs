const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');

test('navigation commits semantic destination before revealing destination hero', () => {
  const runtime = readFileSync(resolve(root, 'main.js'), 'utf8');
  const goToStart = runtime.indexOf('async function goTo(');
  const goToEnd = runtime.indexOf('\nfunction getDesktopNavOptions', goToStart);
  assert.ok(goToStart >= 0 && goToEnd > goToStart, 'goTo function not found');

  const goTo = runtime.slice(goToStart, goToEnd);
  const commit = goTo.indexOf('commitNavigationTarget(nextSectionIdx, nextItemIdx');
  const reveal = goTo.indexOf('renderHeroDOM(nextSectionIdx, nextItemIdx');

  assert.ok(commit >= 0, 'goTo must use the navigation commit boundary');
  assert.ok(reveal >= 0, 'goTo must render the destination hero');
  assert.ok(commit < reveal, 'semantic destination must commit before destination hero reveal');
  assert.doesNotMatch(goTo, /currentSectionIdx\s*=\s*nextSectionIdx/);
  assert.doesNotMatch(goTo, /currentItemIdx\s*=\s*nextItemIdx/);
});
