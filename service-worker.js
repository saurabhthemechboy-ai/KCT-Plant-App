// Build: 2026-10-01-v2
const CACHE_NAME = "kct-plant-cache-v8-2026-10-01";

const PRECACHE = [
  "/",
  "/index.html",
  "/manifest.json"
];

// Install: cache core files and activate immediately
self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE);
    })
  );
});

// Activate: delete ALL old caches, take control of open pages
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (k) {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// Fetch: NETWORK-FIRST for HTML (so updates always win)
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;

  const url = new URL(e.request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // For HTML navigations, go network-first
  const isHTML =
    e.request.mode === "navigate" ||
    (e.request.headers.get("accept") || "").indexOf("text/html") !== -1;

  if (isHTML) {
    e.respondWith(
      fetch(e.request)
        .then(function (res) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(function (c) {
            c.put(e.request, clone);
          });
          return res;
        })
        .catch(function () {
          return caches.match("/index.html");
        })
    );
    return;
  }

  // Everything else: cache-first (faster)
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      return cached || fetch(e.request);
    })
  );
});
