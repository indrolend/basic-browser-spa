function fnv1a32(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function normalizeCatalog(sections) {
  return (sections || []).map((section) => ({
    id: section?.id || null,
    items: (section?.items || []).map((item) => ({
      id: item?.id || null,
      action: item?.clickAction || null,
      adapter: item?.adapter
        ? {
            id: item.adapter.id || null,
            key: item.adapter.key || null,
            contractVersion: item.adapter.contractVersion ?? null
          }
        : null
    }))
  }));
}

export function createRuntimeFingerprint(sections) {
  const catalog = normalizeCatalog(sections);
  const serialized = JSON.stringify(catalog);
  return `spa-${fnv1a32(serialized).toString(16).padStart(8, '0')}`;
}

export function createRuntimeIdentity({ sections, contentUrl, mainUrl }) {
  const catalog = normalizeCatalog(sections);
  return Object.freeze({
    fingerprint: createRuntimeFingerprint(sections),
    mainUrl: mainUrl || null,
    contentUrl: contentUrl || null,
    sections: catalog.map((section) => ({
      id: section.id,
      items: section.items.map((item) => item.id)
    }))
  });
}

export function publishRuntimeIdentity(identity, {
  debug = false,
  windowRef = typeof window !== 'undefined' ? window : null,
  documentRef = typeof document !== 'undefined' ? document : null,
  consoleRef = typeof console !== 'undefined' ? console : null
} = {}) {
  if (!identity) return;

  if (windowRef) windowRef.__SPA_RuntimeIdentity = identity;
  if (documentRef?.documentElement) {
    documentRef.documentElement.dataset.spaRuntime = identity.fingerprint;
  }

  if (!debug) return;

  consoleRef?.info?.('[spa runtime]', identity);
  if (!documentRef?.body || documentRef.getElementById('spa-runtime-debug')) return;

  const badge = documentRef.createElement('output');
  badge.id = 'spa-runtime-debug';
  badge.setAttribute('aria-label', 'SPA runtime identity');
  badge.textContent = `${identity.fingerprint} · ${identity.sections
    .map((section) => `${section.id}:${section.items.join(',')}`)
    .join(' | ')}`;
  Object.assign(badge.style, {
    position: 'fixed',
    left: '0.5rem',
    bottom: '0.5rem',
    zIndex: '9999',
    maxWidth: 'calc(100vw - 1rem)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: '10px',
    opacity: '0.72',
    pointerEvents: 'none'
  });
  documentRef.body.appendChild(badge);
}
