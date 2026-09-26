/* ============================================================
   KCT Plant App — Service Worker
   Provides offline caching + enables PWA install prompt.
   ============================================================ */

const CACHE_NAME = "kct-plant-v1";

// Files cached on first visit. These are the app shell —
// enough to render a usable UI even when offline.
const CACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png"
];

/* ---------- Install: pre-cache the app shell ---------- */
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(CACHE_URLS).catch(function (err) {
        // If any single asset fails (e.g. icon not yet uploaded),
        // don't fail the whole install — cache what we can.
        console.warn("Some assets failed to cache:", err);
      });
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

/* ---------- Activate: clean up old caches ---------- */
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

/* ---------- Fetch: cache-first for app shell, network-first for API ---------- */
self.addEventListener("fetch", function (event) {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle GET requests
  if (req.method !== "GET") return;

  // Never cache Apps Script API calls — always go to network
  if (url.hostname.indexOf("script.google.com") !== -1 ||
      url.hostname.indexOf("googleusercontent.com") !== -1) {
    return; // let the browser handle it
  }

  // Never cache calls to non-GET navigation during POST
  if (req.mode === "navigate") {
    // Network first, fall back to cached index.html
    event.respondWith(
      fetch(req).catch(function () {
        return caches.match("/index.html");
      })
    );
    return;
  }

  // Same-origin assets: cache-first, then network
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(function (cached) {
        if (cached) return cached;

        return fetch(req).then(function (res) {
          // Cache successful same-origin responses
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(req, copy).catch(function () {});
            });
          }
          return res;
        }).catch(function () {
          // Offline and not cached — nothing we can do
          return new Response("", { status: 504 });
        });
      })
    );
  }
});

/* ---------- Message handler: allow the page to force-update ---------- */
self.addEventListener("message", function (event) {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
