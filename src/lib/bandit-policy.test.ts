import { beforeEach, describe, expect, it } from "vitest";
import {
  ThompsonSamplingPolicy,
  type SessionContext,
  type BanditModelState,
} from "./bandit-policy";
import type { PlaybackTelemetryEvent } from "./telemetry";
import type { TrackLike } from "./track-dedup";

describe("ThompsonSamplingPolicy Recommender", () => {
  let policy: ThompsonSamplingPolicy;

  beforeEach(() => {
    policy = new ThompsonSamplingPolicy();
    policy.resetModel();
  });

  describe("Cold start behavior", () => {
    it("ranks candidates safely without NaN scores or runtime exceptions", () => {
      const candidates: TrackLike[] = [
        { id: "1", title: "Chill Morning Melody", artist: "Acoustic Band" },
        { id: "2", title: "Mass Beat Party Banger", artist: "Club DJ" },
        { id: "3", title: "Midnight Lo-fi Piano", artist: "Chill Pianist" },
      ];

      const context: SessionContext = {
        hourOfDay: 8,
        discoveryPercent: 40,
      };

      const ranked = policy.rankCandidates(candidates, context);
      expect(ranked).toHaveLength(3);
      expect(ranked.map((t) => t.id).sort()).toEqual(["1", "2", "3"]);
    });

    it("returns null when candidate pool is empty", () => {
      const top = policy.selectNextTrack([], {});
      expect(top).toBeNull();
    });

    it("returns the single track unchanged when candidate pool has size 1", () => {
      const track: TrackLike = { id: "1", title: "Solo Song", artist: "Solo Artist" };
      const ranked = policy.rankCandidates([track], {});
      expect(ranked[0]?.id).toBe("1");
    });
  });

  describe("Behavioral probability tests (as specified by user)", () => {
    it("repeated completions increase selection probability for candidates with similar contextual features", () => {
      const targetCandidate: TrackLike = {
        id: "target-1",
        title: "Summer Vibes Pop",
        artist: "Band A",
      };
      const alternateCandidate: TrackLike = {
        id: "alt-1",
        title: "Sunset Vibes Pop",
        artist: "Band B",
      };

      const initialContext: SessionContext = {
        hourOfDay: 14,
        discoveryPercent: 40,
        sessionCompletions: 0,
        sessionSkips: 0,
      };

      // Measure selection probability before training across N Monte Carlo draws
      const N_DRAWS = 100;
      let targetWinsBefore = 0;
      for (let i = 0; i < N_DRAWS; i++) {
        const top = policy.selectNextTrack([targetCandidate, alternateCandidate], initialContext);
        if (top?.id === targetCandidate.id) targetWinsBefore++;
      }

      // Initial baseline should be balanced
      expect(targetWinsBefore).toBeGreaterThan(25);
      expect(targetWinsBefore).toBeLessThan(75);

      // Simulate 8 successful track completions for the target candidate
      const trainedContext: SessionContext = {
        ...initialContext,
        sessionCompletions: 8,
        stats: {
          [targetCandidate.id]: {
            plays: 8,
            skips: 0,
            completions: 8,
            track: targetCandidate,
          },
        },
      };

      for (let i = 0; i < 8; i++) {
        const event: PlaybackTelemetryEvent = {
          id: `ev-comp-${i}`,
          trackId: targetCandidate.id,
          artist: targetCandidate.artist || "",
          title: targetCandidate.title || "",
          eventType: "COMPLETED",
          positionSeconds: 180,
          durationSeconds: 180,
          fractionPlayed: 1.0,
          timestamp: Date.now(),
          context: { hourOfDay: 14 },
        };
        policy.recordFeedback(event, trainedContext);
      }

      // Measure selection probability after training
      let targetWinsAfter = 0;
      for (let i = 0; i < N_DRAWS; i++) {
        const top = policy.selectNextTrack([targetCandidate, alternateCandidate], trainedContext);
        if (top?.id === targetCandidate.id) targetWinsAfter++;
      }

      // Selection frequency should increase significantly
      expect(targetWinsAfter).toBeGreaterThan(targetWinsBefore);
      expect(targetWinsAfter).toBeGreaterThan(60);
    });

    it("repeated early skips reduce selection probability for candidates with similar contextual features", () => {
      const candidateA: TrackLike = {
        id: "cand-a",
        title: "Summer Groove Pop",
        artist: "Groove Band",
      };
      const candidateB: TrackLike = {
        id: "cand-b",
        title: "Sunset Vibes Pop",
        artist: "Vibe Band",
      };

      const initialContext: SessionContext = {
        hourOfDay: 14,
        discoveryPercent: 40,
        sessionCompletions: 2,
        sessionSkips: 0,
      };

      // Measure selection frequency before skips across 100 Monte Carlo draws
      const N_DRAWS = 100;
      let winsBefore = 0;
      for (let i = 0; i < N_DRAWS; i++) {
        const top = policy.selectNextTrack([candidateA, candidateB], initialContext);
        if (top?.id === candidateA.id) winsBefore++;
      }

      // Initial baseline should be evenly matched (~50/50)
      expect(winsBefore).toBeGreaterThan(30);

      // Simulate aggressive early skips for candidateA
      const trainedContext: SessionContext = {
        ...initialContext,
        sessionSkips: 6,
        stats: {
          [candidateA.id]: {
            plays: 6,
            skips: 6,
            completions: 0,
            track: candidateA,
          },
        },
      };

      for (let i = 0; i < 6; i++) {
        const event: PlaybackTelemetryEvent = {
          id: `ev-skip-${i}`,
          trackId: candidateA.id,
          artist: candidateA.artist || "",
          title: candidateA.title || "",
          eventType: "SKIPPED",
          positionSeconds: 3,
          durationSeconds: 200,
          fractionPlayed: 0.015,
          timestamp: Date.now(),
          context: { hourOfDay: 14 },
        };
        policy.recordFeedback(event, trainedContext);
      }

      // Measure selection frequency after skips
      let winsAfter = 0;
      for (let i = 0; i < N_DRAWS; i++) {
        const top = policy.selectNextTrack([candidateA, candidateB], trainedContext);
        if (top?.id === candidateA.id) winsAfter++;
      }

      // Repeated early skips significantly reduce selection probability
      expect(winsAfter).toBeLessThan(winsBefore);
      expect(winsAfter).toBeLessThan(25);
    });
  });

  describe("Discovery preference modulation", () => {
    it("shifts feature x4 toward unfamiliar candidates when discovery slider is high", () => {
      const familiarTrack: TrackLike = { id: "fam-1", title: "Old Hit", artist: "Familiar Singer" };
      const novelTrack: TrackLike = { id: "nov-1", title: "New Wave", artist: "Unknown Debut" };

      const lowDiscoveryCtx: SessionContext = {
        discoveryPercent: 10,
        familiarArtists: new Set(["familiar singer"]),
      };

      const highDiscoveryCtx: SessionContext = {
        discoveryPercent: 90,
        familiarArtists: new Set(["familiar singer"]),
      };

      const x4FamiliarLow = policy.extractFeatureVector(familiarTrack, lowDiscoveryCtx)[4];
      const x4NovelLow = policy.extractFeatureVector(novelTrack, lowDiscoveryCtx)[4];

      const x4FamiliarHigh = policy.extractFeatureVector(familiarTrack, highDiscoveryCtx)[4];
      const x4NovelHigh = policy.extractFeatureVector(novelTrack, highDiscoveryCtx)[4];

      // At low discovery, familiar candidate gets higher x4
      expect(x4FamiliarLow!).toBeGreaterThan(x4NovelLow!);
      // At high discovery, novel candidate gets higher x4
      expect(x4NovelHigh!).toBeGreaterThan(x4FamiliarHigh!);
    });
  });

  describe("State persistence and recovery", () => {
    it("serializes and restores model state perfectly", () => {
      // Train model slightly
      const event: PlaybackTelemetryEvent = {
        id: "ev-train",
        trackId: "t-1",
        artist: "Test Artist",
        title: "Test Song",
        eventType: "LIKED",
        positionSeconds: 40,
        durationSeconds: 200,
        fractionPlayed: 0.2,
        timestamp: Date.now(),
      };
      policy.recordFeedback(event);

      const state: BanditModelState = policy.getModelState();
      expect(state.totalUpdates).toBe(1);
      expect(state.dimension).toBe(6);

      const newPolicy = new ThompsonSamplingPolicy();
      newPolicy.setModelState(state);

      const restoredState = newPolicy.getModelState();
      expect(restoredState.totalUpdates).toBe(1);
      expect(restoredState.f).toEqual(state.f);
      expect(restoredState.mu).toEqual(state.mu);
    });
  });

  describe("Performance benchmark", () => {
    it("ranks 50 candidate tracks well under the performance target", () => {
      const bench = policy.benchmarkRanking(50);
      expect(bench.count).toBe(50);
      // Even in a test environment with vitest overhead, 50 tracks should rank in < 15ms
      expect(bench.durationMs).toBeLessThan(15);
      console.log(`[Bandit Benchmark] 50 candidates ranked in ${bench.durationMs.toFixed(3)} ms`);
    });
  });
});
