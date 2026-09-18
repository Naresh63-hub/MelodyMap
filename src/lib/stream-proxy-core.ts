/**
 * Shared core logic for audio stream proxying.
 * Used by both the production SSR server handler and the Vite dev server middleware.
 */

export const VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{1,32}$/;

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

/** Check if the incoming request origin is allowed (same-origin / local / localhost) */
export function isAllowedOrigin(originHeader: string | null | undefined, hostHeader: string | null | undefined): boolean {
  if (!originHeader) return true; // Direct navigation or same-origin without Origin header
  try {
    const parsed = new URL(originHeader);
    const originHost = parsed.host.toLowerCase();
    if (
      originHost.startsWith("localhost") ||
      originHost.startsWith("127.0.0.1") ||
      originHost.startsWith("192.168.") ||
      originHost.startsWith("10.") ||
      (hostHeader && originHost === hostHeader.toLowerCase())
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
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
