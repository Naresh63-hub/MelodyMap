import { describe, it, expect, vi, afterEach } from "vitest";
import { decryptSaavnMediaUrl, resolveSaavnById, resolveSaavnByMeta } from "./saavn";

describe("JioSaavn Provider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  describe("resolveSaavnById strict ID matching", () => {
    it("refuses to return a different song when requested cleanId is not in response", async () => {
      // Simulate JioSaavn returning a recommendation or related track with different ID
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({
          other_id_999: {
            id: "other_id_999",
            song: "Different Song",
            primary_artists: "Different Artist",
            encrypted_media_url: "ID2ieOjCrwfgWvL5sXl4B1ImC5QfbsDy0LUZ/zYaSt90L4I4ZDNuvNxnMB34o3dcPGAeA1atqZH8lIb48HU+oBw7tS9a8Gtq",
            duration: "210",
          },
        }),
      } as any);

      const result = await resolveSaavnById("target_id_123");
      // Must NOT return other_id_999!
      expect(result).toBeNull();
    });

    it("returns track when cleanId matches requested ID", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({
          target_id_123: {
            id: "target_id_123",
            song: "Correct Song",
            primary_artists: "Correct Artist",
            encrypted_media_url: "ID2ieOjCrwfgWvL5sXl4B1ImC5QfbsDy0LUZ/zYaSt90L4I4ZDNuvNxnMB34o3dcPGAeA1atqZH8lIb48HU+oBw7tS9a8Gtq",
            duration: "210",
          },
        }),
      } as any);

      const result = await resolveSaavnById("saavn:target_id_123");
      expect(result).not.toBeNull();
      expect(result?.title).toBe("Correct Song");
    });
  });
});
