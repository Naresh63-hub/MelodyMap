import { describe, it, expect } from "vitest";
import { allocateLanguageQuotas, enforceLanguageQuotas } from "./language-quotas";

describe("language-quotas (Task 9)", () => {
  describe("allocateLanguageQuotas (Hare-Niemeyer with min-1 guarantee)", () => {
    it("allocates 90/10 ratio accurately across slots", () => {
      const langs = ["Telugu", "Hindi"];
      const weights = { Telugu: 90, Hindi: 10 };

      const q10 = allocateLanguageQuotas(langs, weights, 10);
      expect(q10).toEqual({ Telugu: 9, Hindi: 1 });

      const q20 = allocateLanguageQuotas(langs, weights, 20);
      expect(q20).toEqual({ Telugu: 18, Hindi: 2 });
    });

    it("allocates 70/30 ratio accurately", () => {
      const langs = ["Telugu", "Hindi"];
      const weights = { Telugu: 70, Hindi: 30 };

      const q10 = allocateLanguageQuotas(langs, weights, 10);
      expect(q10).toEqual({ Telugu: 7, Hindi: 3 });

      const q20 = allocateLanguageQuotas(langs, weights, 20);
      expect(q20).toEqual({ Telugu: 14, Hindi: 6 });
    });

    it("allocates across three languages proportionally", () => {
      const langs = ["Telugu", "Tamil", "Hindi"];
      const weights = { Telugu: 50, Tamil: 30, Hindi: 20 };

      const q10 = allocateLanguageQuotas(langs, weights, 10);
      expect(q10).toEqual({ Telugu: 5, Tamil: 3, Hindi: 2 });

      const q20 = allocateLanguageQuotas(langs, weights, 20);
      expect(q20).toEqual({ Telugu: 10, Tamil: 6, Hindi: 4 });
    });

    it("gives 0 quota to languages with weight 0", () => {
      const langs = ["Telugu", "Hindi", "English"];
      const weights = { Telugu: 80, Hindi: 20, English: 0 };

      const q10 = allocateLanguageQuotas(langs, weights, 10);
      expect(q10["Telugu"]).toBe(8);
      expect(q10["Hindi"]).toBe(2);
      expect(q10["English"]).toBe(0);
    });

    it("treats all-zero weights as equal weights across all languages", () => {
      const langs = ["Telugu", "Hindi"];
      const weights = { Telugu: 0, Hindi: 0 };

      const q10 = allocateLanguageQuotas(langs, weights, 10);
      expect(q10).toEqual({ Telugu: 5, Hindi: 5 });

      const langs3 = ["Telugu", "Tamil", "Hindi"];
      const weights3 = { Telugu: 0, Tamil: 0, Hindi: 0 };
      const q12 = allocateLanguageQuotas(langs3, weights3, 12);
      expect(q12).toEqual({ Telugu: 4, Tamil: 4, Hindi: 4 });
    });

    it("guarantees at least 1 slot to any language with weight > 0 when totalSlots >= numLanguages", () => {
      const langs = ["Telugu", "Hindi"];
      const weights = { Telugu: 99, Hindi: 1 };

      const q10 = allocateLanguageQuotas(langs, weights, 10);
      expect(q10["Hindi"]).toBeGreaterThanOrEqual(1);
      expect((q10["Telugu"] ?? 0) + (q10["Hindi"] ?? 0)).toBe(10);
    });

    it("handles empty languages or non-positive totalSlots gracefully", () => {
      expect(allocateLanguageQuotas([], { Telugu: 50 }, 10)).toEqual({});
      expect(allocateLanguageQuotas(["Telugu"], { Telugu: 50 }, 0)).toEqual({});
      expect(allocateLanguageQuotas(["Telugu"], { Telugu: 50 }, -5)).toEqual({});
    });
  });

  describe("enforceLanguageQuotas (filtering, refill and dedup survival)", () => {
    it("preserves exact quota when candidate pool has sufficient tracks for each language", () => {
      const candidates = [
        { id: "te1", title: "Telugu 1", artist: "Artist TE", languageCode: "te" },
        { id: "te2", title: "Telugu 2", artist: "Artist TE", languageCode: "te" },
        { id: "te3", title: "Telugu 3", artist: "Artist TE", languageCode: "te" },
        { id: "te4", title: "Telugu 4", artist: "Artist TE", languageCode: "te" },
        { id: "te5", title: "Telugu 5", artist: "Artist TE", languageCode: "te" },
        { id: "te6", title: "Telugu 6", artist: "Artist TE", languageCode: "te" },
        { id: "te7", title: "Telugu 7", artist: "Artist TE", languageCode: "te" },
        { id: "hi1", title: "Hindi 1", artist: "Artist HI", languageCode: "hi" },
        { id: "hi2", title: "Hindi 2", artist: "Artist HI", languageCode: "hi" },
        { id: "hi3", title: "Hindi 3", artist: "Artist HI", languageCode: "hi" },
      ];

      const quotas = { Telugu: 7, Hindi: 3 };
      const result = enforceLanguageQuotas(candidates, quotas, 10);
      expect(result).toHaveLength(10);
      const teluguCount = result.filter((t) => t.languageCode === "te").length;
      const hindiCount = result.filter((t) => t.languageCode === "hi").length;
      expect(teluguCount).toBe(7);
      expect(hindiCount).toBe(3);
    });

    it("refills from spare tracks of other languages when one language runs short", () => {
      const candidates = [
        { id: "te1", title: "Telugu 1", artist: "Artist TE", languageCode: "te" },
        { id: "te2", title: "Telugu 2", artist: "Artist TE", languageCode: "te" },
        { id: "te3", title: "Telugu 3", artist: "Artist TE", languageCode: "te" },
        { id: "te4", title: "Telugu 4", artist: "Artist TE", languageCode: "te" },
        { id: "te5", title: "Telugu 5", artist: "Artist TE", languageCode: "te" },
        { id: "te6", title: "Telugu 6", artist: "Artist TE", languageCode: "te" },
        { id: "te7", title: "Telugu 7", artist: "Artist TE", languageCode: "te" },
        { id: "te8", title: "Telugu 8", artist: "Artist TE", languageCode: "te" },
        { id: "te9", title: "Telugu 9", artist: "Artist TE", languageCode: "te" },
        // Only 1 Hindi track available, but quota is 3
        { id: "hi1", title: "Hindi 1", artist: "Artist HI", languageCode: "hi" },
      ];

      const quotas = { Telugu: 7, Hindi: 3 };
      const result = enforceLanguageQuotas(candidates, quotas, 10);
      expect(result).toHaveLength(10);
      const teluguCount = result.filter((t) => t.languageCode === "te").length;
      const hindiCount = result.filter((t) => t.languageCode === "hi").length;
      expect(hindiCount).toBe(1);
      // Shortfall of 2 Hindi tracks refilled from Telugu spares
      expect(teluguCount).toBe(9);
    });

    it("survives over-fetching and returns exact targetCount", () => {
      // 15 tracks over-fetched (~1.5x of 10)
      const candidates = Array.from({ length: 15 }, (_, i) => ({
        id: `te_${i}`,
        title: `Song ${i}`,
        artist: `Artist ${i}`,
        languageCode: i < 10 ? "te" : "hi",
      }));

      const quotas = { Telugu: 7, Hindi: 3 };
      const result = enforceLanguageQuotas(candidates, quotas, 10);
      expect(result).toHaveLength(10);
    });
  });
});
