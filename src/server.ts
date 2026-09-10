import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  const captured = consumeLastCapturedError();
  return new Response(renderErrorPage(captured ?? new Error(`h3 swallowed SSR error: ${body}`)), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

/**
 * Same-origin audio proxy. YouTube's stream URLs don't send CORS headers, so
 * the browser can't fetch the bytes directly — this pipes them through our
 * own origin. It also works around YouTube's throttled URLs, which answer
 * 403 to open-ended ranges ("bytes=0-") and to any single request larger
 * than ~1 MiB, so the file is streamed in small bounded chunks.
 *
 * Range requests are honored, so the <audio> element can seek, and plain
 * requests (offline downloads) get the full file with a real content-length
 * for progress bars.
 */

const CHUNK = 1024 * 1024; // 1 MiB — throttled URLs 403 beyond this per request

/** Yields the requested byte range in 1 MiB pieces, retrying each once. */
async function* upstreamChunks(
  url: string,
  start: number,
  end: number,
  videoId: string,
) {
  let pos = start;
  while (pos <= end) {
    const to = Math.min(pos + CHUNK - 1, end);
    let buf: ArrayBuffer | null = null;
    for (let attempt = 0; attempt < 2 && buf === null; attempt++) {
      const r = await fetch(url, { headers: { Range: `bytes=${pos}-${to}` } });
      if (r.ok || r.status === 206) {
        buf = await r.arrayBuffer();
      } else if (r.status === 403 && attempt === 1) {
        // Throttled / expired URL — invalidate the cache entry so the next
        // request gets a fresh URL instead of reusing this dead one.
        console.warn(`[stream-proxy] chunk ${pos}-${to} -> 403 (expired/throttled)`);
        const { invalidateStreamCache } = await import("./lib/stream.server");
        invalidateStreamCache(videoId);
        throw new Error("upstream chunk 403 (expired/throttled)");
      } else if (attempt === 1) {
        console.error(`[stream-proxy] chunk ${pos}-${to} -> ${r.status}`);
        throw new Error(`upstream chunk ${r.status}`);
      }
    }
    if (buf === null) throw new Error("upstream chunk failed");
    if (buf.byteLength === 0) return;
    yield new Uint8Array(buf);
    pos += buf.byteLength;
  }
}

function chunkedBody(
  url: string,
  start: number,
  end: number,
  videoId: string,
): ReadableStream<Uint8Array> {
  const iterator = upstreamChunks(url, start, end, videoId);
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await iterator.next();
        if (done) controller.close();
        else controller.enqueue(value);
      } catch (err) {
        controller.error(err);
      }
    },
    cancel() {
      void iterator.return?.();
    },
  });
}

const VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{1,32}$/;

function isAllowedUpstreamUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host.endsWith(".googlevideo.com") ||
      host.endsWith(".youtube.com") ||
      host.endsWith(".ytimg.com") ||
      host === "googlevideo.com" ||
      host === "youtube.com"
    );
  } catch {
    return false;
  }
}

async function handleStreamProxy(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const PREFIX = "/api/stream/";
  if (!url.pathname.startsWith(PREFIX)) return null;

  const rawId = url.pathname.slice(PREFIX.length).split("?")[0];
  const videoId = decodeURIComponent(rawId ?? "").trim();
  const quality = (url.searchParams.get("quality") || "high") as "saver" | "standard" | "high";

  if (!videoId || !VIDEO_ID_REGEX.test(videoId)) {
    return new Response("Invalid or missing video id", { status: 400 });
  }

  const { resolveStreamUrlWithMeta } = await import("./lib/stream.server");
  const stream = await resolveStreamUrlWithMeta(videoId, quality);
  if (!stream || !stream.url || !isAllowedUpstreamUrl(stream.url)) {
    return new Response("Stream not found or invalid upstream", { status: 404 });
  }

  const upstreamHeaders: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    Referer: "https://www.youtube.com/",
  };
  const rangeHeader = request.headers.get("range");
  if (rangeHeader) {
    upstreamHeaders["Range"] = rangeHeader;
  }

  const upstreamRes = await fetch(stream.url, {
    headers: upstreamHeaders,
  });

  if (!upstreamRes.ok && upstreamRes.status !== 206) {
    return new Response("Upstream stream fetch failed", { status: upstreamRes.status || 502 });
  }

  let mimeType = stream.mimeType || "audio/mp4";
  const upstreamMime = upstreamRes.headers.get("content-type");
  if (upstreamMime) {
    if (upstreamMime.includes("webm")) {
      mimeType = "audio/webm";
    } else if (upstreamMime.includes("mp4") || upstreamMime.includes("m4a")) {
      mimeType = "audio/mp4";
    } else if (upstreamMime.startsWith("audio/")) {
      mimeType = upstreamMime;
    }
  }

  const responseHeaders = new Headers();
  responseHeaders.set("access-control-allow-origin", "*");
  responseHeaders.set("access-control-allow-headers", "Range, Accept-Ranges, Content-Type");
  responseHeaders.set("access-control-expose-headers", "Content-Range, Content-Length, Accept-Ranges");
  responseHeaders.set("content-type", mimeType);
  responseHeaders.set("accept-ranges", "bytes");

  const contentRange = upstreamRes.headers.get("content-range");
  if (contentRange) responseHeaders.set("content-range", contentRange);

  const contentLength = upstreamRes.headers.get("content-length");
  if (contentLength) responseHeaders.set("content-length", contentLength);

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    headers: responseHeaders,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const proxied = await handleStreamProxy(request);
      if (proxied) return proxied;

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(error), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
