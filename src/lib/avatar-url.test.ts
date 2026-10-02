import { describe, it, expect } from "vitest";
import { isSafeAvatarUrl, getSafeAvatarUrl } from "./avatar-url";

describe("isSafeAvatarUrl", () => {
  it("allows standard HTTPS image URLs", () => {
    expect(isSafeAvatarUrl("https://images.unsplash.com/photo-1598488035139-bdbb2231ce04")).toBe(true);
    expect(isSafeAvatarUrl("https://cdn.example.com/avatar.jpg?w=160&h=160")).toBe(true);
  });

  it("allows standard HTTP image URLs", () => {
    expect(isSafeAvatarUrl("http://example.com/avatar.png")).toBe(true);
  });

  it("allows safe local relative asset paths", () => {
    expect(isSafeAvatarUrl("/icons/icon-512.png")).toBe(true);
    expect(isSafeAvatarUrl("/avatars/default.svg")).toBe(true);
  });

  it("rejects dangerous javascript: schemes", () => {
    expect(isSafeAvatarUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeAvatarUrl("javascript://alert(1)")).toBe(false);
    expect(isSafeAvatarUrl("  javascript:/*comment*/alert(1)")).toBe(false);
  });

  it("rejects data: URIs (e.g. SVG or HTML payload injection)", () => {
    expect(isSafeAvatarUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeAvatarUrl("data:image/svg+xml;utf8,<svg onload=alert(1)>")).toBe(false);
  });

  it("rejects protocol-relative URLs", () => {
    expect(isSafeAvatarUrl("//attacker.com/avatar.png")).toBe(false);
    expect(isSafeAvatarUrl("/\\attacker.com/avatar.png")).toBe(false);
  });

  it("rejects non-web schemes", () => {
    expect(isSafeAvatarUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeAvatarUrl("vbscript:msgbox(1)")).toBe(false);
    expect(isSafeAvatarUrl("ftp://example.com/pic.jpg")).toBe(false);
  });

  it("handles null, undefined, empty, or whitespace-only inputs", () => {
    expect(isSafeAvatarUrl(null)).toBe(false);
    expect(isSafeAvatarUrl(undefined)).toBe(false);
    expect(isSafeAvatarUrl("")).toBe(false);
    expect(isSafeAvatarUrl("   ")).toBe(false);
  });
});

describe("getSafeAvatarUrl", () => {
  it("encodes and returns valid HTTPS and HTTP URLs", () => {
    expect(getSafeAvatarUrl("https://example.com/photo.png")).toBe("https://example.com/photo.png");
    expect(getSafeAvatarUrl("https://example.com/my avatar.png")).toBe("https://example.com/my%20avatar.png");
    expect(getSafeAvatarUrl("/icons/my avatar.png")).toBe("/icons/my%20avatar.png");
  });

  it("returns null for malicious or invalid URLs", () => {
    expect(getSafeAvatarUrl("javascript:alert(1)")).toBeNull();
    expect(getSafeAvatarUrl("data:text/html,<script>")).toBeNull();
    expect(getSafeAvatarUrl("//attacker.com/x.png")).toBeNull();
    expect(getSafeAvatarUrl(null)).toBeNull();
    expect(getSafeAvatarUrl(undefined)).toBeNull();
    expect(getSafeAvatarUrl("")).toBeNull();
  });
});
