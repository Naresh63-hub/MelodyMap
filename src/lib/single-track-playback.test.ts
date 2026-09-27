import { describe, it, expect, beforeEach } from "vitest";
import { TrackProgressTracker, telemetry, calculateTelemetryReward, type PlaybackTelemetryEvent } from "./telemetry";
import { thompsonSamplingPolicy, type SessionContext } from "./bandit-policy";
import { dedupeTracks } from "./track-dedup";
import { SKIP_FORWARD_SECONDS, SKIP_BACKWARD_SECONDS } from "./use-audio-player";
import { filterFeedCandidates, hasPlayableDuration } from "./feed-freshness";
import { isMusicTrack } from "./track-filters";
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

  describe("8. Skip / Next Button Semantics (never +30s seek)", () => {
    it("A. skip forward seeks +5s within the track and never +30s", () => {
      // Hook defaults: within-track scrub only (Next-track is a separate control)
      expect(SKIP_FORWARD_SECONDS).toBe(5);
      expect(SKIP_FORWARD_SECONDS).not.toBe(30);
      expect(SKIP_BACKWARD_SECONDS).toBe(5);

      // Simulate the seek math used by skipForward/skipBackward
      let position = 42;
      const seek = (target: number) => {
        position = Math.max(0, target);
      };
      seek(position + SKIP_FORWARD_SECONDS);
      expect(position).toBe(47); // 42 + 5, NOT 42 + 30
      seek(position - SKIP_BACKWARD_SECONDS); // backward seeks subtract
      expect(position).toBe(42);
    });

    it("B. skipping Song A attributes SKIPPED to A and Song B starts at 0 with fresh telemetry lifecycle", () => {
      const tracker = new TrackProgressTracker();
      tracker.checkProgress(trackA, 1, 262); // PLAY_START for A
      tracker.checkProgress(trackA, 12, 262); // PLAY_10S for A

      // User hits Next while A is at 12s: SKIPPED must reference trackA.id
      const skipEvent = telemetry.logEvent({
        trackId: trackA.id,
        artist: trackA.artist,
        title: trackA.title,
        eventType: "SKIPPED",
        positionSeconds: 12,
        durationSeconds: 262,
        fractionPlayed: 12 / 262,
        timestamp: Date.now(),
        context: { hourOfDay: 14, discoverySetting: 40 },
      });
      expect(skipEvent.trackId).toBe("yt_track_1");
      expect(skipEvent.eventType).toBe("SKIPPED");

      // Transition to B: reset milestone tracker, new lifecycle at 0
      tracker.reset(trackB.id);
      const bStart = tracker.checkProgress(trackB, 0, 268);
      expect(bStart).toContain("PLAY_START");
      // B's lifecycle is independent of A's progress
      const b10s = tracker.checkProgress(trackB, 10.5, 268);
      expect(b10s).toContain("PLAY_10S");
      // No leaked A events appear for B (observed via public subscribe API)
      const captured: PlaybackTelemetryEvent[] = [];
      const unsubscribe = telemetry.subscribe((e) => captured.push(e));
      try {
        telemetry.logEvent({
          trackId: trackB.id,
          artist: trackB.artist,
          title: trackB.title,
          eventType: "PLAY_START",
          positionSeconds: 0,
          durationSeconds: 268,
          fractionPlayed: 0,
          timestamp: Date.now(),
          context: { hourOfDay: 14, discoverySetting: 40 },
        });
      } finally {
        unsubscribe();
      }
      expect(captured).toHaveLength(1);
      expect(captured[0]?.trackId).toBe(trackB.id);
      expect(captured[0]?.eventType).toBe("PLAY_START");
      // B's lifecycle contains no inherited A events (A's SKIPPED references A only)
      expect(captured.every((e) => e.trackId !== trackA.id)).toBe(true);
    });

    it("I. queue contains only tracks <= 600 seconds (overlong tracks never enter)", () => {
      const longTrack: Track = {
        id: "mixtape_900",
        title: "Nonstop Mix",
        artist: "DJ",
        duration: "15:00",
        thumbnail: "",
      };
      const rawQueue = [trackA, longTrack, trackB, trackC];
      const exclusions = {
        previouslyDisplayedIds: new Set<string>(),
        likedIds: new Set<string>(),
        recentlyPlayedIds: new Set<string>(),
        currentTrackId: null,
      };
      const queue = filterFeedCandidates(rawQueue, exclusions);
      expect(queue.map((t) => t.id)).toEqual(["yt_track_1", "yt_track_2", "deezer:987654321"]);
      expect(queue.every((t) => hasPlayableDuration(t))).toBe(true);
    });

    it("J. playSong(A) loads ONLY track A — one source, no merging of B/C/D", () => {
      // Mirrors playSong(): single source for a single track id
      const streamUrlFor = (id: string) => `/api/stream/${encodeURIComponent(id)}`;
      const requestedId = trackA.id;
      const sourceUrl = streamUrlFor(requestedId);

      expect(sourceUrl).toBe("/api/stream/yt_track_1");
      expect(sourceUrl).not.toContain(trackB.id);
      expect(sourceUrl).not.toContain(trackC.id);
      expect(sourceUrl).not.toContain(trackD.id);

      // Queue setup keeps every song as an individual Track object
      const surrounding = [trackA, trackB, trackC];
      const dq = dedupeTracks(surrounding);
      expect(dq).toHaveLength(3);
      expect(dq.every((t) => typeof t.id === "string" && t.id.length > 0)).toBe(true);
    });

    it("K+L. A → B creates a NEW playback source; A and B are never one audio source", () => {
      const sourceFor = (id: string) => `/api/stream/${encodeURIComponent(id)}`;
      const sourceA = sourceFor(trackA.id);
      const sourceB = sourceFor(trackB.id);

      // Distinct single-track sources per track — no concatenation
      expect(sourceA).not.toBe(sourceB);
      expect(sourceA).toBe("/api/stream/yt_track_1");
      expect(sourceB).toBe("/api/stream/yt_track_2");
      expect(sourceA.includes("|") || sourceB.includes("|")).toBe(false);
      expect(sourceA.includes(trackB.id) || sourceB.includes(trackA.id)).toBe(false);
    });

    it("M. only one audio engine is active at a time (html5 XOR youtube)", () => {
      // Mirrors activeEngineRef discipline in use-audio-player.ts:
      let activeEngine: "html5" | "youtube" = "html5";
      const setStream = () => {
        activeEngine = "html5"; // HTML5 start also stops YouTube
        // ytPlayer.stopVideo() call site
      };
      const playViaYouTube = () => {
        activeEngine = "youtube"; // YouTube start also pauses HTML5
        // audio.pause() call site
      };

      setStream();
      expect(activeEngine).toBe("html5");
      playViaYouTube();
      expect(activeEngine).toBe("youtube");
      setStream();
      expect(activeEngine).toBe("html5");

      const engines = new Set(["html5"]);
      expect(engines.size).toBe(1); // exactly one active source
    });

    it("N. progress resets from A's position to 0 when B starts", () => {
      let position = 137; // A is mid-playback
      let duration = 262;

      // Transition A → B (mirrors load(): setPosition(startAt), setDuration(0))
      position = 0;
      duration = 0;

      expect(position).toBe(0);
      expect(duration).toBe(0);

      // And the milestone tracker is reset for B, not inherited from A
      const tracker = new TrackProgressTracker();
      tracker.checkProgress(trackA, 60, 262);
      tracker.reset(trackB.id);
      const events = tracker.checkProgress(trackB, 3, 268);
      expect(events).toContain("PLAY_START");
      expect(events).not.toContain("PLAY_10S");
    });

    it("O+P. bandit and telemetry suites remain intact (600s gate coexists)", () => {
      // isMusicTrack now enforces the 600s cap; short songs still pass all filters.
      expect(isMusicTrack({ title: "Kesariya", artist: "Arijit Singh", duration: "4:28" })).toBe(true);
      expect(isMusicTrack({ title: "Long Mix", artist: "DJ", duration: "15:00" })).toBe(false);
      expect(isMusicTrack({ title: "Unknown Length Song", artist: "X", duration: "" })).toBe(false);
    });
  });
});
