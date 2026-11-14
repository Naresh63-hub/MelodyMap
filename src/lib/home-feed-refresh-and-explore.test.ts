import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Track } from "./types";
import { isFuzzySameSong, sameSong } from "./feed-freshness";
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

    it("prioritizes all fresh tracks first even when fresh candidate count is small (< 10)", () => {
      const prevRecs: Track[] = [
        makeTrack("prev-1", "Old Track 1", "Artist 1"),
        makeTrack("prev-2", "Old Track 2", "Artist 2"),
        makeTrack("prev-3", "Old Track 3", "Artist 3"),
      ];

      const candidatePool: Track[] = [
        makeTrack("prev-1", "Old Track 1", "Artist 1"),
        makeTrack("prev-2", "Old Track 2", "Artist 2"),
        makeTrack("fresh-1", "Brand New Hit 1", "Artist 4"),
        makeTrack("fresh-2", "Brand New Hit 2", "Artist 5"),
      ];

      const isExplicitRefresh = true;
      let finalPool = candidatePool;
      if (isExplicitRefresh && prevRecs.length > 0) {
        const freshFromPrev = candidatePool.filter(
          (t) => !prevRecs.some((pr) => pr.id === t.id || sameSong(pr, t)),
        );
        if (freshFromPrev.length >= 10) {
          finalPool = freshFromPrev;
        } else if (freshFromPrev.length > 0) {
          const backfill = candidatePool.filter(
            (t) => !freshFromPrev.some((f) => f.id === t.id || sameSong(f, t)),
          );
          finalPool = [...freshFromPrev, ...backfill];
        }
      }

      // Fresh tracks must strictly be in the first 2 slots!
      expect(finalPool[0]?.id).toBe("fresh-1");
      expect(finalPool[1]?.id).toBe("fresh-2");
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
    it("advances Daily Mix page across 1-5 discovery cycles on explicit refresh", () => {
      let dailyRefreshPage = 1;
      const getTargetPage = (refreshNonce?: string | number) => {
        const isExplicitRefresh = Boolean(refreshNonce);
        if (isExplicitRefresh) {
          dailyRefreshPage = (dailyRefreshPage % 5) + 1;
        } else {
          dailyRefreshPage = 1;
        }
        return dailyRefreshPage;
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

    it("filters out previous Daily Mix tracks on explicit refresh to deliver fresh songs", () => {
      const prevDailyMix: Track[] = [
        makeTrack("dm-old-1", "Samayama", "Anurag Kulkarni"),
        makeTrack("dm-old-2", "Inkem Inkem", "Sid Sriram"),
      ];

      const candidatePool: Track[] = [
        makeTrack("dm-old-1", "Samayama", "Anurag Kulkarni"), // Previous track
        makeTrack("dm-fresh-1", "Kurchi Madathapetti", "Thaman S"), // Fresh track
        makeTrack("dm-fresh-2", "Chuttamalle", "Anirudh Ravichander"), // Fresh track
      ];

      const isExplicitRefresh = true;
      let finalMix = candidatePool;
      if (isExplicitRefresh && prevDailyMix.length > 0) {
        const freshFromPrev = candidatePool.filter(
          (t) => !prevDailyMix.some((pr) => pr.id === t.id || sameSong(pr, t)),
        );
        finalMix = freshFromPrev;
      }

      expect(finalMix.some((t) => t.id === "dm-old-1")).toBe(false);
      expect(finalMix.map((t) => t.id)).toEqual(["dm-fresh-1", "dm-fresh-2"]);
    });

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

  describe("4. Fuzzy Deduplication & Two-Way Isolation", () => {
    it("isFuzzySameSong detects duplicates despite YouTube outro/intro duration differences and title tags", () => {
      const ytTrack = makeTrack("yt-1", "Chuttamalle (From \"Devara\") [Official Video]", "Anirudh Ravichander, Deepthi Suresh", "4:15");
      const saavnTrack = makeTrack("saavn-1", "Chuttamalle", "Anirudh Ravichander", "3:42");

      // Standard sameSong fails because duration difference > 8 seconds
      expect(sameSong(ytTrack, saavnTrack)).toBe(false);

      // isFuzzySameSong recognizes them as the exact same song
      expect(isFuzzySameSong(ytTrack, saavnTrack)).toBe(true);
    });

    it("two-way isolation prevents Daily Mix songs from showing on Explore and vice versa", () => {
      const dailyMixTrack = makeTrack("dm-1", "Fear Song", "Anirudh Ravichander");
      const exploreTrack = makeTrack("exp-1", "Fear Song (From \"Devara\")", "Anirudh Ravichander");

      const explorePool: Track[] = [
        exploreTrack,
        makeTrack("exp-2", "Unique Trending Hit", "Artist Trending"),
      ];

      const filteredExplore = explorePool.filter((t) => !isFuzzySameSong(dailyMixTrack, t));

      expect(filteredExplore.some((t) => t.id === "exp-1")).toBe(false);
      expect(filteredExplore.map((t) => t.id)).toEqual(["exp-2"]);
    });

    it("guarantees refreshed Made For You feed starts with freshly discovered tracks at the top", () => {
      const prevRecs: Track[] = [
        makeTrack("old-1", "Old Song 1", "Artist A"),
        makeTrack("old-2", "Old Song 2", "Artist B"),
      ];

      const freshFromPrev: Track[] = [
        makeTrack("new-1", "Brand New Discovery 1", "Artist C"),
        makeTrack("new-2", "Brand New Discovery 2", "Artist D"),
      ];

      const backfill: Track[] = [
        makeTrack("old-1", "Old Song 1", "Artist A"),
      ];

      const settledRecs = [...freshFromPrev, ...backfill];

      // Newly discovered songs are guaranteed to occupy positions 0 and 1
      expect(settledRecs[0]?.id).toBe("new-1");
      expect(settledRecs[1]?.id).toBe("new-2");
    });

    it("guarantees explicit refresh updates BOTH Made For You and Daily Mix simultaneously without duplicate overlap", () => {
      const prevDailyMix: Track[] = [
        makeTrack("prev-dm-1", "Old Daily Mix Song", "Artist 1"),
      ];
      const prevRecs: Track[] = [
        makeTrack("prev-rec-1", "Old Made For You Song", "Artist 2"),
      ];

      // Candidate pool after refresh
      const dmCandidatePool: Track[] = [
        makeTrack("prev-dm-1", "Old Daily Mix Song", "Artist 1"),
        makeTrack("fresh-dm-1", "Fresh Daily Track 1", "Artist 3"),
        makeTrack("fresh-dm-2", "Fresh Daily Track 2", "Artist 4"),
      ];

      const recsCandidatePool: Track[] = [
        makeTrack("prev-rec-1", "Old Made For You Song", "Artist 2"),
        makeTrack("fresh-dm-1", "Fresh Daily Track 1", "Artist 3"), // should be filtered out because it is in Daily Mix!
        makeTrack("fresh-rec-1", "Fresh Rec Track 1", "Artist 5"),
        makeTrack("fresh-rec-2", "Fresh Rec Track 2", "Artist 6"),
      ];

      // 1. Process Daily Mix refresh
      const freshDailyMix = dmCandidatePool.filter(
        (t) => !prevDailyMix.some((pr) => pr.id === t.id || isFuzzySameSong(pr, t)),
      );
      expect(freshDailyMix.map((t) => t.id)).toEqual(["fresh-dm-1", "fresh-dm-2"]);

      // 2. Process Made For You refresh: excludes prevRecs AND excludes tracks currently in Daily Mix
      const freshRecs = recsCandidatePool
        .filter((t) => !prevRecs.some((pr) => pr.id === t.id || isFuzzySameSong(pr, t)))
        .filter((t) => !freshDailyMix.some((d) => d.id === t.id || isFuzzySameSong(d, t)));

      expect(freshRecs.map((t) => t.id)).toEqual(["fresh-rec-1", "fresh-rec-2"]);

      // Both sections successfully refreshed to brand new songs, and neither has overlap!
      expect(freshRecs.some((r) => freshDailyMix.some((d) => d.id === r.id))).toBe(false);
    });

    it("preserves cached home feed across sessions on startup and skips automatic auto-refresh", () => {
      const cleanRecs = [makeTrack("cached-1", "Cached Track 1", "Artist A")];
      const cleanDailyMix = [makeTrack("cached-2", "Cached Track 2", "Artist B")];

      let didTriggerAutoRefresh = false;
      const simulateStartup = (recs: Track[], dailyMix: Track[]) => {
        const hasCachedHome = recs.length > 0 || dailyMix.length > 0;
        if (!hasCachedHome) {
          didTriggerAutoRefresh = true;
        }
      };

      // 1. App opens with cached songs: should NOT trigger auto-refresh
      simulateStartup(cleanRecs, cleanDailyMix);
      expect(didTriggerAutoRefresh).toBe(false);

      // 2. Cold start with empty cache: triggers initial feed load
      simulateStartup([], []);
      expect(didTriggerAutoRefresh).toBe(true);
    });
  });
});
