import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import {
  VIDEO_ID_REGEX,
  isAllowedUpstreamUrl,
  isAllowedOrigin,
  resolveAudioMimeType,
} from "./stream-proxy-core";

/**
 * High-performance, secure streaming proxy for YouTube audio streams (Node / Vite Dev).
 * Handles Range requests (HTTP 206 Partial Content), audio format negotiation,
 * SSRF protection, and graceful resource cleanup on client disconnect.
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

  try {
    const { resolveStreamUrlWithMeta, invalidateStreamCache } = await import("./stream.server");
    let stream = await resolveStreamUrlWithMeta(videoId, quality);

    if (!stream || !stream.url || !isAllowedUpstreamUrl(stream.url)) {
      res.statusCode = 404;
      res.setHeader("content-type", "text/plain");
      res.end("Stream not found or invalid upstream");
      return;
    }

    const upstreamHeaders: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      Referer: "https://www.youtube.com/",
    };
    if (req.headers.range) {
      upstreamHeaders["Range"] = req.headers.range;
    }

    const controller = new AbortController();
    req.on("close", () => {
      controller.abort();
    });

    let upstreamRes = await fetch(stream.url, {
      headers: upstreamHeaders,
      signal: controller.signal,
    });

    // If 403, invalidate cache and retry once with a freshly resolved stream
    if (upstreamRes.status === 403) {
      console.warn(`[stream-proxy] 403 for ${videoId} in dev proxy, invalidating cache and retrying...`);
      invalidateStreamCache(videoId);
      stream = await resolveStreamUrlWithMeta(videoId, quality);
      if (stream && stream.url && isAllowedUpstreamUrl(stream.url)) {
        upstreamRes = await fetch(stream.url, {
          headers: upstreamHeaders,
          signal: controller.signal,
        });
      }
    }

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      invalidateStreamCache(videoId);
      res.statusCode = upstreamRes.status || 502;
      res.setHeader("content-type", "text/plain");
      res.end("Upstream stream fetch failed");
      return;
    }

    const mimeType = resolveAudioMimeType(stream?.mimeType, upstreamRes.headers.get("content-type"));

    res.statusCode = upstreamRes.status;
    res.setHeader("access-control-allow-origin", originHeader || "*");
    res.setHeader("access-control-allow-headers", "Range, Accept-Ranges, Content-Type");
    res.setHeader("access-control-expose-headers", "Content-Range, Content-Length, Accept-Ranges");
    res.setHeader("content-type", mimeType);
    res.setHeader("accept-ranges", "bytes");

    const contentRange = upstreamRes.headers.get("content-range");
    if (contentRange) res.setHeader("content-range", contentRange);

    const contentLength = upstreamRes.headers.get("content-length");
    if (contentLength) res.setHeader("content-length", contentLength);

    if (upstreamRes.body) {
      const nodeStream = Readable.fromWeb(
        upstreamRes.body as import("node:stream/web").ReadableStream,
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
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") return;
    console.error(`[stream-proxy] Error streaming ${videoId}:`, err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end("Internal stream proxy error");
    }
  }
}
