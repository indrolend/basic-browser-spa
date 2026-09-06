import { readFileSync, writeFileSync } from 'node:fs';

// One-shot migration trigger: wire runtime identity into main.js, verify, then remove.
const path = new URL('../main.js', import.meta.url);
let source = readFileSync(path, 'utf8');

function replaceOnce(search, replacement, label) {
  const before = source;
  source = source.replace(search, replacement);
  if (source === before) throw new Error(`runtime identity migration did not match: ${label}`);
}

replaceOnce(
`import { resolvePrimaryAction, getPrimaryActionPresentation } from './js/spa/primaryAction.js';
import { PARTICLE_SIZE, sampleSurfaceParticles } from './js/spa/particleSampling.js';`,
`import { resolvePrimaryAction, getPrimaryActionPresentation } from './js/spa/primaryAction.js';
import { createRuntimeIdentity, publishRuntimeIdentity } from './js/spa/runtimeIdentity.js';
import { PARTICLE_SIZE, sampleSurfaceParticles } from './js/spa/particleSampling.js';`,
  'runtime identity import'
);

replaceOnce(
`const { CONTENT_BASE_URL, SPA_SECTIONS } = await import(new URL(contentPath, document.baseURI).href);

const adapterLoader = createAdapterLoader({`,
`const contentUrl = new URL(contentPath, document.baseURI).href;
const { CONTENT_BASE_URL, SPA_SECTIONS } = await import(contentUrl);
const RUNTIME_IDENTITY = createRuntimeIdentity({
  sections: SPA_SECTIONS,
  contentUrl,
  mainUrl: import.meta.url
});

const adapterLoader = createAdapterLoader({`,
  'loaded source identity'
);

replaceOnce(
`function spaDebug(...args) {
  if (SPA_DEBUG) console.debug(...args);
}

// ─── Application ownership`,
`function spaDebug(...args) {
  if (SPA_DEBUG) console.debug(...args);
}
publishRuntimeIdentity(RUNTIME_IDENTITY, { debug: SPA_DEBUG });
spaDebug('[runtime identity]', RUNTIME_IDENTITY);

// ─── Application ownership`,
  'runtime identity publication'
);

if (!source.includes("window.__SPA_RuntimeIdentity") && !source.includes('publishRuntimeIdentity(RUNTIME_IDENTITY')) {
  throw new Error('runtime identity was not wired into main.js');
}

writeFileSync(path, source);
