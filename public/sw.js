const CACHE_VERSION = "melodymap-v4";
const SHELL_CACHE = "melodymap-shell-v4";

// App shell: the HTML, JS, CSS that make up the UI.
const SHELL_ASSETS = ["/", "/manifest.json"];

// Install: pre-cache the app shell so the app loads offline.
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        Promise.allSettled(SHELL_ASSETS.map((url) => cache.add(url)))
      )
  );
});

// Activate: clean up ALL old caches immediately.
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

// Fetch: network-first strategy for HTML & API, pass-through for streams.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Audio streams go straight to the network (no caching)
  if (
    url.pathname.startsWith("/api/stream") ||
    url.pathname.startsWith("/api/range") ||
    request.destination === "audio"
  ) {
    return;
  }

  // API calls & Page Navigation (HTML) — Network-first, fall back to cache when offline
  if (url.pathname === "/" || url.pathname.startsWith("/api/") || request.mode === "navigate" || request.destination === "document") {
    event.respondWith(
      fetch(request, { cache: "no-cache" })
        .then((res) => {
          if (res.ok && request.method === "GET") {
            const clone = res.clone();
            const targetCache = url.pathname.startsWith("/api/") ? CACHE_VERSION : SHELL_CACHE;
            caches.open(targetCache).then((cache) => cache.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  // Static assets (scripts, styles, images, fonts) — Network-first with cache fallback
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok && request.method === "GET") {
          const clone = res.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, clone));
        }
        return res;
      })
      .catch(() => caches.match(request)),
  );
});

// Allow the page to trigger an immediate update check.
self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});
