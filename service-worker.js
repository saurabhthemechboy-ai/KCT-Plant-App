const CACHE_NAME = "kct-plant-v4";
const PRECACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/logo-full.png",
  "/icon-192.png",
  "/icon-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (c) {
      return c.addAll(PRECACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
            .map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      return cached || fetch(e.request).then(function (res) {
        if (res && res.status === 200 && e.request.url.startsWith(self.location.origin)) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(function (c) { c.put(e.request, clone); });
        }
        return res;
      }).catch(function () { return caches.match("/index.html"); });
    })
  );
});
