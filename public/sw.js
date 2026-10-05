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

  // Vite internal and developer module requests — let browser fetch directly without interception
  if (
    url.pathname.startsWith("/src/") ||
    url.pathname.startsWith("/@") ||
    url.pathname.startsWith("/node_modules/") ||
    url.searchParams.has("tsr-split") ||
    url.searchParams.has("v") ||
    url.searchParams.has("t")
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
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
        }),
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
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        return new Response("Asset unavailable offline", { status: 404, statusText: "Not Found" });
      }),
  );
});

// Allow same-origin pages to trigger an immediate update check securely.
self.addEventListener("message", (event) => {
  // Validate origin to prevent unauthorized cross-origin / cross-window activations
  if (event.origin && event.origin !== self.location.origin) return;
  if (event.source && typeof event.source === "object" && "url" in event.source) {
    try {
      const sourceOrigin = new URL(event.source.url).origin;
      if (sourceOrigin !== self.location.origin) return;
    } catch {
      return;
    }
  }

  if (event.data === "skipWaiting") {
    self.skipWaiting();
  }
});
