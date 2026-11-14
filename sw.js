// Service worker: keeps the whole notebook available offline.
const VERSION = "c5d396ee18";
const CORE = ["./", "index.html", "data.json", "manifest.webmanifest", "leaflet.js", "leaflet.css", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png"];
const CORE_CACHE = "core-" + VERSION;
const IMG_CACHE = "anh-v1"; // image file names are content hashes, so this cache survives updates
const TILE_CACHE = "tiles-v1"; // Amap map tiles: saved ahead by the app, plus every tile viewed online
const TILE_HOST = /^webrd0\d\.is\.autonavi\.com$/;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CORE_CACHE).then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CORE_CACHE && k !== IMG_CACHE && k !== TILE_CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (TILE_HOST.test(url.hostname)) {
    // one cache key per tile whichever of the 4 tile servers was asked
    url.hostname = "webrd01.is.autonavi.com";
    const key = url.href;
    e.respondWith((async () => {
      const c = await caches.open(TILE_CACHE);
      const hit = await c.match(key);
      if (hit) return hit;
      try {
        const res = await fetch(key, { mode: "cors" });
        if (res.ok) c.put(key, res.clone());
        return res;
      } catch (err) {
        return new Response("", { status: 504 }); // offline and not saved: leave the square blank
      }
    })());
    return;
  }
  if (url.origin !== location.origin) return;
  if (url.pathname.includes("/anh/")) {
    e.respondWith((async () => {
      const c = await caches.open(IMG_CACHE);
      const hit = await c.match(e.request, { ignoreSearch: true });
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) c.put(e.request, res.clone());
      return res;
    })());
    return;
  }
  e.respondWith((async () => {
    const c = await caches.open(CORE_CACHE);
    const hit = await c.match(e.request, { ignoreSearch: true }) || (e.request.mode === "navigate" ? await c.match("index.html") : null);
    return hit || fetch(e.request);
  })());
});
