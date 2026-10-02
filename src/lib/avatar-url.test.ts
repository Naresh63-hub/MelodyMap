import { describe, it, expect } from "vitest";
import { isSafeAvatarUrl } from "./avatar-url";

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
