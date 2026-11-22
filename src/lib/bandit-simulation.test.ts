import { beforeEach, afterEach, describe, expect, it } from "vitest";
import {
  ThompsonSamplingPolicy,
  setBanditRngSource,
  setDiscountGamma,
  getDiscountGamma,
  type SessionContext,
} from "./bandit-policy";
import { setRecFlag } from "./rec-flags";
import {
  recordArtistTelemetryEvent,
  clearArtistRecentStore,
} from "./artist-recent";
import type { PlaybackTelemetryEvent } from "./telemetry";
import type { TrackLike } from "./track-dedup";

/**
 * 32-bit deterministic seeded pseudo-random number generator (Mulberry32).
 */
function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

const SEEDS = [101, 202, 303, 404, 505];

describe("Contextual Bandit Synthetic-User Convergence Simulations", () => {
  beforeEach(() => {
    clearArtistRecentStore();
    setDiscountGamma(0.99);
  });

  afterEach(() => {
    setBanditRngSource(null);
    clearArtistRecentStore();
    setRecFlag("languageFeature", false);
    setRecFlag("artistRecentSkipFeature", false);
    setRecFlag("noveltyMomentumFeature", false);
    setDiscountGamma(0.99);
  });

  /**
   * Simulation 1: Telugu-Only Late-Night Listener
   *
   * User listens late at night (hour 23).
   * User's preference:
   *   - Chill Telugu tracks are completed (reward = 1.0)
   *   - Any other track (energetic Telugu, chill Hindi/English, upbeat non-Telugu) is fast-skipped (<10s, reward = -0.8).
   *
   * Calibration:
   * In a 60-round simulation, with 4 track types (1/4 target probability under random choice):
   * Initial 15 rounds explore with target selection ~25-35%.
   * In the final 25 rounds (rounds 35..60), the median target win rate across 5 seeds converges
   * above 60% (calibrated with a conservative threshold of >= 0.55 to avoid flaky runs).
   */
  it("Sim 1: converges to chill Telugu tracks for a late-night listener (median over 5 seeds)", () => {
    setRecFlag("languageFeature", true);

    const targetFractions: number[] = [];

    for (const seed of SEEDS) {
      const rng = mulberry32(seed);
      setBanditRngSource(rng);

      const policy = new ThompsonSamplingPolicy();
      policy.resetModel();

      type SimTrack = TrackLike & { languageCode?: string };
      const candidatePool: SimTrack[] = [
        { id: "te-chill-1", title: "Samajavaragamana", artist: "Anurag Kulkarni", languageCode: "te" },
        { id: "te-chill-2", title: "Inkem Inkem", artist: "Sid Sriram", languageCode: "te" },
        { id: "te-upbeat-1", title: "Dhamaka Mass Party Beat", artist: "Devi Sri Prasad", languageCode: "te" },
        { id: "te-upbeat-2", title: "Loud Fast Action Theme", artist: "S. Thaman", languageCode: "te" },
        { id: "hi-chill-1", title: "Tum Hi Ho (Hindi)", artist: "Arijit Singh", languageCode: "hi" },
        { id: "en-chill-1", title: "Late Night Soft Acoustic", artist: "Ed Sheeran", languageCode: "en" },
        { id: "hi-upbeat-1", title: "Saturday Night Club Song", artist: "Badshah", languageCode: "hi" },
        { id: "pa-upbeat-1", title: "Bhangra Dhol Party Mix", artist: "Karan Aujla", languageCode: "pa" },
      ];

      const ctx: SessionContext = {
        hourOfDay: 23,
        discoveryPercent: 40,
        preferredLanguages: ["Telugu"],
        sessionCompletions: 0,
        sessionSkips: 0,
        stats: {},
      };

      let targetWinsLast25 = 0;
      const totalRounds = 60;
      const evalWindowStart = 35;

      for (let r = 0; r < totalRounds; r++) {
        const ranked = policy.rankCandidates(candidatePool, ctx);
        const chosen = ranked[0]!;

        const isTarget = chosen.id.startsWith("te-chill");
        if (r >= evalWindowStart && isTarget) {
          targetWinsLast25++;
        }

        const isComplete = isTarget;
        if (isComplete) {
          ctx.sessionCompletions = (ctx.sessionCompletions ?? 0) + 1;
        } else {
          ctx.sessionSkips = (ctx.sessionSkips ?? 0) + 1;
        }

        const event: PlaybackTelemetryEvent = {
          id: `ev-sim1-${seed}-${r}`,
          trackId: chosen.id,
          title: chosen.title,
          artist: chosen.artist,
          eventType: isComplete ? "COMPLETED" : "SKIPPED",
          positionSeconds: isComplete ? 200 : 3,
          durationSeconds: 200,
          fractionPlayed: isComplete ? 1.0 : 0.015,
          timestamp: Date.now() + r * 1000,
        };

        policy.recordFeedback(event, ctx);
        ctx.currentTrack = chosen;
      }

      targetFractions.push(targetWinsLast25 / (totalRounds - evalWindowStart));
    }

    const med = median(targetFractions);
    // Over 5 seeds, the median fraction of chill Telugu tracks chosen in final rounds must exceed 55%
    expect(med).toBeGreaterThanOrEqual(0.55);
  });

  /**
   * Simulation 2: Taste-Flip After 100 Events
   *
   * Phase 1 (rounds 0..99): User loves Track A (Hindi Acoustic) and fast-skips Track B (Punjabi Beat).
   * Phase 2 (rounds 100..199): Taste flips 180 degrees. User loves Track B and fast-skips Track A.
   *
   * Comparison:
   * Policy Discounted: gamma = 0.99 (forgets past at rate (1 - 0.99) = 1% per step)
   * Policy Undiscounted: gamma = 1.0 (retains entire 100 skips of Track B indefinitely)
   *
   * Calibration:
   * During adaptation window (rounds 120..180), discounted policy adapts to Track B substantially
   * faster than gamma = 1.0. We assert median(picks_B_discounted) > median(picks_B_undiscounted).
   */
  it("Sim 2: gamma=0.99 adapts faster than gamma=1.0 after 100-event taste flip (median over 5 seeds)", () => {
    const discountedWins: number[] = [];
    const undiscountedWins: number[] = [];

    for (const seed of SEEDS) {
      const candidates: TrackLike[] = [
        { id: "track-A1", title: "Acoustic Melody A1", artist: "Artist A" },
        { id: "track-A2", title: "Soft Piano A2", artist: "Artist A" },
        { id: "track-B1", title: "Electro Dance B1", artist: "Artist B" },
        { id: "track-B2", title: "Club Bass B2", artist: "Artist B" },
      ];

      // Simulate discounted policy (gamma = 0.99)
      const rngDisc = mulberry32(seed);
      setBanditRngSource(rngDisc);
      setDiscountGamma(0.99);
      const policyDisc = new ThompsonSamplingPolicy();
      policyDisc.resetModel();

      // Simulate undiscounted policy (gamma = 1.0)
      const rngUndisc = mulberry32(seed);
      setBanditRngSource(rngUndisc);
      setDiscountGamma(1.0);
      const policyUndisc = new ThompsonSamplingPolicy();
      policyUndisc.resetModel();

      let discBCount = 0;
      let undiscBCount = 0;

      const totalRounds = 180;
      const flipPoint = 100;
      const measureStart = 120;

      for (let r = 0; r < totalRounds; r++) {
        const ctx: SessionContext = {
          hourOfDay: 14,
          discoveryPercent: 40,
        };

        // Step discounted
        setBanditRngSource(rngDisc);
        setDiscountGamma(0.99);
        const chosenDisc = policyDisc.rankCandidates(candidates, ctx)[0]!;

        // Step undiscounted
        setBanditRngSource(rngUndisc);
        setDiscountGamma(1.0);
        const chosenUndisc = policyUndisc.rankCandidates(candidates, ctx)[0]!;

        // User preference: before flip (r < 100), A is preferred; after flip (r >= 100), B is preferred
        const preferB = r >= flipPoint;

        const completeDisc = preferB ? chosenDisc.id.startsWith("track-B") : chosenDisc.id.startsWith("track-A");
        const completeUndisc = preferB ? chosenUndisc.id.startsWith("track-B") : chosenUndisc.id.startsWith("track-A");

        if (r >= measureStart) {
          if (chosenDisc.id.startsWith("track-B")) discBCount++;
          if (chosenUndisc.id.startsWith("track-B")) undiscBCount++;
        }

        // Record feedback for discounted policy
        setDiscountGamma(0.99);
        policyDisc.recordFeedback(
          {
            id: `ev-disc-${seed}-${r}`,
            trackId: chosenDisc.id,
            title: chosenDisc.title,
            artist: chosenDisc.artist,
            eventType: completeDisc ? "COMPLETED" : "SKIPPED",
            positionSeconds: completeDisc ? 200 : 3,
            durationSeconds: 200,
            fractionPlayed: completeDisc ? 1.0 : 0.015,
            timestamp: Date.now() + r * 1000,
          },
          ctx,
        );

        // Record feedback for undiscounted policy
        setDiscountGamma(1.0);
        policyUndisc.recordFeedback(
          {
            id: `ev-undisc-${seed}-${r}`,
            trackId: chosenUndisc.id,
            title: chosenUndisc.title,
            artist: chosenUndisc.artist,
            eventType: completeUndisc ? "COMPLETED" : "SKIPPED",
            positionSeconds: completeUndisc ? 200 : 3,
            durationSeconds: 200,
            fractionPlayed: completeUndisc ? 1.0 : 0.015,
            timestamp: Date.now() + r * 1000,
          },
          ctx,
        );
      }

      discountedWins.push(discBCount);
      undiscountedWins.push(undiscBCount);
    }

    const medDisc = median(discountedWins);
    const medUndisc = median(undiscountedWins);

    // Discounted policy with gamma=0.99 adapts to taste flip faster than gamma=1.0
    expect(medDisc).toBeGreaterThan(medUndisc);
  });

  /**
   * Simulation 3: Artist-Skipper (Verifying Coordinate x6 with artistRecentSkipFeature ON)
   *
   * Candidate pool contains:
   *   - Tracks by "Favorite Artist" (completed, reward = 1.0)
   *   - Tracks by "Skipped Artist" (early-skipped < 10s, reward = -0.8)
   *
   * With artistRecentSkipFeature ON:
   *   - Each skip of Skipped Artist records a negative outcome in artist-recent store.
   *   - Skipped Artist's skip health drops towards 0.09.
   *   - The bandit learns positive weight on x6 and strongly down-ranks Skipped Artist.
   *
   * Calibration:
   * In rounds 30..60 (after skip health updates), the median selection count for Skipped Artist
   * across 5 seeds must be <= 5 (out of 30 rounds, i.e. <= 16.7%).
   */
  it("Sim 3: artist recent skip feature (x6) suppresses chronically skipped artist (median over 5 seeds)", () => {
    setRecFlag("artistRecentSkipFeature", true);

    const skippedArtistPicks: number[] = [];

    for (const seed of SEEDS) {
      clearArtistRecentStore();
      const rng = mulberry32(seed);
      setBanditRngSource(rng);

      const policy = new ThompsonSamplingPolicy();
      policy.resetModel();

      const candidatePool: TrackLike[] = [
        { id: "fav-1", title: "Favorite Melody 1", artist: "Favorite Artist" },
        { id: "fav-2", title: "Favorite Melody 2", artist: "Favorite Artist" },
        { id: "fav-3", title: "Favorite Melody 3", artist: "Favorite Artist" },
        { id: "skip-1", title: "Annoying Track 1", artist: "Skipped Artist" },
        { id: "skip-2", title: "Annoying Track 2", artist: "Skipped Artist" },
        { id: "skip-3", title: "Annoying Track 3", artist: "Skipped Artist" },
      ];

      const ctx: SessionContext = {
        hourOfDay: 15,
        discoveryPercent: 40,
        sessionCompletions: 0,
        sessionSkips: 0,
      };

      let skipArtistPicksSecondHalf = 0;
      const totalRounds = 60;
      const evalWindowStart = 30;

      for (let r = 0; r < totalRounds; r++) {
        const ranked = policy.rankCandidates(candidatePool, ctx);
        const chosen = ranked[0]!;

        const isSkippedArtist = chosen.artist === "Skipped Artist";
        if (r >= evalWindowStart && isSkippedArtist) {
          skipArtistPicksSecondHalf++;
        }

        const isComplete = !isSkippedArtist;
        const event: PlaybackTelemetryEvent = {
          id: `ev-sim3-${seed}-${r}`,
          trackId: chosen.id,
          title: chosen.title,
          artist: chosen.artist,
          eventType: isComplete ? "COMPLETED" : "SKIPPED",
          positionSeconds: isComplete ? 200 : 4,
          durationSeconds: 200,
          fractionPlayed: isComplete ? 1.0 : 0.02,
          timestamp: Date.now() + r * 1000,
        };

        // Update telemetry / artist-recent store and bandit policy
        recordArtistTelemetryEvent(event);
        policy.recordFeedback(event, ctx);
      }

      skippedArtistPicks.push(skipArtistPicksSecondHalf);
    }

    const med = median(skippedArtistPicks);
    // In rounds 30-60 (30 total decisions), Skipped Artist should be picked at most 5 times
    expect(med).toBeLessThanOrEqual(5);
  });
});
