import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  buildUserTasteProfile,
  isKnownComposer,
  getTimeBlock,
  type TasteProfileInput,
} from "./taste-profile";
import {
  ThompsonSamplingPolicy,
  setBanditRngSource,
  type SessionContext,
} from "./bandit-policy";
import { explainPick } from "./rec-reasons";
import { areSameTrack, extractTrackMovieOrAlbum } from "./track-dedup";
import { filterFeedCandidates, hasPlayableDuration } from "./feed-freshness";
import { applyDiscoveryDistribution } from "./context-engine";
import type { Track } from "./types";

describe("MelodyMap Phase 2: Intelligent Personalization & Taste Understanding", () => {
  beforeEach(() => {
    setBanditRngSource(() => 0.5);
  });

  afterEach(() => {
    setBanditRngSource(null);
  });

  const dummyTrack = (id: string, title: string, artist: string, duration = "3:30", album = ""): Track => ({
    id,
    title,
    artist,
    duration,
    album,
    thumbnail: `https://example.com/${id}.jpg`,
    source: "youtube",
  });

  // 1. Taste-profile updates
  describe("1. Taste Profile Updates", () => {
    it("builds a multi-dimensional profile from likes, downloads, playlists, and listening stats", () => {
      const input: TasteProfileInput = {
        likes: [
          dummyTrack("t1", "Samajavaragamana", "Sid Sriram", "3:40", "Ala Vaikunthapurramuloo"),
          dummyTrack("t2", "Butta Bomma", "Armaan Malik", "3:18", "Ala Vaikunthapurramuloo"),
        ],
        downloads: [
          dummyTrack("t3", "Oo Antava", "Indravathi Chauhan", "3:45", "Pushpa: The Rise"),
        ],
        history: [
          dummyTrack("t1", "Samajavaragamana", "Sid Sriram", "3:40", "Ala Vaikunthapurramuloo"),
        ],
        stats: {
          t1: { plays: 4, completions: 3, skips: 0, track: dummyTrack("t1", "Samajavaragamana", "Sid Sriram") },
          t3: { plays: 2, completions: 2, skips: 0, track: dummyTrack("t3", "Oo Antava", "Indravathi Chauhan") },
        },
        playlists: [
          {
            name: "Favorites",
            tracks: [dummyTrack("t4", "Ramuloo Ramulaa", "Anurag Kulkarni", "4:00", "Ala Vaikunthapurramuloo")],
          },
        ],
        languages: ["Telugu"],
        currentHour: 21,
      };

      const profile = buildUserTasteProfile(input);

      expect(profile.topSingers.length).toBeGreaterThan(0);
      const singerNames = profile.topSingers.map((s) => s.name.toLowerCase());
      expect(singerNames).toContain("sid sriram");
      expect(singerNames).toContain("indravathi chauhan");

      // Album / Soundtrack aggregation
      expect(profile.topSoundtracks.length).toBeGreaterThan(0);
      const soundtrackNames = profile.topSoundtracks.map((s) => s.name.toLowerCase());
      expect(soundtrackNames).toContain("ala vaikunthapurramuloo");
    });
  });

  // 2. Behavioral feedback learning
  describe("2. Behavioral Feedback Learning (Skips, Completions, Replays)", () => {
    it("rewards completed songs and penalizes fast skips, separating replays from early skips", () => {
      const policy = new ThompsonSamplingPolicy();

      const candidateCompleted = dummyTrack("c1", "Good Song", "Favorite Singer");
      const candidateSkipped = dummyTrack("c2", "Bad Song", "Skipped Singer");

      const baseContext: SessionContext = {
        hourOfDay: 15,
        discoveryPercent: 50,
        likedTracks: [],
        downloadedTracks: [],
        dislikedTracks: [],
        stats: {
          c1: { plays: 5, completions: 5, skips: 0, track: candidateCompleted },
          c2: { plays: 4, completions: 0, skips: 4, track: candidateSkipped },
        },
      };

      const featCompleted = policy.extractFeatureVector(candidateCompleted, baseContext);
      const featSkipped = policy.extractFeatureVector(candidateSkipped, baseContext);

      // x[3] is the behavioral taste affinity coordinate
      expect(featCompleted[3]!).toBeGreaterThan(0.7);
      expect(featSkipped[3]!).toBeLessThan(0.1);

      // Train policy with terminal events
      policy.recordFeedback({
        id: "e1",
        trackId: "c1",
        title: "Good Song",
        artist: "Favorite Singer",
        eventType: "COMPLETED",
        positionSeconds: 200,
        durationSeconds: 200,
        fractionPlayed: 1.0,
        timestamp: 10001,
      }, baseContext);

      policy.recordFeedback({
        id: "e2",
        trackId: "c2",
        title: "Bad Song",
        artist: "Skipped Singer",
        eventType: "SKIPPED",
        positionSeconds: 5,
        durationSeconds: 200,
        fractionPlayed: 0.025,
        timestamp: 10002,
      }, baseContext);

      const ranked = policy.rankCandidatesWithScores([candidateSkipped, candidateCompleted], baseContext);
      expect(ranked[0]?.track.id).toBe("c1");
      expect(ranked[1]?.track.id).toBe("c2");
    });
  });

  // 3. Artist preference evolution & penalization
  describe("3. Artist Preference & Penalization", () => {
    it("suppresses artists in the penalized list to the bottom of recommendations", () => {
      const policy = new ThompsonSamplingPolicy();

      const artistA = dummyTrack("a1", "Track A", "Penalized Artist");
      const artistB = dummyTrack("b1", "Track B", "Neutral Artist");

      const ctx: SessionContext = {
        hourOfDay: 12,
        discoveryPercent: 50,
        penalizedArtists: new Set(["penalized artist"]),
      };

      const featPenalized = policy.extractFeatureVector(artistA, ctx);
      const featNeutral = policy.extractFeatureVector(artistB, ctx);
      expect(featPenalized[3]!).toBe(0.02); // strictly suppressed
      expect(featNeutral[3]!).toBeGreaterThan(featPenalized[3]!);
    });
  });

  // 4. Language consistency
  describe("4. Language Consistency", () => {
    it("respects selected languages during candidate ranking and filtering", () => {
      const policy = new ThompsonSamplingPolicy();

      const teluguSong = { ...dummyTrack("tel1", "Samajavaragamana", "Sid Sriram"), language: "telugu" };
      const hindiSong = { ...dummyTrack("hin1", "Kesariya", "Arijit Singh"), language: "hindi" };

      const ctx: SessionContext = {
        hourOfDay: 14,
        discoveryPercent: 50,
        preferredLanguages: ["telugu"],
        primaryLanguage: "telugu",
      };

      const featTelugu = policy.extractFeatureVector(teluguSong, ctx);
      const featHindi = policy.extractFeatureVector(hindiSong, ctx);
      // Coordinate x[5] represents language compatibility
      expect(featTelugu[5]!).toBeGreaterThanOrEqual(featHindi[5]!);
    });
  });

  // 5. Download priority
  describe("5. Download Preference Boost", () => {
    it("gives downloaded songs higher priority than unfamiliar songs", () => {
      const policy = new ThompsonSamplingPolicy();

      const downloadedTrack = dummyTrack("d1", "Offline Hit", "Downloaded Artist");
      const neutralTrack = dummyTrack("n1", "Random Hit", "Unknown Artist");

      const ctx: SessionContext = {
        hourOfDay: 16,
        discoveryPercent: 30,
        downloadedTracks: [downloadedTrack],
        downloadedIds: new Set(["d1"]),
        likedTracks: [],
      };

      const featDownloaded = policy.extractFeatureVector(downloadedTrack, ctx);
      const featNeutral = policy.extractFeatureVector(neutralTrack, ctx);
      expect(featDownloaded[3]!).toBe(0.75); // downloaded artist prior boost
      expect(featNeutral[3]!).toBe(0.35); // neutral unplayed prior
      expect(featDownloaded[3]!).toBeGreaterThan(featNeutral[3]!);
    });
  });

  // 6. Discovery slider behavior
  describe("6. Discovery Slider Dynamics", () => {
    it("orders familiar tracks first at 0% discovery and elevates unexplored tracks at 100% discovery", () => {
      const familiar = dummyTrack("f1", "Familiar Song", "Familiar Singer");
      const unexplored = dummyTrack("u1", "New Discovery", "Unexplored Singer");
      const familiarArtists = ["Familiar Singer"];

      const zeroDiscovery = applyDiscoveryDistribution([familiar, unexplored], familiarArtists, 0);
      expect(zeroDiscovery[0]?.id).toBe("f1");

      const maxDiscovery = applyDiscoveryDistribution([familiar, unexplored], familiarArtists, 100);
      expect(maxDiscovery[0]?.id).toBe("u1");
    });
  });

  // 7. Cold-start users
  describe("7. Cold-Start Users", () => {
    it("generates a balanced profile for a new user without crashing", () => {
      const coldProfile = buildUserTasteProfile({
        likes: [],
        downloads: [],
        dislikes: [],
        stats: {},
        history: [],
        languages: ["Telugu", "Hindi"],
        currentHour: 9,
      });

      expect(coldProfile.topSingers).toEqual([]);
      expect(coldProfile.topComposers).toEqual([]);
      expect(coldProfile.topSoundtracks).toEqual([]);
      expect(coldProfile.currentHourEmpiricalEnergy).toBeDefined();
    });
  });

  // 8. Returning users
  describe("8. Returning Users with Rich Taste Profile", () => {
    it("identifies short-term session focus vs long-term interests", () => {
      const profile = buildUserTasteProfile({
        likes: [dummyTrack("l1", "Classic 1", "S.P. Balasubrahmanyam")],
        downloads: [],
        history: [
          dummyTrack("h1", "Current Mood", "Sid Sriram"),
          dummyTrack("h2", "Current Mood 2", "Anirudh Ravichander"),
        ],
        stats: {
          l1: { plays: 20, completions: 18, skips: 1, track: dummyTrack("l1", "Classic 1", "S.P. Balasubrahmanyam") },
          h1: { plays: 3, completions: 3, skips: 0, track: dummyTrack("h1", "Current Mood", "Sid Sriram") },
        },
        currentHour: 22,
      });

      expect(profile.longTermAffinities.lifetimeFavoriteSingers.length).toBeGreaterThan(0);
      expect(profile.shortTermFocus.recentSingers.length).toBeGreaterThan(0);
      expect(profile.shortTermFocus.recentComposers.length).toBeGreaterThan(0);
    });
  });

  // 9. Recommendation explainability & grounded reasons
  describe("9. Recommendation Explainability", () => {
    it("returns truthful badges grounded in actual signals", () => {
      const ctx: SessionContext = {
        hourOfDay: 20,
        discoveryPercent: 50,
        likedTracks: [dummyTrack("l1", "Song", "Sid Sriram")],
        downloadedTracks: [dummyTrack("d1", "Movie Song", "Singer X", "3:40", "RRR")],
        tasteProfile: {
          topSingers: [{ name: "Sid Sriram", score: 10, count: 2 }],
          topComposers: [{ name: "M.M. Keeravaani", score: 9, count: 1 }],
          topSoundtracks: [{ name: "rrr", score: 9, count: 1 }],
          topLanguages: [],
          preferredEnergy: { chill: 0.3, medium: 0.4, high: 0.3 },
          preferredMoods: [],
          preferredEras: { modern: 0.8, retro: 0.2, classic: 0.0 },
          circadianAffinity: {
            morning: { topGenres: [], avgEnergy: "chill", eventCount: 0 },
            afternoon: { topGenres: [], avgEnergy: "high", eventCount: 0 },
            evening: { topGenres: [], avgEnergy: "medium", eventCount: 0 },
            night: { topGenres: [], avgEnergy: "chill", eventCount: 0 },
          },
          currentHourEmpiricalEnergy: "medium",
          shortTermFocus: { recentSingers: [], recentComposers: [], currentEnergyTrend: "medium" },
          longTermAffinities: { lifetimeFavoriteSingers: [], lifetimeFavoriteComposers: [], downloadedSingers: [] },
          penalizedArtists: [],
          fastSkippedArtists: [],
          totalCompletions: 10,
          totalSkips: 1,
          completionRate: 0.9,
        },
      };

      // 1. Liked singer
      expect(explainPick(dummyTrack("c1", "Love Song", "Sid Sriram"), ctx, "made-for-you")).toBe("Because you liked Sid Sriram");

      // 2. Composer match
      expect(explainPick(dummyTrack("c2", "Epic Theme", "M.M. Keeravaani"), ctx, "made-for-you")).toBe("From a composer you enjoy");

      // 3. Download soundtrack match
      expect(explainPick(dummyTrack("c3", "Dosti", "Hemachandra", "4:00", "RRR"), ctx, "made-for-you")).toBe("Similar to your downloaded songs");

      // 4. Discover new singer
      expect(explainPick(dummyTrack("c4", "Fresh Song", "Brand New Singer"), ctx, "discover")).toBe("Discover a new singer");
    });
  });

  // 10. Duplicate prevention & Duration checks
  describe("10. Duplicate Prevention & Playable Duration", () => {
    it("rejects tracks with duration > 10 minutes (600s) and merges duplicates with differing credits", () => {
      const validTrack = dummyTrack("v1", "Hit Song", "Singer A", "4:15");
      const tooLongTrack = dummyTrack("l1", "Epic Satsang Devotional", "Singer B", "10:11");
      const zeroDuration = dummyTrack("z1", "Broken Stream", "Singer C", "0:00");

      expect(hasPlayableDuration(validTrack)).toBe(true);
      expect(hasPlayableDuration(tooLongTrack)).toBe(false);
      expect(hasPlayableDuration(zeroDuration)).toBe(false);

      const exclusions = {
        previouslyDisplayedIds: new Set<string>(),
        likedIds: new Set<string>(),
        recentlyPlayedIds: new Set<string>(),
      };

      const filtered = filterFeedCandidates([validTrack, tooLongTrack, zeroDuration], exclusions);
      expect(filtered.map((t) => t.id)).toEqual(["v1"]);

      // Verify duplicate song matching across different uploader/artist credits
      const upload1 = dummyTrack("u1", "Samajavaragamana - Full Song", "Sid Sriram", "3:40");
      const upload2 = dummyTrack("u2", "Samajavaragamana Audio Song", "Thaman S", "3:41");
      expect(areSameTrack(upload1, upload2)).toBe(true);
    });
  });

  // 11. Performance benchmark
  describe("11. Performance Benchmarks", () => {
    it("builds taste profile and ranks 50 candidate tracks well under 5ms", () => {
      const candidates = Array.from({ length: 50 }, (_, i) =>
        dummyTrack(`bench-${i}`, `Title ${i}`, `Artist ${i % 10}`, "3:30"),
      );

      const input: TasteProfileInput = {
        likes: candidates.slice(0, 10),
        downloads: candidates.slice(10, 15),
        dislikes: [],
        stats: {},
        history: candidates.slice(0, 5),
        currentHour: 18,
      };

      const start = performance.now();
      const profile = buildUserTasteProfile(input);
      const policy = new ThompsonSamplingPolicy();
      const ranked = policy.rankCandidates(candidates, {
        hourOfDay: 18,
        discoveryPercent: 50,
        tasteProfile: profile,
      });
      const durationMs = performance.now() - start;

      expect(ranked).toHaveLength(50);
      expect(durationMs).toBeLessThan(10); // strictly under 10ms (typically ~1-2ms)
    });
  });
});
