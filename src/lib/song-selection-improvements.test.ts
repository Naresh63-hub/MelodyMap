import { beforeEach, describe, expect, it } from "vitest";
import {
  calculateMoodCompatibility,
  ContextEngineSession,
  detectTrackEnergy,
  MOOD_ENVELOPES,
} from "./context-engine";
import {
  ThompsonSamplingPolicy,
  type SessionContext,
} from "./bandit-policy";
import type { TrackLike } from "./track-dedup";

describe("Song Selection Algorithm Improvements", () => {
  let engine: ContextEngineSession;
  let policy: ThompsonSamplingPolicy;

  beforeEach(() => {
    engine = new ContextEngineSession();
    engine.clearSessionPenalties();
    policy = new ThompsonSamplingPolicy();
    policy.resetModel();
  });

  describe("1. Fast-Skip Intra-Session Dampening", () => {
    const candidateArtist = "Fast Skipped Singer";
    const trackA: TrackLike = { id: "track-1", title: "Annoying Song", artist: candidateArtist };
    const trackB: TrackLike = { id: "track-2", title: "Another Song", artist: candidateArtist };

    it("immediately records fast skips (< 10s) into session penalized artists", () => {
      expect(engine.getSessionPenalizedArtists()).not.toContain(candidateArtist.toLowerCase());

      // User skips at 4 seconds
      engine.recordSkip(trackA, 4);

      expect(engine.getSessionPenalizedArtists()).toContain(candidateArtist.toLowerCase());
    });

    it("recordFastSkip helper adds artist immediately to session penalties", () => {
      const artist = "Quick Skip Artist";
      engine.recordFastSkip({ id: "fs-1", title: "Loud Intro", artist });
      expect(engine.getSessionPenalizedArtists()).toContain(artist.toLowerCase());
    });

    it("normal skips (> 10s) do not immediately trigger intra-session penalty on single occurrence", () => {
      const normalArtist = "Normal Skip Artist";
      engine.recordSkip({ id: "norm-1", title: "Okay Song", artist: normalArtist }, 20);
      expect(engine.getSessionPenalizedArtists()).not.toContain(normalArtist.toLowerCase());
    });

    it("getAffinityWeights immediately reflects fast-skipped artist in penalizedArtists and removes from affinity", () => {
      // Setup initial stats where artist had 1 play
      const stats = {
        "s-1": {
          plays: 2,
          skips: 0,
          completions: 2,
          track: trackA,
        },
      };

      // Before fast skip, artist is an affinity artist
      const initialAffinity = engine.getAffinityWeights(stats);
      expect(initialAffinity.affinityArtists).toContain(candidateArtist);

      // Now user fast-skips at 5 seconds
      engine.recordSkip(trackA, 5);

      const updatedAffinity = engine.getAffinityWeights(stats);
      expect(updatedAffinity.penalizedArtists).toContain(candidateArtist);
      expect(updatedAffinity.affinityArtists).not.toContain(candidateArtist);
    });

    it("calculateAffinityScore immediately drops score to 0.05 for session-penalized artists", () => {
      const initialScore = engine.calculateAffinityScore(trackB);
      expect(initialScore).toBeGreaterThanOrEqual(1.0);

      engine.recordFastSkip(trackA);

      const penalizedScore = engine.calculateAffinityScore(trackB);
      expect(penalizedScore).toBe(0.05);
    });

    it("clearSessionPenalties successfully clears active session penalties", () => {
      engine.recordFastSkip(trackA);
      expect(engine.getSessionPenalizedArtists().length).toBeGreaterThan(0);
      expect(engine.calculateAffinityScore(trackB)).toBe(0.05);

      engine.clearSessionPenalties();
      expect(engine.getSessionPenalizedArtists()).toHaveLength(0);
      // After session penalty is cleared, score returns to normal non-penalized baseline (> 0.5)
      expect(engine.calculateAffinityScore(trackB)).toBeGreaterThan(0.5);
    });
  });

  describe("2. Mood Anchor Locking", () => {
    it("recognizes all standard application mood envelopes", () => {
      expect(MOOD_ENVELOPES).toHaveProperty("chill");
      expect(MOOD_ENVELOPES).toHaveProperty("party");
      expect(MOOD_ENVELOPES).toHaveProperty("upbeat workout");
      expect(MOOD_ENVELOPES).toHaveProperty("romantic");
      expect(MOOD_ENVELOPES).toHaveProperty("focus");
      expect(MOOD_ENVELOPES).toHaveProperty("sad hours");
      expect(MOOD_ENVELOPES).toHaveProperty("late night");
      expect(MOOD_ENVELOPES).toHaveProperty("devotional");
    });

    it("calculateMoodCompatibility gives high scores to aligned energy & keywords", () => {
      // Chill mood with acoustic / chill energy
      const chillScore = calculateMoodCompatibility("chill", "chill", "Peaceful Acoustic Melodies");
      expect(chillScore).toBeGreaterThanOrEqual(0.85);

      // Party mood with high energy dance bangers
      const partyScore = calculateMoodCompatibility("party", "high", "Mass EDM Dance Club Remix");
      expect(partyScore).toBeGreaterThanOrEqual(0.85);

      // Romantic mood with soulful love melodies
      const romanticScore = calculateMoodCompatibility("romantic", "chill", "Sweet Love Duet Melody");
      expect(romanticScore).toBeGreaterThanOrEqual(0.85);
    });

    it("calculateMoodCompatibility penalizes discordant energy (e.g. party song in chill mood)", () => {
      const mismatchA = calculateMoodCompatibility("chill", "high", "Mass Hardstyle Trap Bass Banger");
      expect(mismatchA).toBeLessThanOrEqual(0.35);

      const mismatchB = calculateMoodCompatibility("party", "chill", "Sleep Deep Ambient Piano");
      expect(mismatchB).toBeLessThanOrEqual(0.35);
    });

    it("Thompson Sampling feature x1 locks to mood anchor when activeMood is provided in SessionContext", () => {
      const chillTrack: TrackLike = { id: "c-1", title: "Morning Lo-fi Rain", artist: "Chill Beatmaker" };
      const partyTrack: TrackLike = { id: "p-1", title: "Club EDM Mass Dance", artist: "DJ Electro" };

      // In afternoon (14:00), default circadian context prefers high energy.
      // But user explicitly sets activeMood to 'chill'!
      const chillMoodContext: SessionContext = {
        hourOfDay: 14,
        activeMood: "chill",
      };

      const xChill = policy.extractFeatureVector(chillTrack, chillMoodContext);
      const xParty = policy.extractFeatureVector(partyTrack, chillMoodContext);

      // x1 should strongly favor chillTrack over partyTrack despite it being 2 PM
      expect(xChill[1]!).toBeGreaterThan(xParty[1]!);
      expect(xChill[1]!).toBeGreaterThanOrEqual(0.8);
      expect(xParty[1]!).toBeLessThanOrEqual(0.35);

      // Conversely, if activeMood is 'party' at night (23:00) when circadian context is low energy
      const partyMoodContext: SessionContext = {
        hourOfDay: 23,
        activeMood: "party",
      };

      const xChillNight = policy.extractFeatureVector(chillTrack, partyMoodContext);
      const xPartyNight = policy.extractFeatureVector(partyTrack, partyMoodContext);

      expect(xPartyNight[1]!).toBeGreaterThan(xChillNight[1]!);
      expect(xPartyNight[1]!).toBeGreaterThanOrEqual(0.8);
    });

    it("rankTracks with activeMood ranks mood-consistent candidates first", () => {
      const tracks: TrackLike[] = [
        { id: "1", title: "Mass EDM Club Dance Remix", artist: "DJ Party" },
        { id: "2", title: "Acoustic Soft Melody", artist: "Chill Singer" },
      ];

      const rankedInChill = engine.rankTracks(tracks, null, undefined, "chill");
      expect(rankedInChill[0]?.id).toBe("2");

      const rankedInParty = engine.rankTracks(tracks, null, undefined, "party");
      expect(rankedInParty[0]?.id).toBe("1");
    });
  });

  describe("3. Markov Sequence Co-occurrence", () => {
    const artistA = "Seed Artist A";
    const artistB = "Followup Artist B";
    const artistC = "Unrelated Artist C";

    it("learns transition probabilities on track completion", () => {
      const trackA: TrackLike = { id: "a-1", title: "Hit A", artist: artistA };
      const trackB: TrackLike = { id: "b-1", title: "Hit B", artist: artistB };

      // Baseline transition affinity is neutral prior (0.5)
      expect(engine.getTransitionAffinity(artistA, artistB)).toBe(0.5);

      // Record multiple transitions from trackA to trackB
      engine.recordCompletion(trackB, trackA);
      engine.recordCompletion(trackB, trackA);
      engine.recordCompletion(trackB, trackA);

      // Transition affinity should now be boosted significantly
      const affinityAB = engine.getTransitionAffinity(artistA, artistB);
      expect(affinityAB).toBeGreaterThanOrEqual(0.8);

      // Top transitions from artistA should include artistB
      const topTrans = engine.getTopTransitions(artistA);
      expect(topTrans).toContain(artistB.toLowerCase());

      // Transition to an artist with no co-occurrence from A should be lower
      const affinityAC = engine.getTransitionAffinity(artistA, artistC);
      expect(affinityAC).toBeLessThan(affinityAB);
    });

    it("incorporates Markov sequence transition into Thompson Sampling feature x2", () => {
      const currentTrack: TrackLike = { id: "cur-1", title: "Current Song", artist: artistA };
      const candidateB: TrackLike = { id: "cand-b", title: "Next Melody", artist: artistB };
      const candidateC: TrackLike = { id: "cand-c", title: "Next Melody", artist: artistC };

      // Learn transitions A -> B
      engine.recordCompletion(candidateB, currentTrack);
      engine.recordCompletion(candidateB, currentTrack);

      const context: SessionContext = {
        currentTrack,
        transitionAffinity: (from, to) => engine.getTransitionAffinity(from, to),
      };

      const xB = policy.extractFeatureVector(candidateB, context);
      const xC = policy.extractFeatureVector(candidateC, context);

      // x2 incorporates Markov sequence affinity alongside energy flow
      expect(xB[2]!).toBeGreaterThan(xC[2]!);
    });
  });
});
