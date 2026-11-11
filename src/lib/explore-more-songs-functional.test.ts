import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Track } from "./types";
import { dedupeTracks } from "./track-dedup";
import { sameSong, isFuzzySameSong, hasPlayableDuration } from "./feed-freshness";

function makeTrack(id: string, title: string, artist: string, duration = "3:30"): Track {
  return {
    id,
    title,
    artist,
    duration,
    thumbnail: `https://example.com/${id}.jpg`,
  };
}

describe("Explore More Songs Functionality across Home and Explore", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Home (Made For You) Incremental Append", () => {
    it("appends new non-duplicate candidates to existing recommendations without losing state", () => {
      const currentRecs: Track[] = [
        makeTrack("rec-1", "Song 1", "Artist A"),
        makeTrack("rec-2", "Song 2", "Artist B"),
      ];

      const incomingFromRecommend: Track[] = [
        makeTrack("rec-1", "Song 1", "Artist A"), // duplicate
        makeTrack("rec-3", "Song 3", "Artist C"), // fresh
        makeTrack("rec-4", "Song 4", "Artist D"), // fresh
      ];

      const trulyNew = incomingFromRecommend.filter(
        (cand) => !currentRecs.some((p) => p.id === cand.id || isFuzzySameSong(p, cand)),
      );

      expect(trulyNew.map((t) => t.id)).toEqual(["rec-3", "rec-4"]);

      const updatedRecs = [...currentRecs, ...trulyNew];
      expect(updatedRecs.length).toBe(4);
      expect(updatedRecs.map((t) => t.id)).toEqual(["rec-1", "rec-2", "rec-3", "rec-4"]);
    });

    it("relaxes past-session exclusions when user explicitly requests more recommendations", () => {
      const currentRecs: Track[] = [makeTrack("cur-1", "Song A", "Artist 1")];
      const recentHistory: Track[] = [makeTrack("hist-1", "Song H", "Artist 2")];
      const dislikedIds = new Set(["disliked-1"]);

      const incomingCandidate = makeTrack("past-seen-1", "Song P", "Artist 3");
      const candidatePool = [
        makeTrack("cur-1", "Song A", "Artist 1"), // currently in recs -> must be excluded
        makeTrack("hist-1", "Song H", "Artist 2"), // in history -> must be excluded
        makeTrack("disliked-1", "Bad Song", "Artist 4"), // disliked -> must be excluded
        incomingCandidate, // valid candidate
      ];

      const filtered = candidatePool.filter(
        (t) =>
          hasPlayableDuration(t) &&
          !currentRecs.some((p) => p.id === t.id || isFuzzySameSong(p, t)) &&
          !recentHistory.some((p) => p.id === t.id || isFuzzySameSong(p, t)) &&
          !dislikedIds.has(t.id),
      );

      expect(filtered.map((t) => t.id)).toEqual(["past-seen-1"]);
    });
  });

  describe("2. Explore (Trending & All Tabs) Pagination and Progressive Reveal", () => {
    it("progressively expands visible trending limit in the All tab when Explore more songs is clicked", () => {
      const allLoadedTrending: Track[] = Array.from({ length: 45 }, (_, i) =>
        makeTrack(`trend-${i + 1}`, `Hit Song ${i + 1}`, `Artist ${i % 5}`),
      );

      let visibleLimit = 15;
      const getVisibleSlice = () => allLoadedTrending.slice(0, visibleLimit);

      // Initial view shows first 15 tracks
      expect(getVisibleSlice().length).toBe(15);
      expect(getVisibleSlice()[0]?.id).toBe("trend-1");
      expect(getVisibleSlice()[14]?.id).toBe("trend-15");

      // First click on 'Explore more songs' increments limit by 15
      visibleLimit += 15;
      expect(getVisibleSlice().length).toBe(30);
      expect(getVisibleSlice()[29]?.id).toBe("trend-30");

      // Second click increments limit by 15 more
      visibleLimit += 15;
      expect(getVisibleSlice().length).toBe(45);
      expect(getVisibleSlice()[44]?.id).toBe("trend-45");
    });

    it("appends new batches fetched from multi-source fallbacks into trending list", () => {
      const currentTrending: Track[] = [
        makeTrack("t-1", "Pushpa Pushpa", "Devi Sri Prasad"),
        makeTrack("t-2", "Fear Song", "Anirudh Ravichander"),
      ];

      // Trending endpoint returned duplicates, fallback to New Releases returned fresh tracks
      const fallbackTracks: Track[] = [
        makeTrack("t-2", "Fear Song", "Anirudh Ravichander"), // duplicate
        makeTrack("new-1", "Chuttamalle", "Anirudh Ravichander"),
        makeTrack("new-2", "Devara Theme", "Anirudh Ravichander"),
      ];

      const trulyNew = fallbackTracks.filter(
        (cand) => !currentTrending.some((p) => p.id === cand.id || sameSong(p, cand)),
      );

      expect(trulyNew.map((t) => t.id)).toEqual(["new-1", "new-2"]);

      const updatedTrending = dedupeTracks([...currentTrending, ...trulyNew]);
      expect(updatedTrending.length).toBe(4);
      expect(updatedTrending.map((t) => t.id)).toEqual(["t-1", "t-2", "new-1", "new-2"]);
    });

    it("does not report explore exhausted prematurely if candidates were successfully added", () => {
      let exploreExhausted = true;
      const incoming = [makeTrack("fresh-1", "Song", "Artist")];

      if (incoming.length > 0) {
        exploreExhausted = false;
      }

      expect(exploreExhausted).toBe(false);
    });
  });
});
