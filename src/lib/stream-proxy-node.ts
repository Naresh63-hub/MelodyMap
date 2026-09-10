import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";

const VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{1,32}$/;
const RANGE_REGEX = /^bytes=\d*-\d*$/;

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

/**
 * High-performance, secure streaming proxy for YouTube audio streams.
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
    const { resolveStreamUrlWithMeta } = await import("./stream.server.ts");
    const stream = await resolveStreamUrlWithMeta(videoId, quality);

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

    const upstreamRes = await fetch(stream.url, {
      headers: upstreamHeaders,
      signal: controller.signal,
    });

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      res.statusCode = upstreamRes.status || 502;
      res.setHeader("content-type", "text/plain");
      res.end("Upstream stream fetch failed");
      return;
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

    res.statusCode = upstreamRes.status;
    res.setHeader("access-control-allow-origin", "*");
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
        upstreamRes.body as import("node:stream/web").ReadableStream
      );
      nodeStream.pipe(res);
      req.on("close", () => {
        nodeStream.destroy();
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
