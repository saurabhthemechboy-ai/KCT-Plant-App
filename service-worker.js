/* ============================================================
   KCT Plant App — Service Worker
   Provides offline caching + enables PWA install prompt.
   ============================================================ */

const CACHE_NAME = "kct-plant-v3";
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
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE);
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
  e.respondWith(
    caches.match(e.request).then(function (res) {
      return res || fetch(e.request);
    })
  );
});
