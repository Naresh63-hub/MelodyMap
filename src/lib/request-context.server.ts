import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Request-scoped context (client IP etc.) propagated via AsyncLocalStorage.
 *
 * Only imported dynamically from server middleware so the node-only
 * `node:async_hooks` module never reaches a client bundle.
 */

type RequestContext = { clientIp: string };

const requestStorage = new AsyncLocalStorage<RequestContext>();

/** Run `fn` with request-scoped context (called from the request middleware). */
export function runWithRequestContext<T>(ctx: RequestContext, fn: () => Promise<T>): Promise<T> {
  return requestStorage.run(ctx, fn);
}

/**
 * Client IP of the current request, or "global" when unavailable
 * (e.g. cron work or runtimes without async context).
 */
export function getRequestClientIp(): string {
  return requestStorage.getStore()?.clientIp ?? "global";
}

/** Best-effort client IP extraction from a Request's headers. */
export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "global";
}
