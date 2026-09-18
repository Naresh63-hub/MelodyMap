import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import {
  VIDEO_ID_REGEX,
  isAllowedUpstreamUrl,
  isAllowedOrigin,
  resolveAudioMimeType,
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
 * Same-origin audio stream proxy with SSRF & Origin protection and range handling.
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

  const { resolveStreamUrlWithMeta, invalidateStreamCache } = await import("./lib/stream.server");
  let stream = await resolveStreamUrlWithMeta(videoId, quality);
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  let upstreamRes: Response | null = null;
  try {
    upstreamRes = await fetch(stream.url, {
      headers: upstreamHeaders,
      signal: controller.signal,
    });

    // If upstream returns 403 Forbidden (e.g. expired or throttled stream URL), invalidate cache and retry once
    if (upstreamRes.status === 403) {
      console.warn(`[stream-proxy] Upstream 403 for ${videoId}, invalidating cache and retrying fresh stream...`);
      invalidateStreamCache(videoId);
      stream = await resolveStreamUrlWithMeta(videoId, quality);
      if (stream && stream.url && isAllowedUpstreamUrl(stream.url)) {
        upstreamRes = await fetch(stream.url, {
          headers: upstreamHeaders,
          signal: controller.signal,
        });
      }
    }
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      return new Response("Upstream stream request timed out", { status: 504 });
    }
    invalidateStreamCache(videoId);
    return new Response("Upstream stream fetch error", { status: 502 });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!upstreamRes || (!upstreamRes.ok && upstreamRes.status !== 206)) {
    invalidateStreamCache(videoId);
    return new Response("Upstream stream fetch failed", { status: upstreamRes?.status || 502 });
  }

  const mimeType = resolveAudioMimeType(stream?.mimeType, upstreamRes.headers.get("content-type"));

  const responseHeaders = new Headers();
  responseHeaders.set("access-control-allow-origin", originHeader || "*");
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
