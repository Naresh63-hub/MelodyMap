---
kind: error_handling
name: 'Error Handling: React Error Boundaries, SSR Fallback Pages, and h3 Swallowed-Error Capture'
category: error_handling
scope:
    - '**'
source_files:
    - src/lib/error-capture.ts
    - src/lib/error-page.ts
    - src/lib/lovable-error-reporting.ts
    - src/components/music/ErrorBoundary.tsx
    - src/routes/__root.tsx
    - src/server.ts
---

## Overview

This TanStack Start + Vite + Nitro music streaming app uses a layered error-handling strategy that spans the browser (React), the server entry point, and an in-process error capture shim. There is no centralized typed error class hierarchy; instead, errors are propagated as plain `Error`/`unknown` values, logged via `console.error`, and surfaced to users through dedicated UI fallbacks.

## Browser-side: React Error Boundary

- **Component**: `src/components/music/ErrorBoundary.tsx` — a classic class-based React `ErrorBoundary` implementing `getDerivedStateFromError` and `componentDidCatch`. It stores the caught `Error` plus `ErrorInfo` in component state and renders a friendly fallback with a "Reload app" / "Try to recover" action. In development (`import.meta.env.DEV`) it also shows the error message and component stack in a `<pre>` block.
- **Root-level route error handling**: `src/routes/__root.tsx` defines both a `notFoundComponent` (404 page) and an `errorComponent` (SSR route error page) via TanStack Router's `createRootRouteWithContext`. The root component wraps the entire tree in `<ErrorBoundary>` so render-time errors bubble up to this boundary.
- **Reporting helper**: `src/lib/lovable-error-reporting.ts` exposes a thin `reportError(error, context)` function that simply calls `console.error("[MelodyMap] Runtime error:", error, context)`. It is intended as a rebrandable hook for external error-reporting services but currently only logs.

## Server-side: Global capture of swallowed h3 errors

The runtime framework (h3/TanStack Start) can swallow synchronous throws inside handlers and return a generic JSON `{"unhandled":true,"message":"HTTPError"}` 500 response without invoking a try/catch around the handler. To preserve diagnostic information, the server bootstraps a global shim:

- **Global console.error wrapper** (`src/lib/error-capture.ts`): Replaces `console.error` so every logged argument that is an `Error` is expanded into a multi-line string that walks the `.cause` chain (up to depth 5) and appends any HTTP status code found on the error. The original `Error` object is also stored in a short-lived TTL cache (5 seconds).
- **Browser/unhandled hooks**: If available, `globalThis.addEventListener("error", ...)` and `addEventListener("unhandledrejection", ...)` record unhandled promise rejections and script errors into the same TTL cache.
- **TTL cache consumer**: `consumeLastCapturedError()` returns the most recent recorded error within the 5-second window and clears it.

## Server entry: Normalizing catastrophic SSR responses

`src/server.ts` is the Nitro/h3 entry point. Its `fetch` handler:

1. Imports `./lib/error-capture` at the top level so the `console.error` shim runs before any request.
2. Wraps the whole request pipeline in a try/catch that falls back to `renderErrorPage()` (a static HTML 500 page defined in `src/lib/error-page.ts`).
3. After calling the TanStack Start server entry, passes the response through `normalizeCatastrophicSsrResponse`, which detects the h3-swallowed-error JSON body and replaces it with the HTML error page while logging the captured error from the TTL cache.

## Streaming proxy: Explicit error propagation

The `/api/stream/*` proxy in `src/server.ts` handles upstream failures explicitly:
- Missing video id → `Response(400)`.
- Stream URL not resolved → `Response(404)`.
- Upstream probe fails or capped stream → `Response(502)`.
- Invalid byte range → `Response(416)` with `Content-Range` header.
- Per-chunk fetch failures throw `Error("upstream chunk failed")`, which propagates through the `ReadableStream` pull loop and surfaces as a stream error to the client.

## Conventions and constraints observed

- Errors are thrown as plain `Error` objects (or `unknown`); there is no custom error class hierarchy or error-code enum used across the codebase.
- User-facing error pages are static, self-contained HTML strings rendered by `renderErrorPage()` rather than routed components, ensuring they work even when the JS bundle fails to load.
- Unhandled errors are never silently dropped: they always pass through `console.error`, either via the wrapped global `console.error` or explicit log statements prefixed with `[MelodyMap]`.
- Development-only diagnostics (component stacks, inline error dumps) are gated behind `import.meta.env.DEV` checks in the React boundary.
- The server treats h3's swallowed-throw behavior as a known invariant and defensively inspects response bodies for `{unhandled:true,message:"HTTPError"}` to recover the original error from the TTL cache.
- No `try/catch` blocks were found in the library modules under `src/lib/`; errors in those modules generally propagate upward to be handled by the root boundary or server entry.