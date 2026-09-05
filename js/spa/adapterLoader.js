export function createAdapterLoader({
  baseUrl,
  loadModule = (specifier) => import(specifier),
  resolveRegistration = (key) => globalThis.__SPA_ItemAdapters?.get?.(key) || null
}) {
  if (!baseUrl) throw new TypeError('adapter loader requires a base URL');
  const loads = new Map();

  function assertContract(adapter) {
    if (!adapter?.key) return null;

    const registration = resolveRegistration(adapter.key);
    if (!registration) {
      throw new Error(`adapter ${adapter.id} did not register ${adapter.key}`);
    }
    if (registration.contractVersion !== adapter.contractVersion) {
      throw new Error(
        `adapter ${adapter.id} contract mismatch for ${adapter.key}: expected ${adapter.contractVersion}, got ${registration.contractVersion}`
      );
    }
    return registration;
  }

  async function loadModules(adapter, cacheBust = false) {
    for (const path of adapter.modules) {
      const url = new URL(path, baseUrl);
      if (cacheBust) {
        url.searchParams.set('spa_adapter_contract', String(adapter.contractVersion || 1));
        url.searchParams.set('spa_adapter_retry', '1');
      }
      await loadModule(url.href);
    }
  }

  async function load(adapter) {
    if (!adapter) return null;
    if (loads.has(adapter.id)) return loads.get(adapter.id);

    const operation = (async () => {
      await loadModules(adapter, false);
      if (!adapter.key) return adapter.id;

      try {
        assertContract(adapter);
      } catch (firstError) {
        // A stale cached adapter can load successfully while exposing an older
        // interface. Retry once with a contract-versioned URL, then verify again.
        await loadModules(adapter, true);
        try {
          assertContract(adapter);
        } catch (retryError) {
          retryError.cause = firstError;
          throw retryError;
        }
      }

      return adapter.id;
    })();

    loads.set(adapter.id, operation);
    try {
      return await operation;
    } catch (error) {
      loads.delete(adapter.id);
      throw error;
    }
  }

  return { load };
}
