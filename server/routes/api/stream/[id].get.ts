import { defineEventHandler, getRouterParam, getQuery, setHeaders, sendStream, createError } from "h3";
import { resolveStreamUrlWithMeta, invalidateStreamCache } from "../../../src/lib/stream.server";
import { VIDEO_ID_REGEX, isAllowedUpstreamUrl, isAllowedOrigin, resolveAudioMimeType } from "../../../src/lib/stream-proxy-core";

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
  const hostHeader = req?.headers?.host;

  if (!isAllowedOrigin(originHeader, hostHeader)) {
    throw createError({ statusCode: 403, statusMessage: "Forbidden origin" });
  }

  let stream = await resolveStreamUrlWithMeta(videoId, quality);
  if (!stream?.url || !isAllowedUpstreamUrl(stream.url)) {
    throw createError({ statusCode: 404, statusMessage: "Audio stream not found" });
  }

  const rangeHeader = req?.headers?.range;
  const upstreamHeaders: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    Referer: "https://www.youtube.com/",
  };
  if (rangeHeader) upstreamHeaders["Range"] = rangeHeader;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  let upstreamRes: Response | null = null;
  try {
    upstreamRes = await fetch(stream.url, {
      headers: upstreamHeaders,
      signal: controller.signal,
    });

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
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    invalidateStreamCache(videoId);
    throw createError({ statusCode: 502, statusMessage: "Upstream fetch error" });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!upstreamRes || (!upstreamRes.ok && upstreamRes.status !== 206)) {
    invalidateStreamCache(videoId);
    throw createError({ statusCode: upstreamRes?.status || 502, statusMessage: "Upstream fetch failed" });
  }

  const mimeType = resolveAudioMimeType(stream.mimeType, upstreamRes.headers.get("content-type"));
  
  setHeaders(event, {
    "Access-Control-Allow-Origin": originHeader || "*",
    "Access-Control-Allow-Headers": "Range, Accept-Ranges, Content-Type",
    "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges",
    "Content-Type": mimeType,
    "Accept-Ranges": "bytes",
  });

  const contentRange = upstreamRes.headers.get("content-range");
  if (contentRange) setHeaders(event, { "Content-Range": contentRange });

  const contentLength = upstreamRes.headers.get("content-length");
  if (contentLength) setHeaders(event, { "Content-Length": contentLength });

  if (upstreamRes.status === 206 && event.node?.res) {
    event.node.res.statusCode = 206;
  }

  return sendStream(event, upstreamRes.body as any);
});
