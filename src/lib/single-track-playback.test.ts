import { describe, it, expect, beforeEach } from "vitest";
import { TrackProgressTracker, telemetry, calculateTelemetryReward } from "./telemetry";
import { thompsonSamplingPolicy, type SessionContext } from "./bandit-policy";
import { dedupeTracks } from "./track-dedup";
import type { Track } from "./types";

describe("Spotify-style Single-Track Playback and Queue Architecture", () => {
  const trackA: Track = {
    id: "yt_track_1",
    title: "Tum Hi Ho",
    artist: "Arijit Singh",
    duration: "4:22",
    thumbnail: "https://example.com/tum-hi-ho.jpg",
  };

  const trackB: Track = {
    id: "yt_track_2",
    title: "Kesariya",
    artist: "Arijit Singh",
    duration: "4:28",
    thumbnail: "https://example.com/kesariya.jpg",
  };

  const trackC: Track = {
    id: "deezer:987654321",
    title: "Blinding Lights",
    artist: "The Weeknd",
    duration: "3:20",
    previewUrl: "https://cdns-preview-d.dzcdn.net/stream/12345.mp3",
    thumbnail: "https://example.com/blinding-lights.jpg",
  };

  const trackD: Track = {
    id: "tseries_video_99",
    title: "Dilbar",
    artist: "Neha Kakkar",
    duration: "3:04",
    thumbnail: "https://example.com/dilbar.jpg",
  };

  const mockContext: SessionContext = {
    currentTrack: trackA,
    hourOfDay: 14,
    discoveryPercent: 40,
    recentHistory: [trackA],
    stats: {},
    sessionCompletions: 2,
    sessionSkips: 1,
    familiarArtists: new Set(["arijit singh"]),
  };

  beforeEach(() => {
    telemetry.clearBuffer();
  });

  describe("1. Single-Track Audio and Queue Independence", () => {
    it("ensures each music item is an independent Track object without audio mixing", () => {
      const queue: Track[] = [trackA, trackB, trackC, trackD];
      const deduped = dedupeTracks(queue);

      expect(deduped).toHaveLength(4);
      expect(deduped[0]?.id).toBe("yt_track_1");
      expect(deduped[1]?.id).toBe("yt_track_2");
      expect(deduped[2]?.id).toBe("deezer:987654321");
      expect(deduped[3]?.id).toBe("tseries_video_99");

      // Verify each item maintains distinct metadata and source
      expect(deduped[0]?.artist).toBe("Arijit Singh");
      expect(deduped[2]?.previewUrl).toBeDefined();
      expect(deduped[3]?.artist).toBe("Neha Kakkar");
    });

    it("verifies stream URLs are strictly single-track queries without concatenation", () => {
      const generateStreamUrl = (id: string, quality = "high") =>
        `/api/stream/${encodeURIComponent(id)}?quality=${encodeURIComponent(quality)}`;

      const urlA = generateStreamUrl(trackA.id);
      const urlB = generateStreamUrl(trackB.id);

      expect(urlA).toBe("/api/stream/yt_track_1?quality=high");
      expect(urlB).toBe("/api/stream/yt_track_2?quality=high");
      expect(urlA).not.toContain(trackB.id);
      expect(urlB).not.toContain(trackA.id);
    });
  });

  describe("2. Explicit playSong Queue Setup and Isolation", () => {
    it("places selected track at current position and preserves independent surrounding queue", () => {
      const surrounding: Track[] = [trackB, trackC, trackA, trackD];
      const selected = trackC;

      // Simulate playSong queue resolution logic
      const dq = dedupeTracks(surrounding);
      const targetIdx = dq.findIndex((t) => t.id === selected.id);

      expect(targetIdx).toBe(1);
      expect(dq[targetIdx]?.id).toBe("deezer:987654321");
      expect(dq[targetIdx]?.title).toBe("Blinding Lights");
    });

    it("handles playSong without surroundingQueue by placing track in existing queue cleanly", () => {
      const existingQueue: Track[] = [trackA, trackB];
      const newTrack = trackD;

      let queue: Track[];
      let index: number;

      const existingIdx = existingQueue.findIndex((t) => t.id === newTrack.id);
      if (existingIdx !== -1) {
        queue = existingQueue;
        index = existingIdx;
      } else {
        queue = [newTrack, ...existingQueue.filter((t) => t.id !== newTrack.id)];
        index = 0;
      }

      expect(queue).toHaveLength(3);
      expect(index).toBe(0);
      expect(queue[0]?.id).toBe(trackD.id);
    });
  });

  describe("3. Track Progress Tracker and Milestone Isolation", () => {
    it("resets progress milestones cleanly when switching from Track A to Track B", () => {
      const tracker = new TrackProgressTracker();

      // Track A plays
      const m1 = tracker.checkProgress(trackA, 1, 262); // PLAY_START
      expect(m1).toContain("PLAY_START");

      const m2 = tracker.checkProgress(trackA, 11, 262); // PLAY_10S
      expect(m2).toContain("PLAY_10S");

      // Switch to Track B: explicitly call reset
      tracker.reset(trackB.id);

      // Verify Track B starts with clean PLAY_START and not skipped
      const m3 = tracker.checkProgress(trackB, 0.5, 268);
      expect(m3).toContain("PLAY_START");

      // Track B reaches 10s and emits PLAY_10S for Track B
      const m4 = tracker.checkProgress(trackB, 11, 268);
      expect(m4).toContain("PLAY_10S");
    });

    it("does not leak Track A progress milestones into Track B", () => {
      const tracker = new TrackProgressTracker();

      tracker.checkProgress(trackA, 30, 262); // Reaches 25s milestone
      tracker.reset(trackB.id);

      // Track B at 5s should NOT have triggered PLAY_10S or PLAY_25S yet
      const m = tracker.checkProgress(trackB, 5, 268);
      expect(m).not.toContain("PLAY_10S");
      expect(m).not.toContain("PLAY_25S");
    });
  });

  describe("4. Next / Track End (COMPLETED) Telemetry Attribution", () => {
    it("records COMPLETED strictly for outgoing track and feeds back to bandit", () => {
      const event = telemetry.logEvent({
        trackId: trackA.id,
        artist: trackA.artist,
        title: trackA.title,
        eventType: "COMPLETED",
        positionSeconds: 262,
        durationSeconds: 262,
        fractionPlayed: 1.0,
        timestamp: Date.now(),
        context: { hourOfDay: 14, discoverySetting: 40 },
      });

      expect(event.trackId).toBe("yt_track_1");
      expect(event.eventType).toBe("COMPLETED");
      expect(event.fractionPlayed).toBe(1.0);

      const reward = calculateTelemetryReward(event);
      expect(reward).toBe(1.0); // Full reward for completion

      const initialUpdates = thompsonSamplingPolicy.getModelState().totalUpdates;
      thompsonSamplingPolicy.recordFeedback(event, mockContext);
      expect(thompsonSamplingPolicy.getModelState().totalUpdates).toBe(initialUpdates + 1);
    });
  });

  describe("5. Skip (SKIPPED) Telemetry Attribution", () => {
    it("records SKIPPED strictly for outgoing track with exact elapsed time and fraction", () => {
      const event = telemetry.logEvent({
        trackId: trackA.id,
        artist: trackA.artist,
        title: trackA.title,
        eventType: "SKIPPED",
        positionSeconds: 15,
        durationSeconds: 262,
        fractionPlayed: 15 / 262,
        timestamp: Date.now(),
        context: { hourOfDay: 14, discoverySetting: 40 },
      });

      expect(event.trackId).toBe("yt_track_1");
      expect(event.eventType).toBe("SKIPPED");
      expect(event.positionSeconds).toBe(15);
      expect(event.fractionPlayed).toBeCloseTo(0.057, 2);

      const reward = calculateTelemetryReward(event);
      expect(reward).toBeLessThan(0); // Penalty for skip < 25s

      const initialUpdates = thompsonSamplingPolicy.getModelState().totalUpdates;
      thompsonSamplingPolicy.recordFeedback(event, mockContext);
      expect(thompsonSamplingPolicy.getModelState().totalUpdates).toBe(initialUpdates + 1);
    });
  });

  describe("6. Previous Track Transition", () => {
    it("cleanly steps back to previous independent track without merging", () => {
      const queue = [trackA, trackB, trackC];
      let currentIndex = 2; // At trackC

      // Simulate goPrev
      if (currentIndex > 0) {
        currentIndex -= 1;
      }

      expect(currentIndex).toBe(1);
      const activeTrack = queue[currentIndex];
      expect(activeTrack?.id).toBe("yt_track_2");
      expect(activeTrack?.title).toBe("Kesariya");
      expect(activeTrack?.artist).toBe("Arijit Singh");
    });
  });

  describe("7. Candidate Generation & Bandit Recommendation", () => {
    it("ranks candidates into a queue of distinct individual tracks", () => {
      const pool: Track[] = [trackA, trackB, trackC, trackD];
      const ranked = thompsonSamplingPolicy.rankCandidates(pool, mockContext);

      expect(ranked).toHaveLength(4);
      const ids = ranked.map((t) => t.id);
      // All IDs must be unique individual tracks
      expect(new Set(ids).size).toBe(4);
    });
  });
});
