import { describe, it, expect, vi, beforeEach } from "vitest";
import { dedupeTracks, trackExistsIn, diversifyTrackList, type TrackLike } from "./track-dedup";
import { filterFeedCandidates, hasPlayableDuration, isFuzzySameSong, sameSong } from "./feed-freshness";
import { ThompsonSamplingPolicy } from "./bandit-policy";
import type { Track } from "./types";

function mkTrack(id: string, title: string, artist: string, duration = "3:30"): Track {
  return {
    id,
    title,
    artist,
    duration,
    thumbnail: `https://example.com/${id}.jpg`,
  };
}

describe("Feature 1: Explore More Songs Regression Test Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("A. Non-destructive batch appending and diversification", () => {
    it("preserves existing feed items when appending a new batch", () => {
      const prev: Track[] = [
        mkTrack("1", "Song 1", "Artist A"),
        mkTrack("2", "Song 2", "Artist B"),
        mkTrack("3", "Song 3", "Artist A"), // Artist A has 2 songs in prev
      ];

      const incoming: Track[] = [
        mkTrack("4", "Song 4", "Artist A"), // New track by Artist A
        mkTrack("5", "Song 5", "Artist C"),
        mkTrack("1", "Song 1", "Artist A"), // Duplicate of song 1
      ];

      // Filter truly new
      const trulyNew = incoming.filter(
        (cand) => !prev.some((p) => p.id === cand.id || sameSong(p, cand)),
      );
      expect(trulyNew.map((t) => t.id)).toEqual(["4", "5"]);

      // Diversifying only trulyNew allows Artist A's new track to be appended
      const diversifiedBatch = diversifyTrackList(trulyNew, {
        maxPerArtist: 2,
        maxPerAlbum: 1,
      });

      const updated = [...prev, ...diversifiedBatch];
      // All 3 original tracks remain untouched at the start
      expect(updated.slice(0, 3).map((t) => t.id)).toEqual(["1", "2", "3"]);
      // New tracks are appended
      expect(updated.map((t) => t.id)).toEqual(["1", "2", "3", "4", "5"]);
    });

    it("does not mutate or drop existing tracks when incoming batch is empty", () => {
      const prev: Track[] = [
        mkTrack("1", "Song 1", "Artist A"),
        mkTrack("2", "Song 2", "Artist B"),
      ];
      const incoming: Track[] = [
        mkTrack("1", "Song 1", "Artist A"), // All duplicates
      ];

      const trulyNew = incoming.filter(
        (cand) => !prev.some((p) => p.id === cand.id || sameSong(p, cand)),
      );
      expect(trulyNew.length).toBe(0);

      const updated = trulyNew.length === 0 ? prev : [...prev, ...trulyNew];
      expect(updated).toBe(prev);
      expect(updated.length).toBe(2);
    });
  });

  describe("B. Session freshness filtering and relaxed fallback", () => {
    it("excludes tracks in active recs, history, and dislikes", () => {
      const currentRecs: Track[] = [
        mkTrack("rec-1", "Active Song 1", "Artist X"),
        mkTrack("rec-2", "Active Song 2", "Artist Y"),
      ];
      const history: Track[] = [
        mkTrack("hist-1", "Played Song 1", "Artist Z"),
      ];
      const dislikedIds = new Set(["disliked-1"]);

      const candidates: Track[] = [
        mkTrack("rec-1", "Active Song 1", "Artist X"), // duplicate of recs
        mkTrack("hist-1", "Played Song 1", "Artist Z"), // duplicate of history
        mkTrack("disliked-1", "Bad Song", "Artist W"), // disliked
        mkTrack("fresh-1", "Fresh Track 1", "Artist M"), // valid
        mkTrack("fresh-2", "Fresh Track 2", "Artist N"), // valid
      ];

      const relaxed = candidates.filter(
        (t) =>
          hasPlayableDuration(t) &&
          !trackExistsIn(currentRecs, t as TrackLike) &&
          !trackExistsIn(history, t as TrackLike) &&
          !dislikedIds.has(t.id),
      );

      expect(relaxed.map((t) => t.id)).toEqual(["fresh-1", "fresh-2"]);
    });

    it("relaxed fallback recovers unshown tracks when session displayed tracker has grown large", () => {
      // Simulates user having seen tracks in previous session / refreshes
      const displayedIds = new Set(["old-1", "old-2", "fresh-candidate-1"]);
      const currentRecs: Track[] = [mkTrack("visible-1", "Visible 1", "Artist A")];
      const history: Track[] = [];

      const pool: Track[] = [
        mkTrack("fresh-candidate-1", "Good Song", "Artist B"),
        mkTrack("fresh-candidate-2", "Another Song", "Artist C"),
      ];

      // Hard filter excludes fresh-candidate-1 because of displayedIds
      const hardFiltered = filterFeedCandidates(pool, {
        previouslyDisplayedIds: displayedIds,
        currentTrackId: null,
      });
      expect(hardFiltered.map((t) => t.id)).toEqual(["fresh-candidate-2"]);

      // Relaxed fallback (triggered when hardFiltered.length is small) preserves unshown tracks
      // not in currentRecs:
      const relaxed = pool.filter(
        (t) =>
          hasPlayableDuration(t) &&
          !trackExistsIn(currentRecs, t as TrackLike) &&
          !trackExistsIn(history, t as TrackLike),
      );
      expect(relaxed.map((t) => t.id)).toEqual(["fresh-candidate-1", "fresh-candidate-2"]);
    });
  });

  describe("C. Concurrency and pagination state", () => {
    it("synchronous mutex lock prevents concurrent duplicate executions", async () => {
      let isRunning = false;
      let executions = 0;

      const triggerLoadMore = async () => {
        if (isRunning) return "blocked";
        isRunning = true;
        try {
          executions++;
          await new Promise((r) => setTimeout(r, 50));
          return "ok";
        } finally {
          isRunning = false;
        }
      };

      // Fire 3 simultaneous rapid clicks
      const results = await Promise.all([
        triggerLoadMore(),
        triggerLoadMore(),
        triggerLoadMore(),
      ]);

      expect(executions).toBe(1);
      expect(results.filter((r) => r === "ok").length).toBe(1);
      expect(results.filter((r) => r === "blocked").length).toBe(2);
    });

    it("pagination advances page count monotonically", () => {
      let pageRef = 1;
      const getNextPage = () => {
        pageRef += 1;
        return pageRef;
      };

      expect(getNextPage()).toBe(2);
      expect(getNextPage()).toBe(3);
      expect(getNextPage()).toBe(4);

      // On feed refresh, page resets to 1
      pageRef = 1;
      expect(pageRef).toBe(1);
      expect(getNextPage()).toBe(2);
    });
  });

  describe("D. Queue exclusion & recommendation analysis for Explore More Songs", () => {
    it("strictly excludes both active queue and previous persisted queue songs", () => {
      const currentQueue = [mkTrack("q-active-1", "Pushpa Pushpa", "Devi Sri Prasad")];
      const persistedQueue = [mkTrack("q-prev-1", "Chuttamalle", "Anirudh Ravichander")];
      const allQueueTracks = [...currentQueue, ...persistedQueue];
      const currentTrack = mkTrack("playing-1", "Fear Song", "Anirudh Ravichander");

      const candidates = [
        mkTrack("q-active-1", "Pushpa Pushpa", "Devi Sri Prasad"),
        mkTrack("q-prev-2", "Chuttamalle (From \"Devara\")", "Anirudh Ravichander"), // Fuzzy match to previous queue!
        mkTrack("playing-1", "Fear Song", "Anirudh Ravichander"),
        mkTrack("fresh-rec-1", "Devara Theme", "Anirudh Ravichander"),
        mkTrack("fresh-rec-2", "Tauba Tauba", "Karan Aujla"),
      ];

      const eligible = candidates.filter((t) => {
        if (currentTrack && (t.id === currentTrack.id || isFuzzySameSong(t, currentTrack))) return false;
        if (allQueueTracks.some((q) => q.id === t.id || isFuzzySameSong(q, t))) return false;
        return true;
      });

      expect(eligible.map((t) => t.id)).toEqual(["fresh-rec-1", "fresh-rec-2"]);
    });

    it("ranks explore candidates with Thompson Sampling and inserts analyzed tracks at reveal boundary while pruning queued tail", () => {
      const policy = new ThompsonSamplingPolicy();
      const allQueueTracks = [mkTrack("q-old-1", "Prev Queue Track", "Artist Q")];

      const sampleTitles = [
        ["Butta Bomma", "Armaan Malik"],
        ["Samajavaragamana", "Sid Sriram"],
        ["Inkem Inkem", "Sid Sriram"],
        ["Ramuloo Ramulaa", "Anurag Kulkarni"],
        ["Srivalli", "Javed Ali"],
        ["Oo Antava", "Indravathi Chauhan"],
        ["Saami Saami", "Mounika Yadav"],
        ["Naatu Naatu", "Rahul Sipligunj"],
        ["Kalavathi", "Sid Sriram"],
        ["Maguva Maguva", "Sid Sriram"],
        ["Saranga Dariya", "Mangli"],
        ["Rowdy Baby", "Dhanush"],
        ["Vaathi Coming", "Anirudh Ravichander"],
        ["Arabic Kuthu", "Anirudh Ravichander"],
        ["Kesariya", "Arijit Singh"],
      ] as const;
      const visibleHead = sampleTitles.map(([title, artist], idx) =>
        mkTrack(`head-${idx + 1}`, title, artist),
      );
      const staleTail = [
        mkTrack("q-old-1", "Prev Queue Track", "Artist Q"), // Previously queued track sitting in unrevealed cache
        mkTrack("tail-keep-1", "Clean Tail Song", "Artist T"),
      ];
      const prevTrending = [...visibleHead, ...staleTail];

      const incomingPool = [
        mkTrack("analyzed-1", "Sooseki", "Shreya Ghoshal"),
        mkTrack("analyzed-2", "Kurchi Madathapetti", "Thaman S"),
        mkTrack("q-old-1", "Prev Queue Track", "Artist Q"), // Should be excluded
      ].filter((t) => !allQueueTracks.some((q) => q.id === t.id || isFuzzySameSong(q, t)));

      const ranked = policy.rankCandidates(incomingPool, {
        discoveryPercent: 40,
        likedTracks: [mkTrack("like-1", "Melody Hit", "Shreya Ghoshal")],
        preferredLanguages: ["Telugu"],
      });
      const diversified = diversifyTrackList(ranked, { maxPerArtist: 2, maxPerAlbum: 1 });

      const visibleFloor = 15;
      const head = prevTrending.slice(0, visibleFloor);
      const cleanTail = prevTrending
        .slice(visibleFloor)
        .filter((t) => !allQueueTracks.some((q) => q.id === t.id || isFuzzySameSong(q, t)));
      const combined = dedupeTracks([...head, ...diversified, ...cleanTail]);

      // Queue track must never appear in expanded results
      expect(combined.some((t) => t.id === "q-old-1")).toBe(false);
      // Newly analyzed tracks occupy slots 15 & 16 immediately after visibleHead
      expect(combined.slice(15, 17).map((t) => t.id).sort()).toEqual(["analyzed-1", "analyzed-2"]);
      // Clean tail remains preserved afterward
      expect(combined.some((t) => t.id === "tail-keep-1")).toBe(true);
    });
  });
});
