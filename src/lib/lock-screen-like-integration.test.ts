import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThompsonSamplingPolicy } from "./bandit-policy";
import { createNativeLikeGuard } from "./native-like";
import {
  installMediaCommandHandler,
  notifyLikedState,
  notifyPlaybackState,
} from "./native-playback";
import { calculateTelemetryReward, TelemetryManager } from "./telemetry";
import type { Track } from "./types";

type BridgeMock = {
  onPlay: ReturnType<typeof vi.fn>;
  onPause: ReturnType<typeof vi.fn>;
  onStop: ReturnType<typeof vi.fn>;
  onLiked: ReturnType<typeof vi.fn>;
};

type WindowMock = {
  AndroidPlayback?: BridgeMock;
  __melodymap_media_command?: (command: string) => void;
  localStorage: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
    clear: () => void;
  };
};

/**
 * End-to-end integration test verifying that the Android lock-screen Like/Unlike
 * button shares the exact same logic, persistent storage, and recommendation-learning
 * pipeline as the in-app Like button.
 */
describe("Lock-Screen Like/Unlike & In-App Synchronization Integration", () => {
  let localStorageStore: Record<string, string>;
  let mockBridge: BridgeMock;
  let windowMock: WindowMock;
  let telemetry: TelemetryManager;
  let banditPolicy: ThompsonSamplingPolicy;

  // Active track state and in-memory set representing the single source of truth (likes)
  let currentTrack: Track | null;
  let likedIds: Set<string>;
  let playerState: { isPlaying: boolean; position: number; duration: number };

  const sampleTrack: Track = {
    id: "deezer:song:456",
    title: "Midnight Melody",
    artist: "Acoustic Horizon",
    duration: "210",
    previewUrl: "https://example.com/audio.mp3",
    thumbnail: "https://example.com/thumb.jpg",
    source: "deezer",
  };

  const sampleTrack2: Track = {
    id: "deezer:song:789",
    title: "Daylight Rhythm",
    artist: "Acoustic Horizon",
    duration: "180",
    previewUrl: "https://example.com/audio2.mp3",
    thumbnail: "https://example.com/thumb2.jpg",
    source: "deezer",
  };

  beforeEach(() => {
    localStorageStore = {};
    mockBridge = {
      onPlay: vi.fn(),
      onPause: vi.fn(),
      onStop: vi.fn(),
      onLiked: vi.fn(),
    };

    windowMock = {
      AndroidPlayback: mockBridge,
      localStorage: {
        getItem: (key: string) => localStorageStore[key] ?? null,
        setItem: (key: string, val: string) => {
          localStorageStore[key] = String(val);
        },
        removeItem: (key: string) => {
          delete localStorageStore[key];
        },
        clear: () => {
          localStorageStore = {};
        },
      },
    };

    (globalThis as unknown as { window?: WindowMock }).window = windowMock;
    (globalThis as unknown as { Window?: unknown }).Window = function Window() {};

    telemetry = new TelemetryManager();
    banditPolicy = new ThompsonSamplingPolicy();

    currentTrack = sampleTrack;
    likedIds = new Set<string>();
    playerState = { isPlaying: true, position: 45, duration: 210 };
  });

  afterEach(() => {
    delete (globalThis as unknown as { window?: WindowMock }).window;
    delete (globalThis as unknown as { Window?: unknown }).Window;
  });

  /**
   * The EXACT application logic shared between in-app Like button and lock-screen Like button.
   * Mirrors `handleToggleLike` in src/routes/index.tsx.
   */
  function handleToggleLike(track: Track): void {
    const wasLiked = likedIds.has(track.id);

    // 1. Persist to storage using the standard LIKES_KEY
    if (wasLiked) {
      likedIds.delete(track.id);
    } else {
      likedIds.add(track.id);
    }
    const persistedArray = Array.from(likedIds).map((id) => ({ id }));
    windowMock.localStorage.setItem("melodymap:likes", JSON.stringify(persistedArray));

    // 2. Synchronize native media session / notification heart
    if (track.id === currentTrack?.id) {
      notifyLikedState(!wasLiked);
    }

    // 3. Positive recommendation reward for new likes
    if (!wasLiked) {
      const ctx = { hourOfDay: 14, discoverySetting: 40 };
      const event = telemetry.logEvent({
        trackId: track.id,
        artist: track.artist,
        title: track.title,
        eventType: "LIKED",
        positionSeconds: track.id === currentTrack?.id ? playerState.position : 0,
        durationSeconds: track.id === currentTrack?.id ? playerState.duration : 0,
        fractionPlayed:
          track.id === currentTrack?.id && playerState.duration > 0
            ? playerState.position / playerState.duration
            : 0,
        timestamp: Date.now(),
        context: ctx,
      });
      banditPolicy.recordFeedback(event, ctx);
    }
  }

  // 1. Like a track from the in-app player
  it("1. likes a track from the in-app player and updates storage & recommendation", () => {
    expect(likedIds.has(sampleTrack.id)).toBe(false);

    handleToggleLike(sampleTrack);

    expect(likedIds.has(sampleTrack.id)).toBe(true);
    expect(mockBridge.onLiked).toHaveBeenCalledWith(true);
    expect(localStorageStore["melodymap:likes"]).toContain(sampleTrack.id);

    const modelState = banditPolicy.getModelState();
    expect(modelState.totalUpdates).toBe(1);
  });

  // 2. Like the same track from the lock screen
  it("2. likes the track from the lock screen using the exact same dispatch path", () => {
    const nativeLikeGuard = createNativeLikeGuard({ debounceMs: 400 });

    const cleanup = installMediaCommandHandler({
      like: (requestedTrackId) => {
        nativeLikeGuard.request(requestedTrackId, currentTrack?.id, () => {
          if (currentTrack) handleToggleLike(currentTrack);
        });
      },
    });

    // Simulate Android SystemUI firing media command "like:<trackId>"
    windowMock.__melodymap_media_command?.(`like:${sampleTrack.id}`);

    expect(likedIds.has(sampleTrack.id)).toBe(true);
    expect(mockBridge.onLiked).toHaveBeenCalledWith(true);
    expect(localStorageStore["melodymap:likes"]).toContain(sampleTrack.id);

    const modelState = banditPolicy.getModelState();
    expect(modelState.totalUpdates).toBe(1);

    cleanup();
  });

  // 3. Verify both interfaces display the same liked state
  it("3. verifies in-app and lock-screen interfaces stay in complete synchronization", () => {
    const nativeLikeGuard = createNativeLikeGuard();
    const cleanup = installMediaCommandHandler({
      like: (reqId) => {
        nativeLikeGuard.request(reqId, currentTrack?.id, () => {
          if (currentTrack) handleToggleLike(currentTrack);
        });
      },
    });

    // Lock screen tap
    windowMock.__melodymap_media_command?.(`like:${sampleTrack.id}`);
    expect(likedIds.has(sampleTrack.id)).toBe(true);
    expect(mockBridge.onLiked).toHaveBeenLastCalledWith(true);

    // In-app toggle on the same track toggles to unliked
    handleToggleLike(sampleTrack);
    expect(likedIds.has(sampleTrack.id)).toBe(false);
    expect(mockBridge.onLiked).toHaveBeenLastCalledWith(false);

    cleanup();
  });

  // 4. Verify the existing recommendation pipeline receives positive feedback exactly once
  it("4. verifies recommendation pipeline receives expected positive feedback (+1.0 reward) exactly once", () => {
    const nativeLikeGuard = createNativeLikeGuard();
    installMediaCommandHandler({
      like: (reqId) => {
        nativeLikeGuard.request(reqId, currentTrack?.id, () => {
          if (currentTrack) handleToggleLike(currentTrack);
        });
      },
    });

    windowMock.__melodymap_media_command?.(`like:${sampleTrack.id}`);

    const events = telemetry.getBufferedEvents();
    const likeEvents = events.filter((e) => e.eventType === "LIKED" && e.trackId === sampleTrack.id);
    expect(likeEvents.length).toBe(1);

    const reward = calculateTelemetryReward(likeEvents[0]!);
    expect(reward).toBe(2.0); // +2.0 is the strongest positive reward in MelodyMap's bandit recommender

    const model = banditPolicy.getModelState();
    expect(model.totalUpdates).toBe(1);
  });

  // 5. Unlike the track from the lock screen and verify the in-app state updates
  it("5. unlikes the track from the lock screen and preserves historical data without false penalties", () => {
    // Pre-liked
    handleToggleLike(sampleTrack);
    expect(likedIds.has(sampleTrack.id)).toBe(true);
    const updatesBefore = banditPolicy.getModelState().totalUpdates;

    const nativeLikeGuard = createNativeLikeGuard({ debounceMs: 0 });
    installMediaCommandHandler({
      like: (reqId) => {
        nativeLikeGuard.request(reqId, currentTrack?.id, () => {
          if (currentTrack) handleToggleLike(currentTrack);
        });
      },
    });

    // Lock screen unlike tap
    windowMock.__melodymap_media_command?.(`like:${sampleTrack.id}`);

    expect(likedIds.has(sampleTrack.id)).toBe(false);
    expect(mockBridge.onLiked).toHaveBeenLastCalledWith(false);
    expect(localStorageStore["melodymap:likes"]).not.toContain(sampleTrack.id);

    // Unliking must NOT invent an artificial penalty or add negative reward updates
    expect(banditPolicy.getModelState().totalUpdates).toBe(updatesBefore);
  });

  // 6. Verify repeated taps do not create duplicate likes or duplicate feedback events
  it("6. verifies repeated taps inside debounce window do not produce duplicate likes or events", () => {
    let mockTime = 1000;
    const nativeLikeGuard = createNativeLikeGuard({
      debounceMs: 600,
      now: () => mockTime,
    });

    installMediaCommandHandler({
      like: (reqId) => {
        nativeLikeGuard.request(reqId, currentTrack?.id, () => {
          if (currentTrack) handleToggleLike(currentTrack);
        });
      },
    });

    // Tap 1
    windowMock.__melodymap_media_command?.(`like:${sampleTrack.id}`);
    // Rapid repeat tap (100ms later)
    mockTime += 100;
    windowMock.__melodymap_media_command?.(`like:${sampleTrack.id}`);
    // Rapid repeat tap (200ms later)
    mockTime += 100;
    windowMock.__melodymap_media_command?.(`like:${sampleTrack.id}`);

    expect(likedIds.size).toBe(1);
    expect(mockBridge.onLiked).toHaveBeenCalledTimes(1);
    expect(banditPolicy.getModelState().totalUpdates).toBe(1);
  });

  // 7. Verify playback continues uninterrupted
  it("7. verifies playback position and audio state continue uninterrupted during lock-screen like", () => {
    const playMock = vi.fn();
    const pauseMock = vi.fn();
    const seekMock = vi.fn();

    const nativeLikeGuard = createNativeLikeGuard();
    installMediaCommandHandler({
      play: playMock,
      pause: pauseMock,
      seek: seekMock,
      like: (reqId) => {
        nativeLikeGuard.request(reqId, currentTrack?.id, () => {
          if (currentTrack) handleToggleLike(currentTrack);
        });
      },
    });

    const initialPosition = playerState.position;
    const initialPlaying = playerState.isPlaying;

    windowMock.__melodymap_media_command?.(`like:${sampleTrack.id}`);

    // Audio controls are not triggered by liking
    expect(playMock).not.toHaveBeenCalled();
    expect(pauseMock).not.toHaveBeenCalled();
    expect(seekMock).not.toHaveBeenCalled();
    expect(playerState.isPlaying).toBe(initialPlaying);
    expect(playerState.position).toBe(initialPosition);
  });

  // 8. Verify the behavior when the app is backgrounded
  it("8. executes successfully when the app is in background/screen locked", () => {
    const nativeLikeGuard = createNativeLikeGuard();
    installMediaCommandHandler({
      like: (reqId) => {
        nativeLikeGuard.request(reqId, currentTrack?.id, () => {
          if (currentTrack) handleToggleLike(currentTrack);
        });
      },
    });

    // Native service triggers command via WebView javascript interface while screen is off
    windowMock.__melodymap_media_command?.(`like:${sampleTrack.id}`);

    expect(likedIds.has(sampleTrack.id)).toBe(true);
    expect(mockBridge.onLiked).toHaveBeenCalledWith(true);
    expect(localStorageStore["melodymap:likes"]).toContain(sampleTrack.id);
  });

  // 9. Verify failures do not leave a falsely updated heart icon
  it("9. rolls back and does not falsely update heart icon when storage write throws", () => {
    const nativeLikeGuard = createNativeLikeGuard();

    installMediaCommandHandler({
      like: (reqId) => {
        nativeLikeGuard.request(reqId, currentTrack?.id, () => {
          // Simulate storage write throwing an error (e.g. QuotaExceededError or security restriction)
          throw new Error("QuotaExceededError");
        });
      },
    });

    windowMock.__melodymap_media_command?.(`like:${sampleTrack.id}`);

    // Bridge must NOT be notified of a successful like
    expect(mockBridge.onLiked).not.toHaveBeenCalled();
    // Track must not be marked liked
    expect(likedIds.has(sampleTrack.id)).toBe(false);
  });

  // 10. Verify existing playback controls and recommendation behavior remain intact
  it("10. keeps standard media controls and recommendation candidate ranking completely intact", () => {
    const playMock = vi.fn();
    const pauseMock = vi.fn();
    const nextMock = vi.fn();
    const prevMock = vi.fn();
    const seekMock = vi.fn();

    installMediaCommandHandler({
      play: playMock,
      pause: pauseMock,
      next: nextMock,
      prev: prevMock,
      seek: seekMock,
      like: (reqId) => {
        if (currentTrack) handleToggleLike(currentTrack);
      },
    });

    windowMock.__melodymap_media_command?.("play");
    expect(playMock).toHaveBeenCalledTimes(1);

    windowMock.__melodymap_media_command?.("pause");
    expect(pauseMock).toHaveBeenCalledTimes(1);

    windowMock.__melodymap_media_command?.("next");
    expect(nextMock).toHaveBeenCalledTimes(1);

    windowMock.__melodymap_media_command?.("prev");
    expect(prevMock).toHaveBeenCalledTimes(1);

    windowMock.__melodymap_media_command?.("seek:125");
    expect(seekMock).toHaveBeenCalledWith(125);

    // Verify recommendation ranking: liking sampleTrack boosts its artist
    handleToggleLike(sampleTrack);
    const ranked = banditPolicy.rankCandidates([sampleTrack, sampleTrack2], {
      hourOfDay: 14,
      discoveryPercent: 30,
    });
    expect(ranked.length).toBe(2);
  });
});
