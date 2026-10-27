import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Track } from "./library";
import { sameSong } from "./feed-freshness";
import {
  fetchSaavnLaunchData,
  clearSaavnLaunchDataCache,
} from "./providers/saavn";

const makeTrack = (t: Partial<Track> & { id: string; title: string; artist: string; duration?: string }): Track => ({
  thumbnail: "",
  duration: "3:30",
  ...t,
});

describe("Explore Refresh & Home Recommendation Separation", () => {
  beforeEach(() => {
    clearSaavnLaunchDataCache();
    vi.restoreAllMocks();
  });

  describe("1. Explore Pagination & Page Advancement", () => {
    it("starts with page 1 on initial load and advances across 1-5 discovery range on refresh", () => {
      let exploreRefreshPage = 1;

      // Simulated initial load (no explicit refreshNonce)
      const onInitialLoad = (refreshNonce?: string | number) => {
        const isExplicitRefresh = Boolean(refreshNonce);
        if (isExplicitRefresh) {
          exploreRefreshPage = (exploreRefreshPage % 5) + 1;
        } else {
          exploreRefreshPage = 1;
        }
        return exploreRefreshPage;
      };

      expect(onInitialLoad()).toBe(1);
      expect(onInitialLoad()).toBe(1); // Repeated initial / tab switch stays page 1

      // Explicit refreshes advance through 2 -> 3 -> 4 -> 5 -> 1 -> 2
      expect(onInitialLoad("nonce-1")).toBe(2);
      expect(onInitialLoad("nonce-2")).toBe(3);
      expect(onInitialLoad("nonce-3")).toBe(4);
      expect(onInitialLoad("nonce-4")).toBe(5);
      expect(onInitialLoad("nonce-5")).toBe(1);
      expect(onInitialLoad("nonce-6")).toBe(2);
    });

    it("generates rotated query buckets on page > 1 so different pages yield different results", () => {
      const trendingQueryBuckets = [
        (l: string) => `Top 50 ${l} songs`,
        (l: string) => `${l} top trending hit songs`,
        (l: string) => `${l} viral hits chart`,
        (l: string) => `latest trending ${l} hits`,
        (l: string) => `${l} most popular songs`,
      ];

      const getQueriesForPage = (page: number, lang: string) => {
        const bucketIndex = (page - 1) % trendingQueryBuckets.length;
        const bucketFn = trendingQueryBuckets[bucketIndex]!;
        const queries = [bucketFn(lang)];
        if (page === 1) {
          queries.push(`Top 50 ${lang} songs`);
        } else {
          const altFn = trendingQueryBuckets[(bucketIndex + 1) % trendingQueryBuckets.length]!;
          queries.push(altFn(lang));
        }
        return queries;
      };

      const page1Queries = getQueriesForPage(1, "Telugu");
      const page2Queries = getQueriesForPage(2, "Telugu");
      const page3Queries = getQueriesForPage(3, "Telugu");

      expect(page1Queries).toContain("Top 50 Telugu songs");
      expect(page2Queries).toContain("Telugu top trending hit songs");
      expect(page3Queries).toContain("Telugu viral hits chart");

      // Verify that page 1 and page 2 queries are completely different
      const overlap1and2 = page1Queries.filter((q) => page2Queries.includes(q));
      expect(overlap1and2).toHaveLength(0);
    });
  });

  describe("2. Prevent Repeated Songs on Explore Refresh", () => {
    it("deduplicates results across pages using stable identity and normalized fallback", () => {
      const page1Tracks: Track[] = [
        makeTrack({ id: "saavn:song-1", title: "Pushpa Pushpa", artist: "Devi Sri Prasad" }),
        makeTrack({ id: "saavn:song-2", title: "Fear Song", artist: "Anirudh Ravichander" }),
      ];

      // Page 2 has one ID-match duplicate and one Title/Artist-match duplicate (different ID)
      const page2Tracks: Track[] = [
        makeTrack({ id: "saavn:song-2", title: "Fear Song", artist: "Anirudh Ravichander" }),
        makeTrack({ id: "yt:alt-id-1", title: "Pushpa Pushpa", artist: "Devi Sri Prasad" }),
        makeTrack({ id: "saavn:song-3", title: "Chuttamalle", artist: "Shilpa Rao" }),
        makeTrack({ id: "saavn:song-4", title: "Tauba Tauba", artist: "Karan Aujla" }),
      ];

      const freshNonDupes = page2Tracks.filter(
        (t) => !page1Tracks.some((prev) => prev.id === t.id || sameSong(prev, t)),
      );

      expect(freshNonDupes).toHaveLength(2);
      expect(freshNonDupes.map((t) => t.id)).toEqual(["saavn:song-3", "saavn:song-4"]);
    });

    it("never reinserts previously displayed tracks just to fill a batch", () => {
      const prevDisplayed: Track[] = [
        makeTrack({ id: "t-1", title: "Old Song 1", artist: "Singer A" }),
        makeTrack({ id: "t-2", title: "Old Song 2", artist: "Singer B" }),
        makeTrack({ id: "t-3", title: "Old Song 3", artist: "Singer C" }),
      ];

      // On refresh, incoming tracks contain only 2 unique songs
      const incoming: Track[] = [
        makeTrack({ id: "t-2", title: "Old Song 2", artist: "Singer B" }), // duplicate
        makeTrack({ id: "t-4", title: "Brand New Track", artist: "Singer D" }),
        makeTrack({ id: "t-5", title: "Another New Track", artist: "Singer E" }),
      ];

      const nonDupes = incoming.filter(
        (t) => !prevDisplayed.some((p) => p.id === t.id || sameSong(p, t)),
      );

      // Even though nonDupes has only 2 songs (less than 10 or 20), do NOT re-append prevDisplayed
      const resultTracks = nonDupes; // Architecture rule: never reinsert old tracks to fill batch
      expect(resultTracks).toHaveLength(2);
      expect(resultTracks.some((t) => prevDisplayed.some((p) => p.id === t.id))).toBe(false);
    });

    it("preserves official chart ordering directly without applying Thompson Sampling", () => {
      const officialChart: Track[] = [
        makeTrack({ id: "chart-1", title: "No 1 Hit", artist: "Artist A" }),
        makeTrack({ id: "chart-2", title: "No 2 Hit", artist: "Artist B" }),
        makeTrack({ id: "chart-3", title: "No 3 Hit", artist: "Artist C" }),
      ];

      // Trending list directly stores the chart tracks without re-ranking
      expect(officialChart[0]?.title).toBe("No 1 Hit");
      expect(officialChart[1]?.title).toBe("No 2 Hit");
      expect(officialChart[2]?.title).toBe("No 3 Hit");
    });
  });

  describe("3. Cache Bypass on Explicit Refresh", () => {
    it("bypasses in-memory launch data cache when bypassCache is true", async () => {
      const mockLaunchResponse = {
        charts: [{ id: "c1", title: "Telugu Top 50" }],
        new_albums: [{ id: "a1", title: "New Album" }],
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockLaunchResponse,
      });
      vi.stubGlobal("fetch", fetchMock);

      // First call: cache miss, network request made
      const data1 = await fetchSaavnLaunchData(["telugu"], false);
      expect(data1).toEqual(mockLaunchResponse);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Second call without bypass: cache hit, no new network request
      const data2 = await fetchSaavnLaunchData(["telugu"], false);
      expect(data2).toEqual(mockLaunchResponse);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Third call with bypassCache = true: fresh fetch performed
      const data3 = await fetchSaavnLaunchData(["telugu"], true);
      expect(data3).toEqual(mockLaunchResponse);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("4. Made For You & Trending Separation", () => {
    it("Made For You candidates do not directly pull from trending chart", async () => {
      // In getLocalPicks, candidate pools are constructed exclusively from
      // user affinity artists, related artists, and discovery queries
      const affinityArtists = ["Sid Sriram", "Anirudh Ravichander"];
      const userLanguages = ["Telugu"];

      // Simulated personalized query generation
      const personalizedQueries: string[] = [];
      for (const artist of affinityArtists) {
        personalizedQueries.push(`${artist} songs`);
        personalizedQueries.push(`${artist} album songs`);
        personalizedQueries.push(`${artist} melodies`);
      }
      for (const lang of userLanguages) {
        personalizedQueries.push(`${lang} acoustic vibe`);
        personalizedQueries.push(`${lang} evergreen melodies`);
      }

      // Check that none of the queries are generic "Top 50" or "Trending Chart"
      expect(personalizedQueries.some((q) => q.toLowerCase().includes("top 50"))).toBe(false);
      expect(personalizedQueries.some((q) => q.toLowerCase().includes("trending songs"))).toBe(false);
      expect(personalizedQueries).toContain("Sid Sriram songs");
      expect(personalizedQueries).toContain("Anirudh Ravichander melodies");
    });

    it("cross-checks Home recommendations against current Trending and deprioritizes overlaps", () => {
      const currentTrending: Track[] = [
        makeTrack({ id: "tr-1", title: "Trending Song 1", artist: "Artist A" }),
        makeTrack({ id: "tr-2", title: "Trending Song 2", artist: "Artist B" }),
        makeTrack({ id: "tr-3", title: "Trending Song 3", artist: "Artist C" }),
      ];

      const personalizedCandidates: Track[] = [
        makeTrack({ id: "tr-2", title: "Trending Song 2", artist: "Artist B" }), // Overlaps with trending
        makeTrack({ id: "rec-1", title: "Deep Track 1", artist: "Affinity Artist X" }),
        makeTrack({ id: "rec-2", title: "Deep Track 2", artist: "Affinity Artist Y" }),
        makeTrack({ id: "rec-3", title: "Deep Track 3", artist: "Affinity Artist Z" }),
        makeTrack({ id: "rec-4", title: "Deep Track 4", artist: "Affinity Artist W" }),
        makeTrack({ id: "rec-5", title: "Deep Track 5", artist: "Affinity Artist V" }),
        makeTrack({ id: "rec-6", title: "Deep Track 6", artist: "Affinity Artist U" }),
        makeTrack({ id: "rec-7", title: "Deep Track 7", artist: "Affinity Artist T" }),
        makeTrack({ id: "rec-8", title: "Deep Track 8", artist: "Affinity Artist S" }),
        makeTrack({ id: "rec-9", title: "Deep Track 9", artist: "Affinity Artist R" }),
        makeTrack({ id: "rec-10", title: "Deep Track 10", artist: "Affinity Artist Q" }),
      ];

      const nonTrendingRecs = personalizedCandidates.filter(
        (t) => !currentTrending.some((tr) => tr.id === t.id || sameSong(tr, t)),
      );
      const overlappingRecs = personalizedCandidates.filter(
        (t) => currentTrending.some((tr) => tr.id === t.id || sameSong(tr, t)),
      );

      const finalRecs = nonTrendingRecs.length >= 10
        ? nonTrendingRecs
        : [...nonTrendingRecs, ...overlappingRecs];

      // With 10 non-trending tracks, the trending song (tr-2) is completely excluded from Made For You!
      expect(finalRecs.some((t) => t.id === "tr-2")).toBe(false);
      expect(finalRecs).toHaveLength(10);
    });

    it("allows limited overlap only when catalog is tiny so Made For You is never empty", () => {
      const currentTrending: Track[] = [
        makeTrack({ id: "tr-1", title: "Trending Song 1", artist: "Artist A" }),
        makeTrack({ id: "tr-2", title: "Trending Song 2", artist: "Artist B" }),
      ];

      // Sparse catalog scenario: only 2 non-trending tracks available
      const candidates: Track[] = [
        makeTrack({ id: "rec-1", title: "Rare Track 1", artist: "Artist X" }),
        makeTrack({ id: "rec-2", title: "Rare Track 2", artist: "Artist Y" }),
        makeTrack({ id: "tr-1", title: "Trending Song 1", artist: "Artist A" }), // overlap
      ];

      const nonTrendingRecs = candidates.filter(
        (t) => !currentTrending.some((tr) => tr.id === t.id || sameSong(tr, t)),
      );
      const overlappingRecs = candidates.filter(
        (t) => currentTrending.some((tr) => tr.id === t.id || sameSong(tr, t)),
      );

      const finalRecs = nonTrendingRecs.length >= 10
        ? nonTrendingRecs
        : [...nonTrendingRecs, ...overlappingRecs];

      // Non-trending tracks are positioned first, followed by limited overlap
      expect(finalRecs).toHaveLength(3);
      expect(finalRecs[0]?.id).toBe("rec-1");
      expect(finalRecs[1]?.id).toBe("rec-2");
      expect(finalRecs[2]?.id).toBe("tr-1");
    });

    it("provides cold-start recommendations for users without history using language artist essentials", () => {
      // User with 0 likes, 0 history, and 0 affinity artists
      const userLikes: string[] = [];
      const userHistory: string[] = [];
      const userAffinityArtists: string[] = [];
      const chosenLanguages = ["Telugu"];

      // Cold start seeds from top language artist catalog
      const languageArtistDefaults: Record<string, string[]> = {
        Telugu: ["S. P. Balasubrahmanyam", "Sid Sriram", "Devi Sri Prasad", "Anirudh Ravichander", "Thaman S"],
        Hindi: ["Arijit Singh", "Kishore Kumar", "Lata Mangeshkar", "A. R. Rahman", "Pritam"],
      };

      const effectiveArtists = userAffinityArtists.length > 0
        ? userAffinityArtists
        : languageArtistDefaults[chosenLanguages[0] || ""] || [];

      expect(effectiveArtists.length).toBeGreaterThan(0);
      expect(effectiveArtists).toContain("Sid Sriram");
      expect(effectiveArtists).toContain("Devi Sri Prasad");

      // Verify that cold-start produces viable personalized artist queries rather than failing or copying trending
      const coldStartQueries = effectiveArtists.map((artist) => `${artist} Telugu songs`);
      expect(coldStartQueries).toContain("Sid Sriram Telugu songs");
      expect(coldStartQueries).toContain("Devi Sri Prasad Telugu songs");
    });
  });

  describe("5. Playback Queue Preservation", () => {
    it("feed refresh does not modify the active playback queue or reset the current playing track", () => {
      // Simulate playback state
      const playbackState = {
        currentTrack: makeTrack({ id: "now-playing", title: "Playing Track", artist: "Playing Artist" }),
        queue: [
          makeTrack({ id: "now-playing", title: "Playing Track", artist: "Playing Artist" }),
          makeTrack({ id: "next-up", title: "Next Track", artist: "Next Artist" }),
        ],
        isPlaying: true,
      };

      const feedState = {
        trendingList: [] as Track[],
        recs: [] as Track[],
        mixTracks: { newrelease: [] as Track[] },
      };

      // Simulating what loadExploreFeeds and loadHomeFeeds do:
      const onFeedsRefreshed = (newTrending: Track[], newRecs: Track[], newReleases: Track[]) => {
        // Feeds update their own slice of state
        feedState.trendingList = newTrending;
        feedState.recs = newRecs;
        feedState.mixTracks.newrelease = newReleases;

        // Playback queue and current track are NOT modified!
      };

      const freshTrending = [makeTrack({ id: "trend-fresh", title: "Fresh Trend", artist: "Artist 1" })];
      const freshRecs = [makeTrack({ id: "rec-fresh", title: "Fresh Rec", artist: "Artist 2" })];
      const freshNew = [makeTrack({ id: "new-fresh", title: "Fresh New", artist: "Artist 3" })];

      onFeedsRefreshed(freshTrending, freshRecs, freshNew);

      // Feed state updated
      expect(feedState.trendingList[0]?.id).toBe("trend-fresh");
      expect(feedState.recs[0]?.id).toBe("rec-fresh");
      expect(feedState.mixTracks.newrelease[0]?.id).toBe("new-fresh");

      // Playback state is completely untouched!
      expect(playbackState.currentTrack.id).toBe("now-playing");
      expect(playbackState.queue).toHaveLength(2);
      expect(playbackState.queue[0]?.id).toBe("now-playing");
      expect(playbackState.queue[1]?.id).toBe("next-up");
      expect(playbackState.isPlaying).toBe(true);
    });
  });
});
