import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';

// Final one-shot driver: the generated main.js is committed only after npm test passes.
const sourceUrl = new URL('./refactor-main-item-runtime.mjs', import.meta.url);
const generatedUrl = new URL('./.generated-refactor-main.mjs', import.meta.url);
let code = readFileSync(sourceUrl, 'utf8');

const compactTimingBlock = /replaceOnce\(\n`  if \(!isChained\)[\s\S]*?'compact default desktop timing'\n\);\n/;
if (!compactTimingBlock.test(code)) {
  throw new Error('expected compact desktop timing cleanup block was not found');
}
code = code.replace(compactTimingBlock, '');

const discoveryGuard = /\/\/ Rendering no longer awards discovery; semantic navigation\/boot commits do\.\nif \(source\.includes\('renderHeroDOM\(sectionIdx, itemIdx'\)[\s\S]*?\n\}\n\n/;
if (!discoveryGuard.test(code)) {
  throw new Error('expected discovery guard block was not found');
}
code = code.replace(discoveryGuard, '');

const invariantAnchor = '// The section-scoped bridge may remain as a fallback, but canonical application';
if (!code.includes(invariantAnchor)) {
  throw new Error('expected invariant anchor was not found');
}
code = code.replace(
  invariantAnchor,
  `// Normalize any releaseLike profile lines that differed only by indentation.\nsource = source.replace(/^\\s*timingProfile: 'releaseLike',?\\r?\\n/gm, '');\nsource = source.replaceAll(\"timingProfile: 'releaseLikeChained'\", \"timingProfile: 'chained'\");\n\n${invariantAnchor}`
);

writeFileSync(generatedUrl, code);
try {
  await import(`${generatedUrl.href}?run=${Date.now()}`);
} finally {
  unlinkSync(generatedUrl);
}
