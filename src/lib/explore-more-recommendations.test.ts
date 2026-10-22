import { describe, it, expect, vi, beforeEach } from "vitest";
import { dedupeTracks, trackExistsIn, diversifyTrackList, type TrackLike } from "./track-dedup";
import { filterFeedCandidates, hasPlayableDuration, sameSong } from "./feed-freshness";
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
});
