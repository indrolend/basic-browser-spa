export function createAdapterLoader({ baseUrl, loadModule = (specifier) => import(specifier) }) {
  if (!baseUrl) throw new TypeError('adapter loader requires a base URL');
  const loads = new Map();

  async function load(adapter) {
    if (!adapter) return null;
    if (loads.has(adapter.id)) return loads.get(adapter.id);

    const operation = (async () => {
      for (const path of adapter.modules) {
        await loadModule(new URL(path, baseUrl).href);
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
