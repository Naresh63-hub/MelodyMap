import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import {
  VIDEO_ID_REGEX,
  isAllowedOrigin,
  checkStreamRateLimit,
  extractClientIp,
  fetchUpstreamAudio,
} from "./lib/stream-proxy-core";

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

  // Capture once — consumeLastCapturedError() clears the record as a side effect,
  // so calling it twice lost the error the first time around.
  const captured = consumeLastCapturedError();
  console.error(captured ?? new Error(`h3 swallowed SSR error: ${body}`));
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
 * Fallback same-origin audio stream proxy. The dedicated Nitro route
 * (server/routes/api/stream/[id].get.ts) normally serves these requests first;
 * this path covers any deployment shape where the route layer is bypassed.
 * All resolution/CORS/rate-limit/retry logic is shared via stream-proxy-core.ts.
 */
async function handleStreamProxy(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const PREFIX = "/api/stream/";
  if (!url.pathname.startsWith(PREFIX)) return null;

  const originHeader = request.headers.get("origin");
  const hostHeader = request.headers.get("host");
  if (!isAllowedOrigin(originHeader, hostHeader)) {
    return new Response("Forbidden origin", { status: 403 });
  }

  const rawId = url.pathname.slice(PREFIX.length).split("?")[0];
  const videoId = decodeURIComponent(rawId ?? "").trim();
  const quality = (url.searchParams.get("quality") || "high") as "saver" | "standard" | "high";

  if (!videoId || !VIDEO_ID_REGEX.test(videoId)) {
    return new Response("Invalid or missing video id", { status: 400 });
  }

  const ip = extractClientIp((name) => request.headers.get(name));
  if (!checkStreamRateLimit(ip)) {
    return new Response("Too many stream requests", { status: 429 });
  }

  const result = await fetchUpstreamAudio({
    videoId,
    quality,
    rangeHeader: request.headers.get("range"),
  });
  if (!result.ok) {
    return new Response(result.message, { status: result.status });
  }

  const responseHeaders = new Headers();
  responseHeaders.set("access-control-allow-origin", originHeader || "*");
  responseHeaders.set("vary", "Origin");
  responseHeaders.set("access-control-allow-headers", "Range, Accept-Ranges, Content-Type");
  responseHeaders.set("access-control-expose-headers", "Content-Range, Content-Length, Accept-Ranges");
  responseHeaders.set("content-type", result.mimeType);
  responseHeaders.set("accept-ranges", "bytes");

  const contentRange = result.upstream.headers.get("content-range");
  if (contentRange) responseHeaders.set("content-range", contentRange);

  const contentLength = result.upstream.headers.get("content-length");
  if (contentLength) responseHeaders.set("content-length", contentLength);

  return new Response(result.upstream.body, {
    status: result.upstream.status,
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
