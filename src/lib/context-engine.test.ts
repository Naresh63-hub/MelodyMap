import { describe, expect, it } from "vitest";
import {
  applyDiscoveryDistribution,
  calculateEnergyCompatibility,
  ContextEngineSession,
  detectTrackEnergy,
  getTemporalContext,
} from "./context-engine";

describe("context-engine core recommendation algorithms", () => {
  describe("getTemporalContext", () => {
    it("returns morning context between 5:00 and 11:59", () => {
      const morningCtx = getTemporalContext(8);
      expect(morningCtx.timeOfDay).toBe("morning");
      expect(morningCtx.suggestedMoods).toContain("Acoustic");
      expect(morningCtx.promptContext).toContain("Morning");
    });

    it("returns afternoon context between 12:00 and 16:59", () => {
      const afternoonCtx = getTemporalContext(14);
      expect(afternoonCtx.timeOfDay).toBe("afternoon");
      expect(afternoonCtx.energy).toBe("high");
      expect(afternoonCtx.suggestedMoods).toContain("Focus");
    });

    it("returns evening context between 17:00 and 21:59", () => {
      const eveningCtx = getTemporalContext(19);
      expect(eveningCtx.timeOfDay).toBe("evening");
      expect(eveningCtx.suggestedMoods).toContain("Party");
    });

    it("returns night context between 22:00 and 4:59", () => {
      const nightCtx = getTemporalContext(23);
      expect(nightCtx.timeOfDay).toBe("night");
      expect(nightCtx.suggestedMoods).toContain("Sleep");
      expect(nightCtx.suggestedGenres).toContain("Night Lo-Fi");
    });
  });

  describe("detectTrackEnergy", () => {
    it("classifies chill songs correctly", () => {
      expect(detectTrackEnergy({ title: "In My Life - Acoustic Melody", artist: "Beatles" })).toBe("chill");
      expect(detectTrackEnergy({ title: "Midnight Lo-fi Chill Beats", artist: "Lofi Girl" })).toBe("chill");
      expect(detectTrackEnergy({ title: "Sad Piano Ballad", artist: "Unknown" })).toBe("chill");
    });

    it("classifies high-energy songs correctly", () => {
      expect(detectTrackEnergy({ title: "Mass Dance Party Club Remix", artist: "Anirudh" })).toBe("high");
      expect(detectTrackEnergy({ title: "EDM Bass Boost Workout Banger", artist: "DJ Snake" })).toBe("high");
      expect(detectTrackEnergy({ title: "Fast Drill Trap Beat", artist: "Rapper" })).toBe("high");
    });

    it("defaults to medium energy for regular pop/melodic songs without extreme keywords", () => {
      expect(detectTrackEnergy({ title: "Golden Hour", artist: "JVKE" })).toBe("medium");
    });
  });

  describe("calculateEnergyCompatibility", () => {
    it("gives bonus for matching energy", () => {
      expect(calculateEnergyCompatibility("chill", "chill")).toBeGreaterThan(0.2);
      expect(calculateEnergyCompatibility("high", "high")).toBeGreaterThan(0.2);
    });

    it("gives moderate score for adjacent transitions", () => {
      expect(calculateEnergyCompatibility("chill", "medium")).toBe(0.15);
      expect(calculateEnergyCompatibility("medium", "high")).toBe(0.15);
    });

    it("penalizes jarring leaps between chill and high energy", () => {
      expect(calculateEnergyCompatibility("chill", "high")).toBeLessThan(0);
      expect(calculateEnergyCompatibility("high", "chill")).toBeLessThan(0);
    });
  });

  describe("ContextEngineSession affinity & skip penalties", () => {
    it("penalizes repeatedly skipped artists", () => {
      const engine = new ContextEngineSession();
      const annoyingTrack = { id: "1", title: "Spam Song", artist: "Bad Singer" };

      // Initial baseline score
      const initialScore = engine.calculateAffinityScore(annoyingTrack);
      expect(initialScore).toBeGreaterThanOrEqual(1.0);

      // Skip twice
      engine.recordSkip(annoyingTrack);
      engine.recordSkip(annoyingTrack);

      const penalizedScore = engine.calculateAffinityScore(annoyingTrack);
      expect(penalizedScore).toBeLessThanOrEqual(0.05);
    });

    it("boosts completed songs and calculates affinity weights", () => {
      const engine = new ContextEngineSession();
      const goodTrack = { id: "2", title: "Soulful Song", artist: "Favorite Singer" };

      engine.recordCompletion(goodTrack);
      engine.recordCompletion(goodTrack);

      const affinity = engine.getAffinityWeights();
      expect(affinity.affinityArtists).toContain("Favorite Singer");
      expect(affinity.penalizedArtists).not.toContain("Favorite Singer");
    });

    it("computes stats-based affinity and penalized artists", () => {
      const engine = new ContextEngineSession();
      const mockStats = {
        "song-1": {
          plays: 5,
          skips: 0,
          completions: 4,
          track: { id: "1", title: "Hit", artist: "Sid Sriram" },
        },
        "song-2": {
          plays: 1,
          skips: 4,
          completions: 0,
          track: { id: "2", title: "Annoying", artist: "Skip Me" },
        },
      };

      const analysis = engine.getAffinityWeights(mockStats);
      expect(analysis.affinityArtists).toContain("Sid Sriram");
      expect(analysis.penalizedArtists).toContain("Skip Me");
    });
  });

  describe("applyDiscoveryDistribution", () => {
    const familiarTracks = [
      { id: "1", title: "Fam 1", artist: "Sid Sriram" },
      { id: "2", title: "Fam 2", artist: "Sid Sriram" },
      { id: "3", title: "Fam 3", artist: "Arijit Singh" },
    ];
    const exploreTracks = [
      { id: "4", title: "Exp 1", artist: "New Artist A" },
      { id: "5", title: "Exp 2", artist: "New Artist B" },
      { id: "6", title: "Exp 3", artist: "New Artist C" },
    ];
    const allTracks = [...familiarTracks, ...exploreTracks];
    const familiarList = ["Sid Sriram", "Arijit Singh"];

    it("prioritizes familiar tracks when discovery is low (10%)", () => {
      const distributed = applyDiscoveryDistribution(allTracks, familiarList, 10);
      const familiarCount = distributed.slice(0, 3).filter((t) => familiarList.includes(t.artist)).length;
      expect(familiarCount).toBeGreaterThanOrEqual(2);
    });

    it("prioritizes exploratory tracks when discovery is high (90%)", () => {
      const distributed = applyDiscoveryDistribution(allTracks, familiarList, 90);
      const exploreCount = distributed.slice(0, 3).filter((t) => !familiarList.includes(t.artist)).length;
      expect(exploreCount).toBeGreaterThanOrEqual(2);
    });
  });
});
