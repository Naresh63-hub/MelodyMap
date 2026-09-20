/**
 * Shared core logic for audio stream proxying.
 * Used by the production Nitro route, the Vite dev server middleware, and the
 * SSR server entry — previously this logic was duplicated in all three places.
 */

export const VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{1,32}$/;

export type StreamQualityParam = "saver" | "standard" | "high";

/** Validate that the upstream URL is a legitimate Google/YouTube media endpoint */
export function isAllowedUpstreamUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host.endsWith(".googlevideo.com") ||
      host.endsWith(".youtube.com") ||
      host.endsWith(".ytimg.com") ||
      host.endsWith(".dzcdn.net") ||
      host === "googlevideo.com" ||
      host === "youtube.com" ||
      host === "dzcdn.net"
    );
  } catch {
    return false;
  }
}

function isLanHost(host: string): boolean {
  return (
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("192.168.") ||
    host.startsWith("10.") ||
    host.startsWith("[::1]") ||
    host === "::1"
  );
}

/**
 * Check if the incoming request origin is allowed.
 *
 * Allowed:
 *  - no Origin header (direct navigations / same-origin GETs without CORS)
 *  - exact same-origin (origin host === request host)
 *  - dev convenience: a localhost/LAN page talking to a localhost/LAN server
 *
 * Previously any localhost/LAN *origin* was accepted even against a deployed
 * host, which let third-party web pages on a visitor's machine hotlink the
 * proxy. That hole is closed: on a deployed host only same-origin passes.
 */
export function isAllowedOrigin(
  originHeader: string | null | undefined,
  hostHeader: string | null | undefined,
): boolean {
  if (!originHeader) return true;
  try {
    const originHost = new URL(originHeader).host.toLowerCase();
    if (hostHeader) {
      const requestHost = hostHeader.toLowerCase();
      if (originHost === requestHost) return true;
      if (isLanHost(requestHost) && isLanHost(originHost)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ─── Per-IP rate limiting ────────────────────────────────────────────

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_PER_IP = 120; // audio seeks trigger several range requests per track
const ipHits = new Map<string, number[]>();
let lastSweepAt = 0;

/** Sliding-window limiter keyed by client IP. Best-effort (per process). */
export function checkStreamRateLimit(ip: string, max: number = RATE_LIMIT_MAX_PER_IP): boolean {
  const now = Date.now();
  if (now - lastSweepAt > RATE_LIMIT_WINDOW_MS) {
    lastSweepAt = now;
    for (const [key, hits] of ipHits) {
      const alive = hits.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
      if (alive.length === 0) ipHits.delete(key);
      else ipHits.set(key, alive);
    }
  }
  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (hits.length >= max) {
    ipHits.set(ip, hits);
    return false;
  }
  hits.push(now);
  ipHits.set(ip, hits);
  return true;
}

/** Extract the best-effort client IP from request headers. */
export function extractClientIp(getHeader: (name: string) => string | null | undefined): string {
  const forwarded = getHeader("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return getHeader("x-real-ip")?.trim() || "unknown";
}

// ─── Shared upstream resolution + fetch ──────────────────────────────

const UPSTREAM_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export type UpstreamAudioResult =
  | { ok: true; upstream: Response; mimeType: string }
  | { ok: false; status: number; message: string };

/**
 * Resolve a verified upstream audio URL for `videoId` and fetch it.
 * Handles cache invalidation + one retry on upstream 403, validates the
 * upstream host (SSRF guard), and bounds the header phase with a timeout.
 * The returned Response body can be piped/streamed by the caller.
 */
export async function fetchUpstreamAudio(options: {
  videoId: string;
  quality: StreamQualityParam;
  rangeHeader?: string | null;
  /** Signal to abort when the client disconnects mid-stream (optional). */
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<UpstreamAudioResult> {
  const { videoId, quality, rangeHeader, signal, timeoutMs = 30_000 } = options;
  const { resolveStreamUrlWithMeta, invalidateStreamCache } = await import("./stream.server");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener("abort", onExternalAbort, { once: true });

  const upstreamHeaders: Record<string, string> = {
    "User-Agent": UPSTREAM_UA,
    Referer: "https://www.youtube.com/",
  };
  if (rangeHeader) upstreamHeaders["Range"] = rangeHeader;

  try {
    let stream = await resolveStreamUrlWithMeta(videoId, quality);
    if (!stream?.url || !isAllowedUpstreamUrl(stream.url)) {
      return { ok: false, status: 404, message: "Audio stream not found" };
    }

    let upstreamRes = await fetch(stream.url, {
      headers: upstreamHeaders,
      signal: controller.signal,
    });

    // Expired/throttled upstream URL — invalidate cache and retry once fresh
    if (upstreamRes.status === 403) {
      invalidateStreamCache(videoId);
      stream = await resolveStreamUrlWithMeta(videoId, quality);
      if (stream?.url && isAllowedUpstreamUrl(stream.url)) {
        upstreamRes = await fetch(stream.url, {
          headers: upstreamHeaders,
          signal: controller.signal,
        });
      }
    }

    // Headers are in — stop bounding the request; body streaming continues
    // (still abortable via the external disconnect signal).
    clearTimeout(timeoutId);

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      invalidateStreamCache(videoId);
      return { ok: false, status: upstreamRes.status || 502, message: "Upstream fetch failed" };
    }

    return {
      ok: true,
      upstream: upstreamRes,
      mimeType: resolveAudioMimeType(stream?.mimeType, upstreamRes.headers.get("content-type")),
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, status: 504, message: "Upstream stream request timed out" };
    }
    invalidateStreamCache(videoId);
    return { ok: false, status: 502, message: "Upstream fetch error" };
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", onExternalAbort);
  }
}

export function resolveAudioMimeType(
  candidateMime: string | null | undefined,
  upstreamMime: string | null | undefined,
): string {
  if (upstreamMime) {
    if (upstreamMime.includes("webm")) return "audio/webm";
    if (upstreamMime.includes("mp4") || upstreamMime.includes("m4a")) return "audio/mp4";
    if (upstreamMime.startsWith("audio/")) return upstreamMime;
  }
  return candidateMime || "audio/mp4";
}
