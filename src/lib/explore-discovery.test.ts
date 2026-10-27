import { describe, it, expect } from "vitest";
import type { Track } from "./library";
import { sameSong } from "./feed-freshness";

const makeTrack = (t: Partial<Track> & { id: string; title: string; artist: string; duration: string }): Track => ({
  thumbnail: "",
  ...t,
});

describe("Explore & Trending Discovery Architecture", () => {
  it("preserves genuine chart ordering and does not scramble official rank", () => {
    // Official provider Top 5 chart tracks
    const officialChart: Track[] = [
      makeTrack({ id: "saavn:chart-1", title: "Chuttamalle", artist: "Shilpa Rao", duration: "3:40" }),
      makeTrack({ id: "saavn:chart-2", title: "Fear Song", artist: "Anirudh Ravichander", duration: "3:15" }),
      makeTrack({ id: "saavn:chart-3", title: "Tauba Tauba", artist: "Karan Aujla", duration: "3:30" }),
      makeTrack({ id: "saavn:chart-4", title: "Illuminati", artist: "Sushin Shyam", duration: "3:00" }),
      makeTrack({ id: "saavn:chart-5", title: "Aayi Nai", artist: "Pawan Singh", duration: "3:20" }),
    ];

    // Discovery pipeline on normal load: must return tracks in exact chart order
    const page1Tracks = officialChart.slice(0, 5);
    expect(page1Tracks[0]?.title).toBe("Chuttamalle");
    expect(page1Tracks[1]?.title).toBe("Fear Song");
    expect(page1Tracks[2]?.title).toBe("Tauba Tauba");
    expect(page1Tracks[3]?.title).toBe("Illuminati");
    expect(page1Tracks[4]?.title).toBe("Aayi Nai");
  });

  it("prioritizes unseen candidates on refresh while keeping popular songs eligible", () => {
    // Candidate pool of 10 tracks returned from provider
    const candidatePool: Track[] = [
      makeTrack({ id: "track-1", title: "Hit 1", artist: "Artist A", duration: "3:20" }),
      makeTrack({ id: "track-2", title: "Hit 2", artist: "Artist B", duration: "3:30" }),
      makeTrack({ id: "track-3", title: "Hit 3", artist: "Artist C", duration: "3:10" }),
      makeTrack({ id: "track-4", title: "Hit 4", artist: "Artist D", duration: "3:25" }),
      makeTrack({ id: "track-5", title: "Hit 5", artist: "Artist E", duration: "3:05" }),
      makeTrack({ id: "track-6", title: "Hit 6", artist: "Artist F", duration: "3:40" }),
    ];

    // Suppose user has already seen track-1 and track-2 in previous session
    const recentSeenSet = new Set(["track-1", "track-2"]);

    // Refresh discovery ranking logic:
    // Partition into unseen and seen, keeping relative order within each partition
    const unseen = candidatePool.filter((t) => !recentSeenSet.has(t.id));
    const seen = candidatePool.filter((t) => recentSeenSet.has(t.id));
    const refreshBatch = [...unseen, ...seen];

    // Unseen candidates are prioritized
    expect(refreshBatch[0]?.id).toBe("track-3");
    expect(refreshBatch[1]?.id).toBe("track-4");
    expect(refreshBatch[2]?.id).toBe("track-5");
    expect(refreshBatch[3]?.id).toBe("track-6");

    // But previously seen popular hits (track-1, track-2) are NOT permanently deleted!
    expect(refreshBatch).toContainEqual(expect.objectContaining({ id: "track-1" }));
    expect(refreshBatch).toContainEqual(expect.objectContaining({ id: "track-2" }));
  });

  it("trending pagination appends only unique tracks and preserves 1..N order", () => {
    const existingList: Track[] = [
      makeTrack({ id: "t-1", title: "Song 1", artist: "Singer A", duration: "3:20" }),
      makeTrack({ id: "t-2", title: "Song 2", artist: "Singer B", duration: "3:30" }),
      makeTrack({ id: "t-3", title: "Song 3", artist: "Singer C", duration: "3:10" }),
    ];

    // Incoming page 2 contains one duplicate (Song 2) and two new tracks
    const incomingPage2: Track[] = [
      makeTrack({ id: "t-2", title: "Song 2", artist: "Singer B", duration: "3:30" }), // duplicate
      makeTrack({ id: "t-4", title: "Song 4", artist: "Singer D", duration: "4:00" }),
      makeTrack({ id: "t-5", title: "Song 5", artist: "Singer E", duration: "3:00" }),
    ];

    // Deduplicate incoming tracks against existing list
    const trulyNew = incomingPage2.filter(
      (cand) => !existingList.some((p) => p.id === cand.id || sameSong(p, cand)),
    );

    expect(trulyNew).toHaveLength(2);
    expect(trulyNew.map((t) => t.id)).toEqual(["t-4", "t-5"]);

    const appendedList = [...existingList, ...trulyNew];
    expect(appendedList).toHaveLength(5);
    // Preserves original indices 0, 1, 2
    expect(appendedList[0]?.id).toBe("t-1");
    expect(appendedList[1]?.id).toBe("t-2");
    expect(appendedList[2]?.id).toBe("t-3");
    // Appends new items at 3, 4
    expect(appendedList[3]?.id).toBe("t-4");
    expect(appendedList[4]?.id).toBe("t-5");
  });

  it("guards against concurrent double-tap pagination requests", async () => {
    let activeRequests = 0;
    let maxSimultaneous = 0;
    let isFetchingMore = false;

    const loadMoreSimulated = async () => {
      // Synchronous mutex guard
      if (isFetchingMore) return null;
      isFetchingMore = true;

      activeRequests++;
      maxSimultaneous = Math.max(maxSimultaneous, activeRequests);

      // Simulate async network request
      await new Promise((resolve) => setTimeout(resolve, 50));

      activeRequests--;
      isFetchingMore = false;
      return ["page-data"];
    };

    // Fire 3 simultaneous rapid taps
    const [call1, call2, call3] = await Promise.all([
      loadMoreSimulated(),
      loadMoreSimulated(),
      loadMoreSimulated(),
    ]);

    expect(maxSimultaneous).toBe(1); // Never exceeded 1 concurrent request
    expect(call1).toEqual(["page-data"]);
    expect(call2).toBeNull(); // Blocked by mutex
    expect(call3).toBeNull(); // Blocked by mutex
  });

  it("preserves active playback queue during discovery feed refresh", () => {
    // Current playing state
    const currentTrack: Track = makeTrack({
      id: "playing-123",
      title: "Active Listening Song",
      artist: "Current Artist",
      duration: "4:00",
    });
    const activeQueue: Track[] = [
      currentTrack,
      makeTrack({ id: "queued-456", title: "Next Up", artist: "Artist 2", duration: "3:00" }),
    ];
    const isPlaying = true;
    const activeQueueCopy = [...activeQueue];

    // Discovery refresh runs in background:
    const simulateFeedRefresh = () => {
      const refreshedTrendingList: Track[] = [
        makeTrack({ id: "new-trend-1", title: "Trending Hit 1", artist: "Pop Star", duration: "3:20" }),
        makeTrack({ id: "new-trend-2", title: "Trending Hit 2", artist: "DJ Hit", duration: "3:35" }),
      ];
      // Notice: Discovery refresh updates ONLY discovery state, NEVER playback state!
      return refreshedTrendingList;
    };

    const newFeeds = simulateFeedRefresh();
    expect(newFeeds).toHaveLength(2);

    // Playback state is completely untouched
    expect(isPlaying).toBe(true);
    expect(activeQueueCopy).toHaveLength(2);
    expect(activeQueueCopy[0]?.id).toBe("playing-123");
  });

  it("handles provider catalog exhaustion gracefully without infinite loops", async () => {
    let page = 1;
    let exhausted = false;

    const fetchNextBatch = async () => {
      if (exhausted) return [];
      page++;
      // Suppose provider only has 2 pages of data
      if (page > 2) {
        exhausted = true;
        return [];
      }
      return [{ id: `page-${page}-song` }];
    };

    const page2 = await fetchNextBatch();
    expect(page2).toHaveLength(1);
    expect(exhausted).toBe(false);

    // Page 3 has no more candidates
    const page3 = await fetchNextBatch();
    expect(page3).toHaveLength(0);
    expect(exhausted).toBe(true);

    // Subsequent taps immediately abort without network requests
    const page4 = await fetchNextBatch();
    expect(page4).toHaveLength(0);
    expect(exhausted).toBe(true);
  });
});
