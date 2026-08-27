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

async function handleStreamProxy(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const PREFIX = "/api/stream/";
  if (!url.pathname.startsWith(PREFIX)) return null;

  const videoId = decodeURIComponent(url.pathname.slice(PREFIX.length));
  if (!videoId) return new Response("Missing video id", { status: 400 });

  const { resolveStreamUrlWithMeta } = await import("./lib/stream.server");
  const stream = await resolveStreamUrlWithMeta(videoId);
  if (!stream) return new Response("Stream not found", { status: 404 });

  // Use metadata from ytdl-core cache (contentLength, mimeType) when
  // available — avoids an extra round-trip HEAD probe.  Fall back to a
  // bounded probe only when the resolver didn't capture the size.
  const streamUrl = stream.url;
  let size: number | null = stream.contentLength;
  let type = stream.mimeType || "audio/mp4";

  if (size === null) {
    try {
      const head = await fetch(streamUrl, {
        headers: { Range: "bytes=0-0" },
        signal: AbortSignal.timeout(10_000),
      });
      if (head.ok || head.status === 206) {
        const total = head.headers.get("content-range")?.match(/\/(\d+)$/)?.[1];
        if (total) size = Number(total);
        type = head.headers.get("content-type") ?? type;
      }
    } catch {
      // fall through
    }
  }
  if (size === null) return new Response("Stream unavailable", { status: 502 });

  // Reject streams that are capped by YouTube (usually indicated by a tiny query parameter or by failing our chunking test)
  const isCapped = size > 2 * 1024 * 1024 && stream.url.match(/[?&]clen=(\d+)/) && Number(stream.url.match(/[?&]clen=(\d+)/)![1]) < size;
  if (isCapped) {
    console.error(`[stream-proxy] capped stream for ${videoId} (size ${size})`);
    return new Response("Capped stream url", { status: 502 });
  }
  const headers = new Headers();
  headers.set("content-type", type);
  headers.set("accept-ranges", "bytes");

  const parsed = /^bytes=(\d+)-(\d*)$/.exec(request.headers.get("range") ?? "");
  let status: number;

  if (parsed) {
    const start = Number(parsed[1]);
    const end = parsed[2] === "" ? size - 1 : Math.min(Number(parsed[2]), size - 1);
    if (start >= size || start > end) {
      return new Response("", {
        status: 416,
        headers: { "content-range": `bytes */${size}` },
      });
    }
    headers.set("content-range", `bytes ${start}-${end}/${size}`);
    headers.set("content-length", String(end - start + 1));
    status = 206;
  } else {
    headers.set("content-length", String(size));
    status = 200;
  }

  return new Response(chunkedBody(streamUrl, parsed ? Number(parsed[1]) : 0, size - 1, videoId), {
    status,
    headers,
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
