import { describe, it, expect } from "vitest";
import { buildMetricsExport } from "./rec-metrics-export";

describe("buildMetricsExport (Task 12)", () => {
  it("builds an export payload containing all 8 required fields", () => {
    const payload = buildMetricsExport({
      now: "2026-11-22T19:00:00.000Z",
      appVersion: "1.3.11",
      discountGamma: 0.99,
      configChangedAt: "2026-11-20T10:00:00.000Z",
      summary7: {
        "made-for-you": { starts: 10, earlySkips: 1, completions: 8, likes: 0, earlySkipRate: 0.1, completionRate: 0.8 },
      },
      summary30: {
        "made-for-you": { starts: 50, earlySkips: 5, completions: 40, likes: 2, earlySkipRate: 0.1, completionRate: 0.8 },
      },
      languageFeatureStd: { batches: 5, mean: 0.12 },
    });

    expect(payload).toHaveProperty("exportedAt", "2026-11-22T19:00:00.000Z");
    expect(payload).toHaveProperty("appVersion", "1.3.11");
    expect(payload).toHaveProperty("discountGamma", 0.99);
    expect(payload).toHaveProperty("flags");
    expect(payload.flags).toHaveProperty("singlePassRanking");
    expect(payload.flags).toHaveProperty("trainOnFullTrack");
    expect(payload.flags).toHaveProperty("leakFreeTrainingContext");
    expect(payload.flags).toHaveProperty("languageFeature");
    expect(payload.flags).toHaveProperty("artistRecentSkipFeature");
    expect(payload.flags).toHaveProperty("noveltyMomentumFeature");
    expect(payload.flags).toHaveProperty("movieTieBreaker");
    expect(payload.flags).toHaveProperty("tasteArtistMix");
    expect(payload.flags).toHaveProperty("languageQuotas");
    expect(payload.flags).toHaveProperty("webAudioEq");
    expect(payload).toHaveProperty("configChangedAt", "2026-11-20T10:00:00.000Z");
    expect(payload.summary7["made-for-you"]).toEqual({ starts: 10, earlySkips: 1, completions: 8, likes: 0, earlySkipRate: 0.1, completionRate: 0.8 });
    expect(payload.summary30["made-for-you"]).toEqual({ starts: 50, earlySkips: 5, completions: 40, likes: 2, earlySkipRate: 0.1, completionRate: 0.8 });
    expect(payload.languageFeatureStd).toEqual({ batches: 5, mean: 0.12 });
  });

  it("produces aggregate counts only with strictly zero tracks, titles, artists, or track IDs", () => {
    const payload = buildMetricsExport({
      summary7: {
        "made-for-you": { starts: 12, earlySkips: 2, completions: 10, likes: 1, earlySkipRate: 0.167, completionRate: 0.833 },
        search: { starts: 5, earlySkips: 0, completions: 5, likes: 0, earlySkipRate: 0, completionRate: 1 },
      },
    });

    // Check summaries contain only aggregate counters
    const s7 = JSON.stringify(payload.summary7);
    const s30 = JSON.stringify(payload.summary30);
    expect(s7).not.toContain("title");
    expect(s7).not.toContain("artist");
    expect(s7).not.toContain("trackId");
    expect(s30).not.toContain("title");
    expect(s30).not.toContain("artist");
    expect(s30).not.toContain("trackId");
  });

  it("handles null configChangedAt and defaults gracefully", () => {
    const payload = buildMetricsExport({
      configChangedAt: null,
    });
    expect(payload.configChangedAt).toBeNull();
    expect(payload.exportedAt).toBeDefined();
    expect(typeof payload.appVersion).toBe("string");
    expect(typeof payload.discountGamma).toBe("number");
    expect(payload.summary7).toBeDefined();
    expect(payload.summary30).toBeDefined();
    expect(payload.languageFeatureStd).toBeDefined();
  });
});
