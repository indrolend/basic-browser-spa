const registrations = new Map();

function assertItemKey(itemKey) {
  if (typeof itemKey !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]*\/[A-Za-z][A-Za-z0-9_-]*$/.test(itemKey)) {
    throw new TypeError('item adapter key must be "section/item"');
  }
}

export function registerItemAdapter(itemKey, adapter) {
  assertItemKey(itemKey);
  if (!adapter || typeof adapter !== 'object') {
    throw new TypeError(`item adapter ${itemKey} must be an object`);
  }
  if (!Number.isInteger(adapter.contractVersion) || adapter.contractVersion < 1) {
    throw new TypeError(`item adapter ${itemKey} must declare a positive contractVersion`);
  }

  const existing = registrations.get(itemKey);
  if (existing && existing !== adapter) {
    throw new Error(`item adapter already registered: ${itemKey}`);
  }

  registrations.set(itemKey, adapter);
  return adapter;
}

export function getItemAdapter(itemKey) {
  return registrations.get(itemKey) || null;
}

export function clearItemAdaptersForTesting() {
  registrations.clear();
}

// Transitional browser bridge for dynamically imported adapters. The registry is
// item-scoped even while main.js still carries the legacy section-view bridge.
if (typeof globalThis !== 'undefined') {
  globalThis.__SPA_ItemAdapters = {
    register: registerItemAdapter,
    get: getItemAdapter
  };
}
