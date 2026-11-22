import { describe, it, expect } from "vitest";
import {
  allocateLanguageQuotas,
  enforceLanguageQuotas,
  selectTracksWithLanguageQuotas,
} from "./language-quotas";
import { getDynamicQueries } from "./music.functions";

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

  describe("Server flag defaults: languageQuotas absent => unchanged output", () => {
    const fixedCandidates = [
      { id: "cand-1", title: "Song 1", artist: "Artist 1", languageCode: "te" },
      { id: "cand-2", title: "Song 2", artist: "Artist 2", languageCode: "hi" },
      { id: "cand-3", title: "Song 3", artist: "Artist 3", languageCode: "hi" },
      { id: "cand-4", title: "Song 4", artist: "Artist 4", languageCode: "hi" },
      { id: "cand-5", title: "Song 5", artist: "Artist 5", languageCode: "hi" },
      { id: "cand-6", title: "Song 6", artist: "Artist 6", languageCode: "te" },
      { id: "cand-7", title: "Song 7", artist: "Artist 7", languageCode: "te" },
      { id: "cand-8", title: "Song 8", artist: "Artist 8", languageCode: "hi" },
      { id: "cand-9", title: "Song 9", artist: "Artist 9", languageCode: "te" },
      { id: "cand-10", title: "Song 10", artist: "Artist 10", languageCode: "hi" },
      { id: "cand-11", title: "Song 11", artist: "Artist 11", languageCode: "te" },
      { id: "cand-12", title: "Song 12", artist: "Artist 12", languageCode: "hi" },
      { id: "cand-13", title: "Song 13", artist: "Artist 13", languageCode: "te" },
      { id: "cand-14", title: "Song 14", artist: "Artist 14", languageCode: "te" },
    ];

    it("calling candidate selection without languageQuotas produces identical output to main (unmodified slice)", () => {
      const languages = ["Telugu", "Hindi"];
      const languageWeights = { Telugu: 90, Hindi: 10 };
      const count = 8;

      // On main, candidate selection without languageQuotas simply does candidates.slice(0, count)
      const expectedMainOutput = fixedCandidates.slice(0, count);

      // Call without languageQuotas (omitted/undefined)
      const outputAbsent = selectTracksWithLanguageQuotas(
        fixedCandidates,
        count,
        languages,
        languageWeights,
        undefined,
      );

      // Must match main exactly
      expect(outputAbsent).toEqual(expectedMainOutput);
      expect(outputAbsent.map((t) => t.id)).toEqual(expectedMainOutput.map((t) => t.id));

      // Also when explicitly false
      const outputFalse = selectTracksWithLanguageQuotas(
        fixedCandidates,
        count,
        languages,
        languageWeights,
        false,
      );
      expect(outputFalse).toEqual(expectedMainOutput);

      // When languageQuotas is true, it changes the order to fulfill 90/10 ratio
      const outputTrue = selectTracksWithLanguageQuotas(
        fixedCandidates,
        count,
        languages,
        languageWeights,
        true,
      );
      expect(outputTrue).not.toEqual(expectedMainOutput);
      const teluguCount = outputTrue.filter((t) => t.languageCode === "te").length;
      expect(teluguCount).toBe(7); // 90% of 8 slots = 7 Telugu
    });

    it("calling getDynamicQueries without languageQuotas produces identical query languages as main", () => {
      const languages = ["Telugu", "Hindi", "Tamil", "English"];
      const artists = ["Arijit Singh", "Sid Sriram"];
      const languageWeights = { Telugu: 90, Hindi: 10 };

      // On main, langs.slice(0, 3) was used for mood and supplementary queries: ["Telugu", "Hindi", "Tamil"]
      // Without languageQuotas, it must produce queries for Telugu, Hindi, and Tamil (not restricted by languageWeights)
      const resultWithoutQuota = getDynamicQueries(languages, artists, {
        mood: "Chill",
        languageWeights,
        languageQuotas: undefined,
      });

      const hasTamilInGeneral = resultWithoutQuota.newQueries.some((q) => q.startsWith("Tamil "));
      expect(hasTamilInGeneral).toBe(true);

      // When languageQuotas is true, only languages with positive allocated quotas are queried (Telugu, Hindi)
      const resultWithQuota = getDynamicQueries(languages, artists, {
        mood: "Chill",
        languageWeights,
        languageQuotas: true,
      });

      const hasTamilWithQuota = resultWithQuota.newQueries.some((q) => q.startsWith("Tamil "));
      expect(hasTamilWithQuota).toBe(false);
    });
  });
});
