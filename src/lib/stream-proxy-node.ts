import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import {
  VIDEO_ID_REGEX,
  isAllowedOrigin,
  checkStreamRateLimit,
  extractClientIp,
  fetchUpstreamAudio,
} from "./stream-proxy-core";

/**
 * High-performance, secure streaming proxy for YouTube audio streams (Node / Vite Dev).
 * Shared resolution/rate-limit/CORS logic lives in stream-proxy-core.ts.
 * Handles Range requests (HTTP 206 Partial Content) and graceful cleanup on
 * client disconnect.
 */
export async function streamProxyMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next?: () => void,
) {
  const url = req.url || "";
  const PREFIX = "/api/stream/";
  if (!url.startsWith(PREFIX)) {
    if (next) next();
    return;
  }

  const originHeader = req.headers.origin as string | undefined;
  const hostHeader = req.headers.host as string | undefined;
  if (!isAllowedOrigin(originHeader, hostHeader)) {
    res.statusCode = 403;
    res.setHeader("content-type", "text/plain");
    res.end("Forbidden origin");
    return;
  }

  const parsedUrl = new URL(url, "http://localhost");
  const rawId = parsedUrl.pathname.slice(PREFIX.length);
  const videoId = decodeURIComponent(rawId || "").trim();
  const quality = (parsedUrl.searchParams.get("quality") || "high") as "saver" | "standard" | "high";

  if (!videoId || !VIDEO_ID_REGEX.test(videoId)) {
    res.statusCode = 400;
    res.setHeader("content-type", "text/plain");
    res.end("Invalid or missing video id");
    return;
  }

  const ip = extractClientIp((name) => (req.headers[name] as string | undefined) ?? null);
  if (!checkStreamRateLimit(ip)) {
    res.statusCode = 429;
    res.setHeader("content-type", "text/plain");
    res.end("Too many stream requests");
    return;
  }

  // HEAD requests: resolve source and return headers only (no body).
  // Used by the client to detect the stream source without downloading audio.
  if (req.method === "HEAD") {
    const result = await fetchUpstreamAudio({
      videoId,
      quality,
      rangeHeader: null,
      signal: AbortSignal.timeout(15_000),
    });
    if (!result.ok) {
      res.statusCode = result.status;
      res.end();
      return;
    }
    res.statusCode = 200;
    res.setHeader("access-control-allow-origin", originHeader || "*");
    res.setHeader("vary", "Origin");
    res.setHeader("access-control-expose-headers", "Content-Range, Content-Length, Accept-Ranges, X-MelodyMap-Source");
    res.setHeader("content-type", result.mimeType);
    res.setHeader("accept-ranges", "bytes");
    res.setHeader("x-melodymap-source", result.source ?? "saavn");
    res.end();
    return;
  }

  // Abort upstream work when the client disconnects mid-stream
  const disconnectController = new AbortController();
  req.on("close", () => {
    disconnectController.abort();
  });

  const result = await fetchUpstreamAudio({
    videoId,
    quality,
    rangeHeader: (req.headers.range as string | undefined) ?? null,
    signal: disconnectController.signal,
  });

  if (!result.ok) {
    res.statusCode = result.status;
    res.setHeader("content-type", "text/plain");
    res.end(result.message);
    return;
  }

  res.statusCode = result.upstream.status;
  res.setHeader("access-control-allow-origin", originHeader || "*");
  res.setHeader("vary", "Origin");
  res.setHeader("access-control-allow-headers", "Range, Accept-Ranges, Content-Type");
  res.setHeader("access-control-expose-headers", "Content-Range, Content-Length, Accept-Ranges, X-MelodyMap-Source");
  res.setHeader("content-type", result.mimeType);
  res.setHeader("accept-ranges", "bytes");
  res.setHeader("x-melodymap-source", result.source ?? "youtube");

  const contentRange = result.upstream.headers.get("content-range");
  if (contentRange) res.setHeader("content-range", contentRange);

  const contentLength = result.upstream.headers.get("content-length");
  if (contentLength) res.setHeader("content-length", contentLength);

  if (result.upstream.body) {
    const nodeStream = Readable.fromWeb(
      result.upstream.body as import("node:stream/web").ReadableStream,
    );
    nodeStream.on("error", () => {
      if (!res.writableEnded) {
        try {
          res.end();
        } catch {}
      }
    });
    nodeStream.pipe(res);
    req.on("close", () => {
      try {
        nodeStream.destroy();
      } catch {}
    });
  } else {
    res.end();
  }
}
