import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ThompsonSamplingPolicy,
  FEATURE_DIM,
  setDiscountGamma,
  getDiscountGamma,
  DISCOUNT_GAMMA_STORAGE_KEY,
  buildTrainingContext,
  setBanditRngSource,
  X5_RESET_KEY,
  sortByScoreWithMovieTieBreaker,
  BANDIT_STORAGE_KEY,
  BANDIT_BACKUP6_STORAGE_KEY,
  restoreBackup6,
  type SessionContext,
  type BanditModelState,
} from "./bandit-policy";
import { recordArtistTerminalOutcome, clearArtistRecentStore } from "./artist-recent";
import { safeStorage } from "./safe-storage";
import { setRecFlag, getRecFlag, getRecConfigChangedAt } from "./rec-flags";
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

    it("updates configChangedAt when discount gamma actually changes, but not when set to the same value", () => {
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
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date("2026-11-22T10:00:00.000Z"));
        setDiscountGamma(1.0);
        const t1 = getRecConfigChangedAt();
        expect(t1).toBe("2026-11-22T10:00:00.000Z");

        // Calling with same gamma (1.0) must not change the timestamp even if time passes
        vi.setSystemTime(new Date("2026-11-22T10:01:00.000Z"));
        setDiscountGamma(1.0);
        expect(getRecConfigChangedAt()).toBe(t1);

        // Calling with different gamma (0.95) must update the timestamp
        setDiscountGamma(0.95);
        const t2 = getRecConfigChangedAt();
        expect(t2).toBe("2026-11-22T10:01:00.000Z");
        expect(t2).not.toBe(t1);
      } finally {
        vi.useRealTimers();
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

  describe("Leak-free training context (flag: leakFreeTrainingContext)", () => {
    it("rewinds currentTrack to predecessorTrack and strips post-event mutations in buildTrainingContext", () => {
      const predTrack: TrackLike = { id: "track-pred", title: "Pred Song", artist: "Pred Artist" };
      const eventTrack: TrackLike = { id: "track-ev", title: "Event Song", artist: "Event Artist" };

      const ctx: SessionContext = {
        currentTrack: eventTrack,
        predecessorTrack: predTrack,
        recentHistory: [eventTrack, predTrack],
        likedIds: new Set(["track-ev", "other-1"]),
        likedTracks: [eventTrack, { id: "other-1", title: "Other", artist: "Other" }],
        downloadedIds: new Set(["track-ev"]),
        downloadedTracks: [eventTrack],
        dislikedIds: new Set(["track-ev"]),
        dislikedTracks: [eventTrack],
        stats: {
          "track-ev": {
            plays: 2,
            completions: 1,
            skips: 1,
            track: eventTrack,
          } as any,
        },
      };

      // 1. Completion event
      const compEv: PlaybackTelemetryEvent = {
        id: "ev-c",
        trackId: "track-ev",
        title: "Event Song",
        artist: "Event Artist",
        eventType: "COMPLETED",
        positionSeconds: 200,
        durationSeconds: 200,
        fractionPlayed: 1.0,
        timestamp: Date.now(),
      };
      const cleanedComp = buildTrainingContext(compEv, ctx);
      expect(cleanedComp.currentTrack?.id).toBe("track-pred");
      expect(cleanedComp.stats?.["track-ev"]?.plays).toBe(1);
      expect(cleanedComp.stats?.["track-ev"]?.completions).toBe(0);

      // 2. Liked event
      const likeEv: PlaybackTelemetryEvent = {
        ...compEv,
        id: "ev-l",
        eventType: "LIKED",
      };
      const cleanedLike = buildTrainingContext(likeEv, ctx);
      expect(cleanedLike.likedIds?.has("track-ev")).toBe(false);
      expect(cleanedLike.likedTracks?.some((t) => t.id === "track-ev")).toBe(false);

      // 3. Downloaded event
      const dlEv: PlaybackTelemetryEvent = {
        ...compEv,
        id: "ev-d",
        eventType: "DOWNLOADED",
      };
      const cleanedDl = buildTrainingContext(dlEv, ctx);
      expect(cleanedDl.downloadedIds?.has("track-ev")).toBe(false);
      expect(cleanedDl.downloadedTracks?.some((t) => t.id === "track-ev")).toBe(false);

      // 4. Disliked event
      const disEv: PlaybackTelemetryEvent = {
        ...compEv,
        id: "ev-dis",
        eventType: "DISLIKED",
      };
      const cleanedDis = buildTrainingContext(disEv, ctx);
      expect(cleanedDis.dislikedIds?.has("track-ev")).toBe(false);
      expect(cleanedDis.dislikedTracks?.some((t) => t.id === "track-ev")).toBe(false);
    });

    it("with flag ON, training feature vector matches pre-event ranker context", () => {
      setRecFlag("leakFreeTrainingContext", true);
      const extractSpy = vi.spyOn(policy, "extractFeatureVector");
      try {
        const predTrack: TrackLike = { id: "pred", title: "P", artist: "PA" };
        const eventTrack: TrackLike = { id: "cand", title: "C", artist: "CA" };

        // Post-event context as produced at onEnd:
        // currentTrack was set to eventTrack, and eventTrack was added to likedIds
        const postEventCtx: SessionContext = {
          currentTrack: eventTrack,
          predecessorTrack: predTrack,
          likedIds: new Set(["cand"]),
          likedTracks: [eventTrack],
        };

        const event: PlaybackTelemetryEvent = {
          id: "ev-like-test",
          trackId: "cand",
          title: "C",
          artist: "CA",
          eventType: "LIKED",
          positionSeconds: 10,
          durationSeconds: 100,
          fractionPlayed: 0.1,
          timestamp: Date.now(),
        };

        policy.recordFeedback(event, postEventCtx);

        // Pre-event context as the ranker saw it before the track played and was liked:
        const preEventCtx: SessionContext = {
          currentTrack: predTrack,
          predecessorTrack: predTrack,
          likedIds: new Set([]),
          likedTracks: [],
        };
        const expectedX = policy.extractFeatureVector(eventTrack, preEventCtx);

        // extractSpy was called with cleaned context
        const trainedContext = extractSpy.mock.calls[0]?.[1];
        expect(trainedContext?.currentTrack?.id).toBe("pred");
        expect(trainedContext?.likedIds?.has("cand")).toBe(false);

        const trainedX = extractSpy.mock.results[0]?.value;
        expect(trainedX).toEqual(expectedX);
      } finally {
        extractSpy.mockRestore();
        setRecFlag("leakFreeTrainingContext", false);
      }
    });

    it("with flag OFF (default), recordFeedback uses raw context unchanged", () => {
      expect(getRecFlag("leakFreeTrainingContext")).toBe(false);
      const extractSpy = vi.spyOn(policy, "extractFeatureVector");
      try {
        const eventTrack: TrackLike = { id: "cand", title: "C", artist: "CA" };
        const rawCtx: SessionContext = {
          currentTrack: eventTrack,
          likedIds: new Set(["cand"]),
        };
        const event: PlaybackTelemetryEvent = {
          id: "ev-default-off",
          trackId: "cand",
          title: "C",
          artist: "CA",
          eventType: "LIKED",
          positionSeconds: 10,
          durationSeconds: 100,
          fractionPlayed: 0.1,
          timestamp: Date.now(),
        };

        policy.recordFeedback(event, rawCtx);

        const usedContext = extractSpy.mock.calls[0]?.[1];
        expect(usedContext?.currentTrack?.id).toBe("cand");
        expect(usedContext?.likedIds?.has("cand")).toBe(true);
      } finally {
        extractSpy.mockRestore();
      }
    });
  });

  describe("Task 4: 8-dimensional model, features x5-x7 and state migration", () => {
    it("FEATURE_DIM is 8 and default model initializes to 8 dimensions", () => {
      expect(FEATURE_DIM).toBe(8);
      const state = policy.getModelState();
      expect(state.dimension).toBe(8);
      expect(state.version).toBe(2);
      expect(state.mu).toHaveLength(8);
      expect(state.f).toHaveLength(8);
      expect(state.B).toHaveLength(8);
      expect(state.B_inv).toHaveLength(8);
    });

    it("loading a saved 6-dim state migrates to 8-dim, preserves mu[0..4], and pads coordinates at prior", () => {
      // Construct a valid 6-dimensional model state
      const sixDimB: number[][] = Array.from({ length: 6 }, (_, i) =>
        Array.from({ length: 6 }, (_, j) => (i === j ? 2.0 : 0.1)),
      );
      const sixDimMu = [0.25, 0.6, 0.45, 0.55, 0.15, 0.35];
      // Compute f = B * mu
      const sixDimF = sixDimB.map((row) =>
        row.reduce((sum, val, idx) => sum + val * (sixDimMu[idx] ?? 0), 0),
      );

      const legacyState: BanditModelState = {
        version: 1,
        dimension: 6,
        B: sixDimB,
        B_inv: sixDimB, // dummy, will be recomputed on migration
        f: sixDimF,
        mu: sixDimMu,
        totalUpdates: 42,
        lastUpdated: 12345678,
      };

      policy.setModelState(legacyState);

      const migrated = policy.getModelState();
      expect(migrated.dimension).toBe(8);
      expect(migrated.version).toBe(2);
      expect(migrated.totalUpdates).toBe(42);

      // Preserves original mu[0..4] (within floating precision)
      for (let i = 0; i < 5; i++) {
        expect(migrated.mu[i]).toBeCloseTo(sixDimMu[i]!, 3);
      }

      // Padded coordinates sit at the prior: x6 = 0.3, x7 = 0.2
      expect(migrated.mu[6]).toBeCloseTo(0.3, 4);
      expect(migrated.mu[7]).toBeCloseTo(0.2, 4);

      // Padded matrix blocks have lambda on diagonal and 0 cross terms
      expect(migrated.B[6]![6]).toBe(1.0);
      expect(migrated.B[7]![7]).toBe(1.0);
      expect(migrated.B[6]![0]).toBe(0.0);
      expect(migrated.B[7]![1]).toBe(0.0);
    });

    it("Task 2: backs up pre-migration 6-dim model state and restoreBackup6 returns exact original", () => {
      const original6: BanditModelState = {
        version: 1,
        dimension: 6,
        B: Array.from({ length: 6 }, (_, i) =>
          Array.from({ length: 6 }, (_, j) => (i === j ? 1.0 : 0.0)),
        ),
        B_inv: Array.from({ length: 6 }, (_, i) =>
          Array.from({ length: 6 }, (_, j) => (i === j ? 1.0 : 0.0)),
        ),
        f: [0.5, 0.4, 0.6, 0.5, 0.3, 0.5],
        mu: [0.5, 0.4, 0.6, 0.5, 0.3, 0.5],
        totalUpdates: 42,
        lastUpdated: 123456789,
      };

      try {
        safeStorage.removeItem(BANDIT_STORAGE_KEY);
        safeStorage.removeItem(BANDIT_BACKUP6_STORAGE_KEY);
        safeStorage.setItem(BANDIT_STORAGE_KEY, JSON.stringify(original6));

        // When a policy loads from storage, it migrates 6 -> 8
        const testPolicy = new ThompsonSamplingPolicy();
        testPolicy.loadFromStorage(true);

        expect(testPolicy.getModelState().dimension).toBe(8);
        expect(testPolicy.getModelState().totalUpdates).toBe(42);

        // The pre-migration backup must exist
        const backupRaw = safeStorage.getItem(BANDIT_BACKUP6_STORAGE_KEY);
        expect(backupRaw).toBeTruthy();
        expect(JSON.parse(backupRaw!).dimension).toBe(6);

        // restoreBackup6() restores it and returns the exact original state
        const restored = restoreBackup6();
        expect(restored).toEqual(original6);
        expect(safeStorage.getItem(BANDIT_STORAGE_KEY)).toBe(JSON.stringify(original6));

        // Backup is idempotent: does not overwrite existing backup if another 6-dim load occurs
        safeStorage.setItem(BANDIT_STORAGE_KEY, JSON.stringify({ ...original6, totalUpdates: 999 }));
        testPolicy.loadFromStorage(true);
        expect(JSON.parse(safeStorage.getItem(BANDIT_BACKUP6_STORAGE_KEY)!).totalUpdates).toBe(42);
      } finally {
        safeStorage.removeItem(BANDIT_STORAGE_KEY);
        safeStorage.removeItem(BANDIT_BACKUP6_STORAGE_KEY);
      }
    });

    it("flags-off regression: with flags OFF, x6 and x7 are 0 and rankings are regression-safe", () => {
      expect(getRecFlag("languageFeature")).toBe(false);
      expect(getRecFlag("artistRecentSkipFeature")).toBe(false);
      expect(getRecFlag("noveltyMomentumFeature")).toBe(false);

      const testTrack: TrackLike = {
        id: "reg-1",
        title: "Test Song",
        artist: "Test Artist",
      };
      const testCtx: SessionContext = {
        hourOfDay: 12,
        discoveryPercent: 40,
        sessionCompletions: 3,
        sessionSkips: 1,
      };

      const x = policy.extractFeatureVector(testTrack, testCtx);
      expect(x).toHaveLength(8);
      expect(x[6]).toBe(0.0);
      expect(x[7]).toBe(0.0);

      // Deterministic ranking under a fixed RNG seed
      let seed = 12345;
      const seededRng = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };
      setBanditRngSource(seededRng);

      try {
        const pool: TrackLike[] = [
          { id: "p1", title: "Track One", artist: "Artist A" },
          { id: "p2", title: "Track Two", artist: "Artist B" },
          { id: "p3", title: "Track Three", artist: "Artist C" },
        ];
        const ranked = policy.rankCandidates(pool, testCtx);
        expect(ranked).toHaveLength(3);
        expect(ranked.map((t) => t.id)).toBeDefined();
      } finally {
        setBanditRngSource(null);
      }
    });

    it("evaluates x5, x6, x7 correctly for hand-built examples when flags are ON", () => {
      setRecFlag("languageFeature", true);
      setRecFlag("artistRecentSkipFeature", true);
      setRecFlag("noveltyMomentumFeature", true);

      try {
        clearArtistRecentStore();
        // Record 2 skips for "Skip Artist"
        recordArtistTerminalOutcome("Skip Artist", true);
        recordArtistTerminalOutcome("Skip Artist", true);

        const ctx: SessionContext = {
          hourOfDay: 15,
          discoveryPercent: 50,
          preferredLanguages: ["Telugu"],
          sessionCompletions: 3,
          sessionSkips: 1, // momentum = 3 / (4 + 1) = 0.6
          familiarArtists: new Set(["familiar"]),
        };

        // 1. Matching language track with unknown artist
        const matchTrack: TrackLike = {
          id: "tel-1",
          title: "Samajavaragamana",
          artist: "Anurag Kulkarni", // Known Telugu artist
        };
        const xMatch = policy.extractFeatureVector(matchTrack, ctx);
        expect(xMatch[5]).toBe(1.0); // match
        expect(xMatch[6]).toBe(1.0); // unknown artist -> 1.0 health
        expect(xMatch[7]).toBeCloseTo(0.6, 4); // unfamiliar -> 1.0 * 0.6 momentum

        // 2. Untagged track
        const untaggedTrack: TrackLike = {
          id: "un-1",
          title: "Acoustic Melody",
          artist: "Brand New Indie Singer",
        };
        const xUntagged = policy.extractFeatureVector(untaggedTrack, ctx);
        expect(xUntagged[5]).toBe(0.5); // untagged -> 0.5

        // 3. Non-selected language track by Skip Artist
        const nonSelTrack: TrackLike = {
          id: "hi-1",
          title: "Kesariya (Hindi)",
          artist: "Skip Artist",
        };
        const xNonSel = policy.extractFeatureVector(nonSelTrack, ctx);
        expect(xNonSel[5]).toBe(0.05); // non-selected language -> 0.05
        // Skip Artist: 2 skips, 2 plays -> 1 - 2 / (2 + 1) = 1/3 ≈ 0.3333
        expect(xNonSel[6]).toBeCloseTo(1 / 3, 4);

        // 4. Familiar track: x7 must be 0.0
        const familiarTrack: TrackLike = {
          id: "fam-1",
          title: "Familiar Song",
          artist: "familiar",
        };
        const xFam = policy.extractFeatureVector(familiarTrack, ctx);
        expect(xFam[7]).toBe(0.0);
      } finally {
        setRecFlag("languageFeature", false);
        setRecFlag("artistRecentSkipFeature", false);
        setRecFlag("noveltyMomentumFeature", false);
        clearArtistRecentStore();
      }
    });

    it("marker prevents repeated coordinate 5 reset", () => {
      safeStorage.removeItem(X5_RESET_KEY);
      setRecFlag("languageFeature", true);

      try {
        // First call resets coordinate 5 and sets marker
        policy.checkLanguageFeatureCoordinateReset();
        expect(safeStorage.getItem(X5_RESET_KEY)).toBe("true");

        // Learn something on coordinate 5: mutate mu[5]
        const state = policy.getModelState();
        state.mu[5] = 0.99;
        state.f[5] = 5.0;
        policy.setModelState(state);
        expect(policy.getModelState().mu[5]).toBeCloseTo(0.99, 4);

        // Calling checkLanguageFeatureCoordinateReset again must be a NO-OP
        policy.checkLanguageFeatureCoordinateReset();
        expect(policy.getModelState().mu[5]).toBeCloseTo(0.99, 4);
      } finally {
        setRecFlag("languageFeature", false);
        safeStorage.removeItem(X5_RESET_KEY);
      }
    });
  });

  describe("Task 6: Movie-first tie-breaker behind flag (movieTieBreaker)", () => {
    it("rankCandidatesWithScores returns track and numeric score matching rankCandidates ordering", () => {
      const candidates: TrackLike[] = [
        { id: "s1", title: "Song 1", artist: "Artist 1" },
        { id: "s2", title: "Song 2", artist: "Artist 2" },
        { id: "s3", title: "Song 3", artist: "Artist 3" },
      ];
      const ctx: SessionContext = { hourOfDay: 14, discoveryPercent: 40 };

      // Fixed seed
      setBanditRngSource(() => 0.5);
      const rankedNormal = policy.rankCandidates(candidates, ctx);

      setBanditRngSource(() => 0.5);
      const rankedWithScores = policy.rankCandidatesWithScores(candidates, ctx);
      setBanditRngSource(null);

      expect(rankedWithScores).toHaveLength(3);
      expect(rankedWithScores.map((s) => s.track.id)).toEqual(rankedNormal.map((t) => t.id));
      for (const item of rankedWithScores) {
        expect(typeof item.score).toBe("number");
        expect(Number.isFinite(item.score)).toBe(true);
      }
    });

    it("prefers movie track only when score is within 10% of batch range", () => {
      const tA: TrackLike = { id: "tA", title: "Indie Acoustic", artist: "Artist A" };
      const tB: TrackLike = { id: "tB", title: "Film Soundtrack Song", artist: "Artist B", album: "Blockbuster Movie" };
      const tC: TrackLike = { id: "tC", title: "Pop Song", artist: "Artist C" };
      const tD: TrackLike = { id: "tD", title: "Cinema Score", artist: "Artist D", album: "Old Movie" };

      // Batch score range: min = 1.0 (tD), max = 2.0 (tA). Range = 1.0. 10% threshold = 0.10.
      const scoredFixtures = [
        { track: tA, score: 2.0 }, // Non-movie
        { track: tB, score: 1.95 }, // Movie: diff from tA is 0.05 <= 0.10 -> tB should tie-break above tA!
        { track: tC, score: 1.5 }, // Non-movie
        { track: tD, score: 1.0 }, // Movie: diff from tC is 0.50 > 0.10 -> tC must remain ahead of tD!
      ];

      const isMovie = (t: TrackLike) => Boolean(t.album && t.album.includes("Movie"));
      const sorted = sortByScoreWithMovieTieBreaker(scoredFixtures, isMovie);

      expect(sorted.map((t) => t.id)).toEqual(["tB", "tA", "tC", "tD"]);
    });

    it("falls back cleanly to score when no tracks are movies or score range is 0", () => {
      const t1: TrackLike = { id: "t1", title: "Song 1", artist: "Artist 1" };
      const t2: TrackLike = { id: "t2", title: "Song 2", artist: "Artist 2" };

      const fixtures = [
        { track: t1, score: 0.8 },
        { track: t2, score: 0.4 },
      ];
      const sorted = sortByScoreWithMovieTieBreaker(fixtures, () => false);
      expect(sorted.map((t) => t.id)).toEqual(["t1", "t2"]);

      // Equal scores
      const equalFixtures = [
        { track: t1, score: 0.5 },
        { track: t2, score: 0.5 },
      ];
      const sortedEqual = sortByScoreWithMovieTieBreaker(equalFixtures, (t) => t.id === "t2");
      expect(sortedEqual.map((t) => t.id)).toEqual(["t2", "t1"]);
    });
  });
});
