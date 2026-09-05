import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const sourceUrl = new URL('./refactor-main-item-runtime.mjs', import.meta.url);
const generatedUrl = new URL('./.generated-refactor-main.mjs', import.meta.url);
let code = readFileSync(sourceUrl, 'utf8');

const compactTimingBlock = /replaceOnce\(\n`  if \(!isChained\)[\s\S]*?'compact default desktop timing'\n\);\n/;
if (!compactTimingBlock.test(code)) {
  throw new Error('expected compact desktop timing cleanup block was not found');
}
code = code.replace(compactTimingBlock, '');

writeFileSync(generatedUrl, code);
try {
  await import(`${generatedUrl.href}?run=${Date.now()}`);
} finally {
  unlinkSync(generatedUrl);
}
