import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { AudioPrefetchManager } from "./audio-prefetch";
import { setLowNetworkMode } from "./network-mode";

describe("AudioPrefetchManager", () => {
  let prefetchManager: AudioPrefetchManager;

  beforeEach(() => {
    prefetchManager = new AudioPrefetchManager();
    setLowNetworkMode(false);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    prefetchManager.clear();
    setLowNetworkMode(false);
  });

  describe("1. Prefetch Trigger Rules", () => {
    it("rejects non-finite or non-positive durations", () => {
      expect(prefetchManager.shouldTriggerPrefetch(0, 0)).toBe(false);
      expect(prefetchManager.shouldTriggerPrefetch(10, -5)).toBe(false);
      expect(prefetchManager.shouldTriggerPrefetch(10, NaN)).toBe(false);
      expect(prefetchManager.shouldTriggerPrefetch(10, Infinity)).toBe(false);
    });

    it("requires at least 10s of playback for standard tracks to prevent rapid-skimming waste", () => {
      // 5 seconds into a 180s song: 175s remaining (> 20s) and played < 10s -> false
      expect(prefetchManager.shouldTriggerPrefetch(5, 180)).toBe(false);

      // 5 seconds into a 22s song: 17s remaining (<= 20s) BUT played < 10s -> false
      expect(prefetchManager.shouldTriggerPrefetch(5, 22)).toBe(false);
    });

    it("triggers when remaining duration is <= 20 seconds after 10s played", () => {
      // 185s into a 200s song (15s remaining, played > 10s) -> true
      expect(prefetchManager.shouldTriggerPrefetch(185, 200)).toBe(true);
      // 180s into a 200s song (20s remaining, played > 10s) -> true
      expect(prefetchManager.shouldTriggerPrefetch(180, 200)).toBe(true);
      // 170s into a 200s song (30s remaining, 85% is 170) -> true (85% threshold)
      expect(prefetchManager.shouldTriggerPrefetch(170, 200)).toBe(true);
      // 100s into a 200s song (100s remaining, 50%) -> false
      expect(prefetchManager.shouldTriggerPrefetch(100, 200)).toBe(false);
    });

    it("triggers on >= 85% completion for short tracks", () => {
      // 12s into a 14s song (played < 10s, but duration <= 15s so skimming guard is relaxed)
      expect(prefetchManager.shouldTriggerPrefetch(12, 14)).toBe(true);
    });
  });

  describe("2. Format and Bitrate-Aware Chunk Sizing", () => {
    it("allocates 96 KB for saver quality", () => {
      expect(prefetchManager.getTargetChunkSizeBytes("saver")).toBe(96 * 1024);
    });

    it("allocates 160 KB for standard quality", () => {
      expect(prefetchManager.getTargetChunkSizeBytes("standard")).toBe(160 * 1024);
    });

    it("allocates 256 KB for high quality", () => {
      expect(prefetchManager.getTargetChunkSizeBytes("high")).toBe(256 * 1024);
    });
  });

  describe("3. Tier 1 Playable URL Pre-Resolution & Caching", () => {
    it("resolves and caches direct CDN URLs without proxy roundtrip", async () => {
      const mockResolver = vi.fn();
      const result = await prefetchManager.prefetchNextTrack({
        nextTrack: {
          id: "saavn:song_123",
          previewUrl: "https://aac.saavncdn.com/123/song_320.mp4",
          title: "Direct Song",
          artist: "Artist",
        },
        quality: "high",
        sessionId: 1,
        streamUrlResolver: mockResolver,
      });

      expect(mockResolver).not.toHaveBeenCalled();
      expect(result.url).toBe("https://aac.saavncdn.com/123/song_320.mp4");
      expect(prefetchManager.getPrewarmedUrl("saavn:song_123")).toBe("https://aac.saavncdn.com/123/song_320.mp4");
    });

    it("uses streamUrlResolver for catalog items requiring proxy resolution", async () => {
      const mockResolver = vi.fn((id, q) => `/api/stream/${id}?quality=${q}`);
      const result = await prefetchManager.prefetchNextTrack({
        nextTrack: {
          id: "yt_track_abc",
          title: "Proxy Song",
          artist: "Artist",
        },
        quality: "high",
        sessionId: 1,
        streamUrlResolver: mockResolver,
      });

      expect(mockResolver).toHaveBeenCalledWith("yt_track_abc", "high", "Proxy Song", "Artist");
      expect(result.url).toBe("/api/stream/yt_track_abc?quality=high");
      expect(prefetchManager.getPrewarmedUrl("yt_track_abc")).toBe("/api/stream/yt_track_abc?quality=high");
    });

    it("deduplicates requests if the track is already cached", async () => {
      const mockResolver = vi.fn((id, q) => `/api/stream/${id}?quality=${q}`);
      // First call
      await prefetchManager.prefetchNextTrack({
        nextTrack: { id: "track_dup", title: "Song" },
        sessionId: 1,
        streamUrlResolver: mockResolver,
      });
      expect(mockResolver).toHaveBeenCalledTimes(1);

      // Second call for same track
      const secondResult = await prefetchManager.prefetchNextTrack({
        nextTrack: { id: "track_dup", title: "Song" },
        sessionId: 1,
        streamUrlResolver: mockResolver,
      });

      expect(mockResolver).toHaveBeenCalledTimes(1); // not called again
      expect(secondResult.reason).toBe("already_cached");
    });
  });

  describe("4. Data Saver / Low Network Mode Respect", () => {
    it("suppresses byte-level chunk prebuffering when Data Saver is active", async () => {
      setLowNetworkMode(true);
      const mockResolver = vi.fn((id, q) => `/api/stream/${id}?quality=${q}`);

      const result = await prefetchManager.prefetchNextTrack({
        nextTrack: { id: "data_saver_track" },
        quality: "saver",
        sessionId: 1,
        streamUrlResolver: mockResolver,
      });

      // URL pre-resolution succeeds (Tier 1), but byte prebuffer is suppressed (Tier 2)
      expect(result.url).toBe("/api/stream/data_saver_track?quality=saver");
      expect(result.prebuffered).toBe(false);
      expect(result.reason).toBe("data_saver_enabled");
    });
  });

  describe("5. In-Flight Cancellation & Stale Session Protection", () => {
    it("cancels in-flight prefetch when abort() is called", async () => {
      let capturedSignal: AbortSignal | null = null;
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation((_url, init) => {
        capturedSignal = init?.signal;
        return new Promise((resolve) => setTimeout(resolve, 500));
      });

      try {
        const prefetchPromise = prefetchManager.prefetchNextTrack({
          nextTrack: { id: "abort_track" },
          quality: "high",
          sessionId: 1,
          streamUrlResolver: (id) => `/api/stream/${id}`,
        });

        // Immediately abort
        prefetchManager.abort();

        expect((capturedSignal as any)?.aborted).toBe(true);
        const res = await prefetchPromise;
        expect(res.url).toBeNull();
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("discards prefetch result if session ID changes mid-flight", async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
              body: {
                getReader: () => ({
                  read: () => Promise.resolve({ done: true, value: undefined }),
                  cancel: () => Promise.resolve(),
                }),
              },
            });
          }, 50);
        });
      });

      try {
        const promise = prefetchManager.prefetchNextTrack({
          nextTrack: { id: "session_track" },
          quality: "high",
          sessionId: 10,
          streamUrlResolver: (id) => `/api/stream/${id}`,
        });

        // Advance to next track / session immediately
        await prefetchManager.prefetchNextTrack({
          nextTrack: { id: "new_track" },
          quality: "high",
          sessionId: 11,
          streamUrlResolver: (id) => `/api/stream/${id}`,
        });

        const res1 = await promise;
        expect(res1.url).toBeNull();
        expect(res1.reason).toBe("aborted");
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe("6. Cache TTL & Invalidation", () => {
    it("expires cached URLs after TTL (10 minutes)", () => {
      const originalNow = Date.now;
      let mockTime = 1000000;
      Date.now = () => mockTime;

      try {
        prefetchManager["cache"].set("expiring_track", {
          trackId: "expiring_track",
          url: "https://example.com/audio.mp4",
          isDirect: true,
          resolvedAt: mockTime,
        });

        expect(prefetchManager.getPrewarmedUrl("expiring_track")).toBe("https://example.com/audio.mp4");

        // Fast forward 10 minutes + 1 second
        mockTime += 10 * 60 * 1000 + 1000;
        expect(prefetchManager.getPrewarmedUrl("expiring_track")).toBeNull();
      } finally {
        Date.now = originalNow;
      }
    });

    it("clears entire cache on clear()", () => {
      prefetchManager["cache"].set("t1", {
        trackId: "t1",
        url: "https://example.com/t1",
        isDirect: true,
        resolvedAt: Date.now(),
      });

      expect(prefetchManager.getPrewarmedUrl("t1")).toBe("https://example.com/t1");
      prefetchManager.clear();
      expect(prefetchManager.getPrewarmedUrl("t1")).toBeNull();
    });
  });
});
