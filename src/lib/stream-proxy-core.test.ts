import { describe, expect, it } from "vitest";

import {
  VIDEO_ID_REGEX,
  checkStreamRateLimit,
  extractClientIp,
  isAllowedOrigin,
  isAllowedUpstreamUrl,
  resolveAudioMimeType,
} from "./stream-proxy-core";

describe("VIDEO_ID_REGEX", () => {
  it("accepts standard YouTube ids", () => {
    expect(VIDEO_ID_REGEX.test("dQw4w9WgXcQ")).toBe(true);
  });

  it("accepts ids with dashes and underscores", () => {
    expect(VIDEO_ID_REGEX.test("a-b_c-d_e1")).toBe(true);
  });

  it("rejects empty, oversized, or malicious ids", () => {
    expect(VIDEO_ID_REGEX.test("")).toBe(false);
    expect(VIDEO_ID_REGEX.test("../../etc/passwd")).toBe(false);
    expect(VIDEO_ID_REGEX.test("a".repeat(33))).toBe(false);
    expect(VIDEO_ID_REGEX.test("<script>")).toBe(false);
  });
});

describe("isAllowedUpstreamUrl (SSRF guard)", () => {
  it("allows legitimate media hosts", () => {
    expect(isAllowedUpstreamUrl("https://rr1---sn-xyz.googlevideo.com/videoplayback?x=1")).toBe(true);
    expect(isAllowedUpstreamUrl("https://www.youtube.com/api/manifest")).toBe(true);
    expect(isAllowedUpstreamUrl("https://cdns-preview.dzcdn.net/stream/a.mp3")).toBe(true);
  });

  it("rejects non-https and non-media hosts", () => {
    expect(isAllowedUpstreamUrl("http://rr1---sn-xyz.googlevideo.com/videoplayback")).toBe(false);
    expect(isAllowedUpstreamUrl("https://evil.example.com/videoplayback")).toBe(false);
    expect(isAllowedUpstreamUrl("https://googlevideo.com.evil.example.com/x")).toBe(false);
    expect(isAllowedUpstreamUrl("not a url")).toBe(false);
  });
});

describe("isAllowedOrigin", () => {
  it("allows requests without an Origin header", () => {
    expect(isAllowedOrigin(null, "melodymap.example.com")).toBe(true);
    expect(isAllowedOrigin(undefined, undefined)).toBe(true);
  });

  it("allows exact same-origin", () => {
    expect(isAllowedOrigin("https://app.example.com", "app.example.com")).toBe(true);
  });

  it("allows localhost/LAN origin against localhost/LAN server (dev)", () => {
    expect(isAllowedOrigin("http://localhost:5173", "localhost:3000")).toBe(true);
    expect(isAllowedOrigin("http://192.168.1.5:5173", "10.0.0.2:3000")).toBe(true);
  });

  it("rejects cross-origin requests against a deployed host", () => {
    expect(isAllowedOrigin("https://evil.example.com", "app.example.com")).toBe(false);
    // The old hole: a localhost origin hotlinking a deployed proxy
    expect(isAllowedOrigin("http://localhost:5173", "melodymap-pi.vercel.app")).toBe(false);
    expect(isAllowedOrigin("http://192.168.1.5", "app.example.com")).toBe(false);
  });
});

describe("checkStreamRateLimit", () => {
  it("allows requests under the per-IP cap and blocks above it", () => {
    const ip = `test-ip-${Math.random()}`;
    for (let i = 0; i < 120; i++) {
      expect(checkStreamRateLimit(ip)).toBe(true);
    }
    expect(checkStreamRateLimit(ip)).toBe(false);
  });

  it("tracks IPs independently", () => {
    expect(checkStreamRateLimit(`a-${Math.random()}`)).toBe(true);
    expect(checkStreamRateLimit(`b-${Math.random()}`)).toBe(true);
  });
});

describe("extractClientIp", () => {
  it("prefers the first x-forwarded-for entry", () => {
    expect(
      extractClientIp((n) => (n === "x-forwarded-for" ? "1.1.1.1, 2.2.2.2" : null)),
    ).toBe("1.1.1.1");
  });

  it("falls back to x-real-ip then 'unknown'", () => {
    expect(extractClientIp((n) => (n === "x-real-ip" ? "3.3.3.3" : null))).toBe("3.3.3.3");
    expect(extractClientIp(() => null)).toBe("unknown");
  });
});

describe("resolveAudioMimeType", () => {
  it("trusts upstream mime when recognizable", () => {
    expect(resolveAudioMimeType("audio/mp4", "audio/webm; codecs=opus")).toBe("audio/webm");
    expect(resolveAudioMimeType("audio/webm", "audio/mp4")).toBe("audio/mp4");
  });

  it("falls back to the resolved format mime", () => {
    expect(resolveAudioMimeType("audio/webm", null)).toBe("audio/webm");
    expect(resolveAudioMimeType(null, null)).toBe("audio/mp4");
  });
});
