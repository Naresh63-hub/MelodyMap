const CACHE_VERSION = "melodymap-v1";
const SHELL_CACHE = "melodymap-shell-v1";

// App shell: the HTML, JS, CSS that make up the UI.
const SHELL_ASSETS = ["/", "/manifest.json"];

// Install: pre-cache the app shell so the app loads offline.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        // Best-effort: skip missing assets instead of failing the whole install
        Promise.allSettled(SHELL_ASSETS.map((url) => cache.add(url)))
      )
      .then(() => self.skipWaiting()),
  );
});

// Activate: clean up old caches (including previous versions).
const ACTIVE_CACHES = new Set([CACHE_VERSION, SHELL_CACHE]);
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.filter((n) => !ACTIVE_CACHES.has(n)).map((n) => caches.delete(n)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Fetch: network-first for API calls, cache-first for shell assets,
// and a special pass-through for audio streams (no caching — they're huge).
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Audio streams go straight to the network (via the proxy).
  // Caching multi-MB audio blobs would blow the quota and isn't useful
  // because the offline-download feature handles that in IndexedDB.
  if (
    url.pathname.startsWith("/api/stream") ||
    url.pathname.startsWith("/api/range") ||
    request.destination === "audio"
  ) {
    return;
  }

  // API calls (search, recommendations, etc.) — network-first, fall back to cache.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          // Only cache successful GET responses
          if (res.ok && request.method === "GET") {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  // Everything else (app shell, images, fonts) — cache-first, then network.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          // Only cache successful GET responses for shell assets
          if (res.ok && request.method === "GET") {
            const clone = res.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, clone));
          }
          return res;
        }),
    ),
  );
});

// Allow the page to trigger an immediate update check.
self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});
