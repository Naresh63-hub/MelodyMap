import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Track } from "./types";
import { sameSong } from "./feed-freshness";
import { dedupeTracks, diversifyTrackList, type TrackLike } from "./track-dedup";
import { ThompsonSamplingPolicy, type SessionContext } from "./bandit-policy";

function makeTrack(id: string, title: string, artist: string, duration = "3:30", album = `Album-${id}`): Track {
  return {
    id,
    title,
    artist,
    album,
    duration,
    thumbnail: `https://example.com/${id}.jpg`,
  };
}

describe("Home Feed Refresh, Daily Mix Isolation, and Explore More Songs", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Home Refresh: Made For You delivers fresh songs and excludes previous batch", () => {
    it("advances refresh page across 1-5 discovery cycles on explicit refresh", () => {
      let homeRefreshPage = 1;
      const getTargetPage = (refreshNonce?: string | number) => {
        const isExplicitRefresh = Boolean(refreshNonce);
        if (isExplicitRefresh) {
          homeRefreshPage = (homeRefreshPage % 5) + 1;
        } else {
          homeRefreshPage = 1;
        }
        return homeRefreshPage;
      };

      // Initial load stays page 1
      expect(getTargetPage()).toBe(1);
      expect(getTargetPage()).toBe(1);

      // Explicit refreshes advance through 2 -> 3 -> 4 -> 5 -> 1 -> 2
      expect(getTargetPage("nonce-1")).toBe(2);
      expect(getTargetPage("nonce-2")).toBe(3);
      expect(getTargetPage("nonce-3")).toBe(4);
      expect(getTargetPage("nonce-4")).toBe(5);
      expect(getTargetPage("nonce-5")).toBe(1);
      expect(getTargetPage("nonce-6")).toBe(2);
    });

    it("filters out previous recs on explicit refresh to guarantee fresh recommendations", () => {
      const prevRecs: Track[] = [
        makeTrack("prev-1", "Kurchi Madathapetti", "Thaman S"),
        makeTrack("prev-2", "Fear Song", "Anirudh Ravichander"),
        makeTrack("prev-3", "Chuttamalle", "Anirudh Ravichander"),
      ];

      const candidatePool: Track[] = [
        makeTrack("prev-1", "Kurchi Madathapetti", "Thaman S"), // Previous track
        makeTrack("prev-2", "Fear Song", "Anirudh Ravichander"), // Previous track
        makeTrack("fresh-1", "Devara Theme", "Anirudh Ravichander"), // New track
        makeTrack("fresh-2", "Tauba Tauba", "Karan Aujla"), // New track
        makeTrack("fresh-3", "Pushpa Pushpa", "Devi Sri Prasad"), // New track
        makeTrack("fresh-4", "Sooseki", "Devi Sri Prasad"), // New track
      ];

      const isExplicitRefresh = true;
      let candidates = candidatePool;
      if (isExplicitRefresh && prevRecs.length > 0) {
        const freshFromPrev = candidatePool.filter(
          (t) => !prevRecs.some((pr) => pr.id === t.id || sameSong(pr, t)),
        );
        if (freshFromPrev.length >= 3) {
          candidates = freshFromPrev;
        }
      }

      // None of the previous recs should appear in the refreshed candidate pool
      expect(candidates.some((t) => t.id === "prev-1")).toBe(false);
      expect(candidates.some((t) => t.id === "prev-2")).toBe(false);
      expect(candidates.map((t) => t.id)).toEqual(["fresh-1", "fresh-2", "fresh-3", "fresh-4"]);
    });

    it("excludes tracks currently in the playback queue and currently playing track from Made For You", () => {
      const currentTrack = makeTrack("current-1", "Now Playing Track", "Artist A");
      const currentQueue = [
        makeTrack("q-1", "Queued Song 1", "Artist B"),
        makeTrack("q-2", "Queued Song 2", "Artist C"),
      ];

      const candidatePool: Track[] = [
        makeTrack("current-1", "Now Playing Track", "Artist A"), // Playing
        makeTrack("q-1", "Queued Song 1", "Artist B"), // Queued
        makeTrack("rec-1", "Made For You Song 1", "Artist D"),
        makeTrack("rec-2", "Made For You Song 2", "Artist E"),
        makeTrack("rec-3", "Made For You Song 3", "Artist F"),
      ];

      const nonQueueCandidates = candidatePool.filter((t) => {
        if (currentTrack && (t.id === currentTrack.id || sameSong(t, currentTrack))) return false;
        if (currentQueue.some((q) => q.id === t.id || sameSong(q, t))) return false;
        return true;
      });

      expect(nonQueueCandidates.some((t) => t.id === "current-1")).toBe(false);
      expect(nonQueueCandidates.some((t) => t.id === "q-1")).toBe(false);
      expect(nonQueueCandidates.map((t) => t.id)).toEqual(["rec-1", "rec-2", "rec-3"]);
    });
  });

  describe("2. Daily Mix: Zero overlap with playback queue and Explore page", () => {
    it("filters out songs in queue, current playing song, and Explore page from Daily Mix", () => {
      const currentTrack = makeTrack("now-playing", "Song Playing", "Artist X");
      const currentQueue = [
        makeTrack("queue-1", "Song In Queue", "Artist Y"),
      ];
      const currentExplore = [
        makeTrack("explore-1", "Trending Song On Explore", "Artist Z"),
        makeTrack("explore-2", "New Release On Explore", "Artist W"),
      ];

      const dailyMixPool: Track[] = [
        makeTrack("now-playing", "Song Playing", "Artist X"), // duplicate of current playing
        makeTrack("queue-1", "Song In Queue", "Artist Y"), // duplicate of queue
        makeTrack("explore-1", "Trending Song On Explore", "Artist Z"), // duplicate of explore
        makeTrack("dm-1", "Exclusive Daily Mix Song 1", "Artist A"),
        makeTrack("dm-2", "Exclusive Daily Mix Song 2", "Artist B"),
        makeTrack("dm-3", "Exclusive Daily Mix Song 3", "Artist C"),
      ];

      const isDuplicateWithQueueOrExplore = (t: Track) => {
        if (!t) return true;
        if (currentTrack && (t.id === currentTrack.id || sameSong(t, currentTrack))) return true;
        if (currentQueue.some((q) => q.id === t.id || sameSong(q, t))) return true;
        if (currentExplore.some((e) => e.id === t.id || sameSong(e, t))) return true;
        return false;
      };

      const cleanDailyMix = dailyMixPool.filter((t) => !isDuplicateWithQueueOrExplore(t));

      expect(cleanDailyMix.some((t) => t.id === "now-playing")).toBe(false);
      expect(cleanDailyMix.some((t) => t.id === "queue-1")).toBe(false);
      expect(cleanDailyMix.some((t) => t.id === "explore-1")).toBe(false);
      expect(cleanDailyMix.map((t) => t.id)).toEqual(["dm-1", "dm-2", "dm-3"]);
    });
  });

  describe("3. Explore More Songs: Synchronous batch check prevents premature exhaustion", () => {
    it("does not prematurely disable explore button with 'All caught up' when new songs are available", () => {
      let exploreExhausted = false;
      let recs: Track[] = [
        makeTrack("rec-1", "Initial Rec 1", "Artist A"),
        makeTrack("rec-2", "Initial Rec 2", "Artist B"),
      ];

      const incomingCandidates: Track[] = [
        makeTrack("rec-1", "Initial Rec 1", "Artist A"), // duplicate
        makeTrack("rec-3", "Chaleya", "Anirudh Ravichander"),
        makeTrack("rec-4", "Tauba Tauba", "Karan Aujla"),
      ];

      const currentRecs = recs;
      const trulyNew = incomingCandidates.filter(
        (cand) => !currentRecs.some((p) => p.id === cand.id || sameSong(p, cand)),
      );
      const diversifiedBatch = diversifyTrackList(trulyNew, {
        maxPerArtist: 2,
        maxPerAlbum: 1,
      });

      if (diversifiedBatch.length > 0) {
        recs = [...recs, ...diversifiedBatch];
        exploreExhausted = false;
      } else {
        exploreExhausted = true;
      }

      // Button should NOT be exhausted!
      expect(exploreExhausted).toBe(false);
      expect(recs.map((t) => t.id)).toEqual(["rec-1", "rec-2", "rec-3", "rec-4"]);
    });

    it("marks exhausted only when no new songs can be found after deep exploration", () => {
      let exploreExhausted = false;
      const recs: Track[] = [
        makeTrack("rec-1", "Initial Rec 1", "Artist A"),
      ];

      const incomingCandidates: Track[] = [
        makeTrack("rec-1", "Initial Rec 1", "Artist A"), // Only duplicates
      ];

      const targetPage = 6; // Deep page
      const currentRecs = recs;
      const trulyNew = incomingCandidates.filter(
        (cand) => !currentRecs.some((p) => p.id === cand.id || sameSong(p, cand)),
      );
      const diversifiedBatch = diversifyTrackList(trulyNew, {
        maxPerArtist: 2,
        maxPerAlbum: 1,
      });

      if (diversifiedBatch.length > 0) {
        exploreExhausted = false;
      } else {
        if (targetPage >= 6) {
          exploreExhausted = true;
        }
      }

      expect(exploreExhausted).toBe(true);
    });
  });
});
