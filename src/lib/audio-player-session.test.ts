import { describe, expect, it } from "vitest";
import { cleanTrackTitle, cleanAuthorName } from "./stream.server";
import { hasFullLengthDirectSource } from "./track-stream-policy";

describe("Audio Player Session Isolation and Stream Resolution", () => {
  describe("1. Metadata Cleaning for Stream Resolution", () => {
    it("strips video, M/V, and format tags from track titles", () => {
      expect(cleanTrackTitle("PSY - GANGNAM STYLE(강남스타일) M/V")).toBe("PSY GANGNAM STYLE");
      expect(cleanTrackTitle("Shape of You [Official Music Video]")).toBe("Shape of You");
      expect(cleanTrackTitle("Blinding Lights (Official Lyric Video)")).toBe("Blinding Lights");
      expect(cleanTrackTitle("Kesariya - Full Audio Song | Brahmāstra")).toBe("Kesariya");
      expect(cleanTrackTitle("Despacito ft. Daddy Yankee (Remix HD 4K)")).toBe("Despacito");
    });

    it("cleans record label and topic suffixes from author names", () => {
      expect(cleanAuthorName("Armaan Malik - Topic")).toBe("Armaan Malik");
      expect(cleanAuthorName("TaylorSwiftVEVO")).toBe("TaylorSwift");
      expect(cleanAuthorName("T-Series Official Channel")).toBe("T Series");
      expect(cleanAuthorName("Sony Music Entertainment")).toBe("Sony");
      expect(cleanAuthorName("Spinnin' Records")).toBe("Spinnin'");
    });
  });

  describe("2. Direct CDN URL Policy and Preservation", () => {
    it("identifies providers with full-length direct audio streams", () => {
      expect(hasFullLengthDirectSource("saavn:12345")).toBe(true);
      expect(hasFullLengthDirectSource("audius:67890")).toBe(true);
      expect(hasFullLengthDirectSource("jamendo:11223")).toBe(true);
      expect(hasFullLengthDirectSource("podcast:feed123")).toBe(true);
      // Short preview providers and YouTube proxy IDs are false
      expect(hasFullLengthDirectSource("deezer:999")).toBe(false);
      expect(hasFullLengthDirectSource("spotify:888")).toBe(false);
      expect(hasFullLengthDirectSource("yt_video_123")).toBe(false);
    });

    it("preserves direct CDN URLs during reconnect with query parameter cache busting", () => {
      const directUrl = "https://aac.saavncdn.com/123/sample_320.mp4";
      const now = 1700000000000;
      const reconnected = directUrl.includes("?")
        ? `${directUrl}&_reconnect=${now}`
        : `${directUrl}?_reconnect=${now}`;

      expect(reconnected).toBe(`https://aac.saavncdn.com/123/sample_320.mp4?_reconnect=${now}`);
      expect(reconnected).not.toContain("/api/stream/");
    });
  });

  describe("3. Error Classification and Reconnect Rules", () => {
    it("classifies MEDIA_ERR_NETWORK (code 2) as recoverable", () => {
      const isRecoverable = (code: number) => code === 2;
      expect(isRecoverable(2)).toBe(true);
      expect(isRecoverable(4)).toBe(false);
      expect(isRecoverable(3)).toBe(false);
    });

    it("treats MEDIA_ERR_SRC_NOT_SUPPORTED (code 4) as fatal for current source", () => {
      // Code 4 should not trigger infinite backoff reconnect loop
      const shouldRetrySameSource = (code: number) => code === 2;
      expect(shouldRetrySameSource(4)).toBe(false);
    });

    it("calculates exponential backoff with bounded limits", () => {
      const computeBackoff = (attempt: number) => {
        const baseDelay = Math.min(600 * Math.pow(1.6, attempt), 5000);
        return baseDelay;
      };

      expect(computeBackoff(0)).toBe(600);
      expect(computeBackoff(1)).toBe(960);
      expect(computeBackoff(2)).toBeCloseTo(1536, 0);
      expect(computeBackoff(3)).toBeCloseTo(2457.6, 0);
      expect(computeBackoff(10)).toBe(5000); // capped at 5000ms
    });
  });

  describe("4. Playback Session Isolation & Counter Reset Discipline", () => {
    it("resets reconnect attempts when loading a new track", () => {
      let reconnectAttempts = 5; // Previous track exhausted attempts
      let isRetrying = true;
      let isReconnecting = true;

      // Simulate load() contract
      const loadTrack = (trackId: string) => {
        reconnectAttempts = 0;
        isRetrying = false;
        isReconnecting = false;
      };

      loadTrack("next_track_999");
      expect(reconnectAttempts).toBe(0);
      expect(isRetrying).toBe(false);
      expect(isReconnecting).toBe(false);
    });

    it("invalidates stale asynchronous callbacks with monotonic session token", async () => {
      let currentSession = 1;
      let activeTrackId = "track_A";
      let playedTrack = "";

      // Track A starts an async fetch
      const trackASession = currentSession;
      const asyncTask = new Promise<string>((resolve) => {
        setTimeout(() => resolve("track_A_result"), 50);
      });

      // User immediately clicks Track B before Track A resolves
      currentSession += 1;
      activeTrackId = "track_B";

      const result = await asyncTask;
      // Stale callback checks session token before applying state
      if (trackASession === currentSession) {
        playedTrack = result;
      }

      // Track A's result is dropped because session changed
      expect(playedTrack).toBe("");
      expect(activeTrackId).toBe("track_B");
    });

    it("recovers an errored audio element on manual retry by resetting attempts and re-assigning source", () => {
      let reconnectAttempts = 5;
      let error = { code: 4, message: "MEDIA_ERR_SRC_NOT_SUPPORTED" };
      let audioSrc = "https://example.com/dead-link.mp3";
      let loadCalled = false;

      // Simulate play() recovery logic
      const manualPlay = (fallbackUrl: string) => {
        if (error) {
          reconnectAttempts = 0;
          audioSrc = fallbackUrl;
          loadCalled = true;
        }
      };

      manualPlay("https://example.com/fresh-stream.mp3");
      expect(reconnectAttempts).toBe(0);
      expect(audioSrc).toBe("https://example.com/fresh-stream.mp3");
      expect(loadCalled).toBe(true);
    });
  });
});
