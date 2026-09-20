import { defineEventHandler, getRouterParam, getQuery, setHeaders, sendStream, createError } from "h3";
import {
  VIDEO_ID_REGEX,
  isAllowedOrigin,
  checkStreamRateLimit,
  extractClientIp,
  fetchUpstreamAudio,
} from "../../../src/lib/stream-proxy-core";

/**
 * Production audio stream proxy (Nitro route).
 * Resolution, CORS, rate limiting, and upstream retry logic are shared
 * with the dev middleware and SSR entry via stream-proxy-core.ts.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const videoId = decodeURIComponent(id || "").trim();
  const query = getQuery(event);
  const quality = (query.quality as "saver" | "standard" | "high") || "high";

  if (!videoId || !VIDEO_ID_REGEX.test(videoId)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid video id" });
  }

  const req = event.node?.req;
  const originHeader = req?.headers?.origin as string | undefined;
  const hostHeader = req?.headers?.host as string | undefined;

  if (!isAllowedOrigin(originHeader, hostHeader)) {
    throw createError({ statusCode: 403, statusMessage: "Forbidden origin" });
  }

  const ip = extractClientIp((name) => (req?.headers?.[name] as string | undefined) ?? null);
  if (!checkStreamRateLimit(ip)) {
    throw createError({ statusCode: 429, statusMessage: "Too many stream requests" });
  }

  const result = await fetchUpstreamAudio({
    videoId,
    quality,
    rangeHeader: (req?.headers?.range as string | undefined) ?? null,
  });

  if (!result.ok) {
    throw createError({ statusCode: result.status, statusMessage: result.message });
  }

  setHeaders(event, {
    "Access-Control-Allow-Origin": originHeader || "*",
    Vary: "Origin",
    "Access-Control-Allow-Headers": "Range, Accept-Ranges, Content-Type",
    "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges",
    "Content-Type": result.mimeType,
    "Accept-Ranges": "bytes",
  });

  const contentRange = result.upstream.headers.get("content-range");
  if (contentRange) setHeaders(event, { "Content-Range": contentRange });

  const contentLength = result.upstream.headers.get("content-length");
  if (contentLength) setHeaders(event, { "Content-Length": contentLength });

  if (result.upstream.status === 206 && event.node?.res) {
    event.node.res.statusCode = 206;
  }

  return sendStream(event, result.upstream.body as any);
});
