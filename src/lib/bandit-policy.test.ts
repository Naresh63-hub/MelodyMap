import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ThompsonSamplingPolicy,
  FEATURE_DIM,
  setDiscountGamma,
  getDiscountGamma,
  DISCOUNT_GAMMA_STORAGE_KEY,
  type SessionContext,
  type BanditModelState,
} from "./bandit-policy";
import { safeStorage } from "./safe-storage";
import { setRecFlag } from "./rec-flags";
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
      expect(winsAfter).toBeLessThan(35);
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
      expect(state.dimension).toBe(FEATURE_DIM);

      const newPolicy = new ThompsonSamplingPolicy();
      newPolicy.setModelState(state);

      const restoredState = newPolicy.getModelState();
      expect(restoredState.totalUpdates).toBe(1);
      expect(restoredState.f).toEqual(state.f);
      expect(restoredState.mu).toEqual(state.mu);
    });
  });

  describe("Circadian temporal context alignment (Time-based checking)", () => {
    it("at late night (hour 23 / 11 PM), prioritizes chill/acoustic melodies over high-energy dance tracks", () => {
      const chillTrack: TrackLike = {
        id: "night-chill-1",
        title: "Peaceful Midnight Lofi & Acoustic Melody",
        artist: "Calm Waves",
      };
      const highEnergyTrack: TrackLike = {
        id: "night-club-1",
        title: "Bass Boosted EDM Dance Workout Club Banger",
        artist: "Club DJ",
      };

      // Current local time: hour 23
      const nightContext: SessionContext = {
        hourOfDay: 23,
        discoveryPercent: 40,
      };

      // Test feature vector extraction: x1 is circadian alignment
      const featureChill = (policy as any).extractFeatureVector(chillTrack, nightContext);
      const featureHigh = (policy as any).extractFeatureVector(highEnergyTrack, nightContext);

      // Chill track gets maximum circadian score (1.0) at late night
      expect(featureChill[1]).toBe(1.0);
      // High-energy track gets low circadian score (0.2) at late night
      expect(featureHigh[1]).toBe(0.2);

      // Verify Thompson sampling ranking over 100 draws strongly favors the chill track at hour 23
      let chillWins = 0;
      for (let i = 0; i < 100; i++) {
        const top = policy.selectNextTrack([chillTrack, highEnergyTrack], nightContext);
        if (top?.id === chillTrack.id) chillWins++;
      }
      expect(chillWins).toBeGreaterThan(60);
    });

    it("at afternoon (hour 14 / 2 PM), prioritizes energizing focus tracks over slow night tracks", () => {
      const chillTrack: TrackLike = {
        id: "day-chill-1",
        title: "Sleep Midnight Ambient Melancholy",
        artist: "Ambient Artist",
      };
      const energizingTrack: TrackLike = {
        id: "day-energy-1",
        title: "Workout Drill Fast Beat Energy",
        artist: "Upbeat Band",
      };

      const afternoonContext: SessionContext = {
        hourOfDay: 14,
        discoveryPercent: 40,
      };

      const featureChill = (policy as any).extractFeatureVector(chillTrack, afternoonContext);
      const featureHigh = (policy as any).extractFeatureVector(energizingTrack, afternoonContext);

      // In the afternoon, energizing track gets 1.0 circadian score, chill gets 0.3
      expect(featureHigh[1]).toBe(1.0);
      expect(featureChill[1]).toBe(0.3);
    });
  });

  describe("Performance benchmark", () => {
    it("ranks 50 candidate tracks well under the performance target", () => {
      const bench = policy.benchmarkRanking(50);
      expect(bench.count).toBe(50);
      // Even in a slow test environment or CI container, 50 tracks should easily rank in < 50ms
      expect(bench.durationMs).toBeLessThan(50);
      console.log(`[Bandit Benchmark] 50 candidates ranked in ${bench.durationMs.toFixed(3)} ms`);
    });
  });

  describe("Discounted history", () => {
    it("keeps the precision matrix bounded instead of growing forever", () => {
      for (let i = 0; i < 500; i++) {
        policy.recordFeedback({
          id: `disc-${i}`,
          trackId: `t-${i}`,
          artist: "A",
          title: "T",
          eventType: "LIKED",
          positionSeconds: 0,
          durationSeconds: 200,
          fractionPlayed: 0,
          timestamp: Date.now(),
        });
      }
      // x0 is always 1, so B[0][0] -> λ + 1/(1-γ) = 101 (it would be ~501 without discounting)
      const b00 = policy.getModelState().B[0]![0]!;
      expect(b00).toBeLessThan(102);
      expect(b00).toBeGreaterThan(90);
    });

    it("allows switching gamma to 1.0 to disable discounting for baseline measurement", () => {
      setDiscountGamma(1.0);
      try {
        for (let i = 0; i < 20; i++) {
          policy.recordFeedback({
            id: `undisc-${i}`,
            trackId: `tu-${i}`,
            artist: "A",
            title: "T",
            eventType: "LIKED",
            positionSeconds: 0,
            durationSeconds: 200,
            fractionPlayed: 0,
            timestamp: Date.now(),
          });
        }
        // At gamma = 1.0, B[0][0] grows linearly: 1.0 + 20 = 21.0
        const b00 = policy.getModelState().B[0]![0]!;
        expect(b00).toBeCloseTo(21.0, 5);
      } finally {
        setDiscountGamma(0.99); // restore default
      }
    });

    it("persists setDiscountGamma to safeStorage and getDiscountGamma reads it", () => {
      const store: Record<string, string> = {};
      const winMock = {
        localStorage: {
          getItem: (k: string) => store[k] ?? null,
          setItem: (k: string, v: string) => { store[k] = String(v); },
          removeItem: (k: string) => { delete store[k]; },
          clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
        },
      };
      (globalThis as any).window = winMock;
      safeStorage.resetProbeForTest();
      try {
        setDiscountGamma(0.95);
        expect(getDiscountGamma()).toBe(0.95);
        expect(safeStorage.getItem(DISCOUNT_GAMMA_STORAGE_KEY)).toBe("0.95");
      } finally {
        delete (globalThis as any).window;
        safeStorage.resetProbeForTest();
        setDiscountGamma(0.99);
      }
    });
  });

  describe("Training on full track flag", () => {
    it("uses the id/title/artist stub when trainOnFullTrack is toggled off", () => {
      setRecFlag("trainOnFullTrack", false);
      const extractSpy = vi.spyOn(policy, "extractFeatureVector");
      try {
        const fullTrackData: TrackLike = {
          id: "track-123",
          title: "Full Title",
          artist: "Full Artist",
          album: "Full Album",
        };
        const ctx: SessionContext = {
          hourOfDay: 14,
          discoveryPercent: 40,
          stats: {
            "track-123": {
              track: fullTrackData,
              plays: 1,
              skips: 0,
              completions: 1,
            } as any,
          },
        };

        policy.recordFeedback(
          {
            id: "ev-1",
            trackId: "track-123",
            title: "Stub Title",
            artist: "Stub Artist",
            eventType: "COMPLETED",
            positionSeconds: 200,
            durationSeconds: 200,
            fractionPlayed: 1.0,
            timestamp: Date.now(),
          },
          ctx,
        );

        expect(extractSpy).toHaveBeenCalled();
        const calledTrack = extractSpy.mock.calls[0]?.[0];
        expect(calledTrack).toEqual({
          id: "track-123",
          title: "Stub Title",
          artist: "Stub Artist",
        });
        expect((calledTrack as any).album).toBeUndefined();
      } finally {
        extractSpy.mockRestore();
        setRecFlag("trainOnFullTrack", true);
      }
    });
  });
});
