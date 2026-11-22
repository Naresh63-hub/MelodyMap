import { describe, it, expect, vi } from "vitest";
import { buildOfflineMix } from "./offline-mix";
import type { DownloadInfo } from "./offline";
import type { Track } from "./library";
import { getTrackSource } from "./rec-source";
import type { SessionContext } from "./bandit-policy";

describe("buildOfflineMix (Task 10)", () => {
  const dummyTrack = (id: string, title: string, artist: string): Track => ({
    id,
    title,
    artist,
    duration: "3:30",
    thumbnail: "https://example.com/thumb.jpg",
  });

  it("filters downloads with blob > 10KB (10240 bytes) and excludes <= 10KB", async () => {
    const downloads: DownloadInfo[] = [
      { track: dummyTrack("d1", "Shape of You", "Ed Sheeran"), size: 10241, savedAt: 1000 },
      { track: dummyTrack("d2", "Corrupt Stub", "Artist 2"), size: 5000, savedAt: 2000 }, // <= 10KB
      { track: dummyTrack("d3", "Believer", "Imagine Dragons"), size: 50000, savedAt: 3000 },
    ];

    const mix = await buildOfflineMix({
      listDownloadsFn: async () => downloads,
      history: [],
    });

    expect(mix).toHaveLength(2);
    const ids = mix.map((t) => t.id);
    expect(ids).toContain("d1");
    expect(ids).toContain("d3");
  });

  it("combines downloaded tracks with cached history and deduplicates overlaps", async () => {
    const downloads: DownloadInfo[] = [
      { track: dummyTrack("d1", "Song A", "Artist A"), size: 20000, savedAt: 1000 },
      { track: dummyTrack("d2", "Song B", "Artist B"), size: 20000, savedAt: 2000 },
    ];
    const history: Track[] = [
      dummyTrack("d1", "Song A", "Artist A"), // overlap
      dummyTrack("h1", "Song C", "Artist C"),
    ];

    const mix = await buildOfflineMix({
      listDownloadsFn: async () => downloads,
      history,
    });

    expect(mix).toHaveLength(3);
    const ids = mix.map((t) => t.id);
    expect(ids).toContain("d1");
    expect(ids).toContain("d2");
    expect(ids).toContain("h1");
  });

  it("caps result at 30 tracks", async () => {
    const downloads: DownloadInfo[] = Array.from({ length: 40 }, (_, i) => ({
      track: dummyTrack(`d_${i}`, `Song ${i}`, `Artist ${i}`),
      size: 20000,
      savedAt: 1000 + i,
    }));

    const mix = await buildOfflineMix({
      listDownloadsFn: async () => downloads,
      history: [],
    });

    expect(mix).toHaveLength(30);
  });

  it("tags all tracks with 'offline-mix' source", async () => {
    const downloads: DownloadInfo[] = [
      { track: dummyTrack("d1", "Offline Song", "Artist"), size: 25000, savedAt: 1000 },
    ];

    const mix = await buildOfflineMix({
      listDownloadsFn: async () => downloads,
      history: [],
    });

    expect(mix).toHaveLength(1);
    expect(getTrackSource("d1")).toBe("offline-mix");
  });

  it("returns empty array when downloads and history are empty without throwing", async () => {
    const mix = await buildOfflineMix({
      listDownloadsFn: async () => [],
      history: [],
    });
    expect(mix).toEqual([]);
  });

  it("ranks candidates using custom ranker with session context", async () => {
    const downloads: DownloadInfo[] = [
      { track: dummyTrack("d1", "Song 1", "Artist 1"), size: 20000, savedAt: 1000 },
      { track: dummyTrack("d2", "Song 2", "Artist 2"), size: 20000, savedAt: 2000 },
    ];
    const ctx: SessionContext = { hourOfDay: 23 };

    // Custom ranker reversing candidates
    const rankSpy = vi.fn((cands: Track[], _sessionCtx: SessionContext) => [...cands].reverse());

    const mix = await buildOfflineMix({
      listDownloadsFn: async () => downloads,
      history: [],
      ctx,
      rankCandidatesFn: rankSpy,
    });

    expect(rankSpy).toHaveBeenCalledTimes(1);
    expect(rankSpy).toHaveBeenCalledWith(expect.any(Array), ctx);
    expect(mix[0]?.id).toBe("d2");
    expect(mix[1]?.id).toBe("d1");
  });

  it("handles offline state (mocked navigator.onLine = false)", async () => {
    const originalNavigator = globalThis.navigator;
    try {
      Object.defineProperty(globalThis, "navigator", {
        value: { onLine: false },
        configurable: true,
        writable: true,
      });

      expect(navigator.onLine).toBe(false);

      const downloads: DownloadInfo[] = [
        { track: dummyTrack("d_off", "Offline Hit", "Artist"), size: 15000, savedAt: 500 },
      ];
      const mix = await buildOfflineMix({
        listDownloadsFn: async () => downloads,
        history: [],
      });

      expect(mix).toHaveLength(1);
      expect(mix[0]?.id).toBe("d_off");
      expect(getTrackSource("d_off")).toBe("offline-mix");
    } finally {
      Object.defineProperty(globalThis, "navigator", {
        value: originalNavigator,
        configurable: true,
        writable: true,
      });
    }
  });

  it("handles failing fetch / network error simulation and serves offline mix", async () => {
    // Simulate failing fetch
    const failingFetch = vi.fn(async () => {
      throw new Error("NetworkError: Failed to fetch online feed");
    });

    let offlineMixResult: Track[] = [];
    try {
      await failingFetch();
    } catch {
      // Catch block fallback to offline mix
      offlineMixResult = await buildOfflineMix({
        listDownloadsFn: async () => [
          { track: dummyTrack("fallback1", "Fallback Track", "Artist"), size: 25000, savedAt: 100 },
        ],
        history: [dummyTrack("hist1", "History Track", "Artist")],
      });
    }

    expect(offlineMixResult).toHaveLength(2);
    const resultIds = offlineMixResult.map((t) => t.id);
    expect(resultIds).toContain("fallback1");
    expect(resultIds).toContain("hist1");
    expect(getTrackSource("fallback1")).toBe("offline-mix");
    expect(getTrackSource("hist1")).toBe("offline-mix");
  });
});
