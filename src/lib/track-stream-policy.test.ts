import { describe, expect, it } from "vitest";

import { hasFullLengthDirectSource, resolveTrackStreamUrl } from "./track-stream-policy";

/**
 * Regression policy: catalog tracks (plain YouTube IDs) advertise a Deezer
 * 30-SECOND preview as previewUrl. Honoring that URL directly bypasses the
 * stream proxy's full-length fallback chain (YouTube → Audius → preview),
 * which is why songs cut off at 0:30. Only genuinely full-length external
 * providers may keep their direct URL.
 */
describe("track-stream-policy", () => {
  it("marks external full-length providers as direct-source", () => {
    expect(hasFullLengthDirectSource("saavn:xyz789")).toBe(true);
    expect(hasFullLengthDirectSource("audius:abc")).toBe(true);
    expect(hasFullLengthDirectSource("jamendo:123")).toBe(true);
    expect(hasFullLengthDirectSource("archive:gate27")).toBe(true);
    expect(hasFullLengthDirectSource("podcast:ep-9")).toBe(true);
  });

  it("marks catalog (YouTube id) tracks as proxy-only", () => {
    expect(hasFullLengthDirectSource("dQw4w9WgXcQ")).toBe(false);
    expect(hasFullLengthDirectSource("9bZkp7q19f0")).toBe(false);
    expect(hasFullLengthDirectSource("")).toBe(false);
    expect(hasFullLengthDirectSource(null)).toBe(false);
    expect(hasFullLengthDirectSource(undefined)).toBe(false);
  });

  it("drops the Deezer preview so catalog tracks stream via the proxy", () => {
    const buildProxy = (id: string) => `/api/stream/${id}?quality=high`;
    const url = resolveTrackStreamUrl(
      { id: "9bZkp7q19f0", previewUrl: "https://cdns-preview-d.dzcdn.net/stream/30s.mp3" },
      buildProxy,
    );
    expect(url).toBe("/api/stream/9bZkp7q19f0?quality=high");
    expect(url).not.toContain("dzcdn");
  });

  it("keeps direct URLs for full-length providers", () => {
    const direct = "https://discoveryprovider.audius.co/v1/tracks/abc/stream?app_name=MelodyMap";
    const url = resolveTrackStreamUrl({ id: "audius:abc", previewUrl: direct }, () => "/api/stream/x");
    expect(url).toBe(direct);
  });

  it("falls back to the proxy when no direct URL exists", () => {
    const url = resolveTrackStreamUrl({ id: "abc123" }, () => "/api/stream/abc123?quality=high");
    expect(url).toBe("/api/stream/abc123?quality=high");
  });
});
