import { describe, it, expect } from "vitest";
import { decryptSaavnMediaUrl, searchSaavn, resolveSaavnByMeta } from "./saavn";

describe("JioSaavn Provider", () => {
  it("decrypts encrypted media URL to direct 320kbps CDN URL", () => {
    // Known test token for Kesariya
    const encrypted = "ID2ieOjCrwfgWvL5sXl4B1ImC5QfbsDy0LUZ/zYaSt90L4I4ZDNuvNxnMB34o3dcPGAeA1atqZH8lIb48HU+oBw7tS9a8Gtq";
    const direct320 = decryptSaavnMediaUrl(encrypted, "high");
    expect(direct320).toContain("https://aac.saavncdn.com/");
    expect(direct320).toContain("_320.mp4");

    const direct160 = decryptSaavnMediaUrl(encrypted, "standard");
    expect(direct160).toContain("_160.mp4");

    const direct96 = decryptSaavnMediaUrl(encrypted, "saver");
    expect(direct96).toContain("_96.mp4");
  });

  it("handles empty or invalid encrypted media URL gracefully", () => {
    expect(decryptSaavnMediaUrl("")).toBe("");
    expect(decryptSaavnMediaUrl("invalid_base64_data")).toBe("");
  });
});
