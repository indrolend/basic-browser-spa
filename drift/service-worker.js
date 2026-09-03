const CACHE = "drift-v4";
const base = new URL("./", self.registration.scope);
const url = (path) => new URL(path, base).href;
const CORE = [url("./"), url("index.html"), url("manifest.webmanifest"), url("icon.svg"), url("packs/starter.pack.json")];
self.addEventListener("install", (event) => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  const response = await fetch(url("index.html"));
  const html = await response.clone().text();
  const builtAssets = [...html.matchAll(/(?:src|href)="([^"]*assets\/[^"]+)"/g)].map((match) => new URL(match[1], base).href);
  await cache.put(url("index.html"), response);
  await cache.addAll([...CORE.filter((entry) => entry !== url("index.html")), ...builtAssets]);
  await self.skipWaiting();
})()));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(event.request, copy)); return response; }).catch(() => caches.match(url("index.html")))));
});
