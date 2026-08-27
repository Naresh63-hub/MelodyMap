---
kind: logging_system
name: Minimal console-based error capture and reporting (no structured logging framework)
category: logging_system
scope:
    - '**'
source_files:
    - src/lib/error-capture.ts
    - src/server.ts
    - src/start.ts
    - src/lib/lovable-error-reporting.ts
    - src/lib/error-page.ts
---

## What system/approach is used

The application does **not** use a dedicated logging framework. There are no dependencies such as `pino`, `winston`, `bunyan`, or `console-log-level` in `package.json`. All runtime output goes through the native `console` API (`console.error`, `console.log`) and a small custom error-capture shim that augments `console.error` to preserve stack traces when h3 swallows exceptions.

## Key files and packages

- `src/lib/error-capture.ts` — global shim that wraps `console.error`, records the last captured Error, expands Error cause chains into a single string, and listens for `error` / `unhandledrejection` browser events.
- `src/server.ts` — Nitro server entry; imports `error-capture` at the top so the shim runs before any handler. Uses `console.error` directly for stream-proxy failures and SSR error recovery via `consumeLastCapturedError()`.
- `src/start.ts` — TanStack Start bootstrap; registers an error middleware that calls `console.error` on unhandled request errors and returns a rendered error page.
- `src/lib/lovable-error-reporting.ts` — thin wrapper `reportError(error, context)` that forwards to `console.error("[MelodyMap] Runtime error:", …)` with a `[MelodyMap]` tag.
- `src/lib/error-page.ts` — renders an HTML error page returned by the server on 500 responses.

No other source files were found that import these modules or call `console.log`/`console.error` directly; the grep search for `console\.(log|error|warn|info|debug)` under `src/**/*.{ts,tsx}` returned zero matches beyond the three files above, indicating logging is intentionally minimal and centralized.

## Architecture and conventions

1. **Single point of interception.** `src/server.ts` imports `./lib/error-capture` as its first line. That file monkey-patches `console.error` globally so every error logged anywhere in the process is expanded and recorded.
2. **Error expansion.** `describeError` walks up to `CAUSE_DEPTH_LIMIT = 5` levels of `Error.cause`, appending each frame's `stack` (or `name: message`) and status code info, then truncates to `DESCRIPTION_LENGTH_LIMIT = 8_000` characters. This ensures h3-swallowed errors still surface full stacks in logs.
3. **TTL-backed last-error cache.** The most recent captured error is stored in module-scoped state with a timestamp; `consumeLastCapturedError()` returns it within `TTL_MS = 5_000` ms and clears it afterward. `server.ts` uses this in `normalizeCatastrophicSsrResponse` to recover the original thrown error from h3's generic `{"unhandled":true,"message":"HTTPError"}` response.
4. **Browser-side hooks.** When running in the browser, the shim also attaches `globalThis.addEventListener("error", …)` and `"unhandledrejection", …` to record client-side uncaught errors.
5. **Tagged console messages.** Stream-proxy diagnostics use a bracketed prefix (`[stream-proxy] chunk … -> 403`, `[stream-proxy] capped stream …`) so they can be grepped separately from application errors. The generic reporter prefixes all entries with `[MelodyMap]`.
6. **Structured fields do not exist.** Log lines are plain strings produced by `console.error`; there is no JSON envelope, no log level field, no correlation ID, and no sink configuration.
7. **No log-level strategy.** The codebase only emits error-level output via `console.error`; there are no debug/info/warn variants and no environment-driven level switching.

## Conventions and constraints

- Errors must go through `console.error` (directly or via `reportError`); normal informational output is not emitted in this project.
- Any new error path should either call `console.error` directly (which will be intercepted by the shim) or use `reportError` if a tagged `[MelodyMap]` prefix is desired.
- Captured errors are transient: after being consumed via `consumeLastCapturedError()`, they are discarded, so callers must handle them immediately.
- Stack traces are truncated to 8 KB per error chain; extremely large cause chains will be silently clipped.
- No external log shipping, rotation, or aggregation is configured; logs are written to the process stdout/stderr provided by the runtime hosting the Nitro/TanStack Start server.