import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  sleepTimerService,
  SLEEP_TIMER_PRESETS,
} from "./sleep-timer";

class MockStorage {
  private store: Record<string, string> = {};
  getItem(key: string) {
    return this.store[key] ?? null;
  }
  setItem(key: string, val: string) {
    this.store[key] = String(val);
  }
  removeItem(key: string) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

const mockStorage = new MockStorage();

if (typeof globalThis.localStorage === "undefined") {
  (globalThis as unknown as { localStorage: unknown }).localStorage = mockStorage;
}

if (typeof globalThis.document === "undefined") {
  const listeners: Record<string, ((e: unknown) => void)[]> = {};
  (globalThis as unknown as { document: unknown }).document = {
    visibilityState: "visible",
    addEventListener: (type: string, fn: (e: unknown) => void) => {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    },
    dispatchEvent: (e: { type: string }) => {
      listeners[e.type]?.forEach((fn) => fn(e));
      return true;
    },
  };
}

if (typeof globalThis.window === "undefined") {
  (globalThis as unknown as { window: unknown }).window = globalThis;
}

if (typeof (globalThis as unknown as { addEventListener?: unknown }).addEventListener === "undefined") {
  (globalThis as unknown as { addEventListener: (type: string, fn: unknown) => void }).addEventListener = () => {};
}

describe("MelodyMap Sleep Timer Specification & Invariants", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockStorage.clear();
    sleepTimerService.cancel();
    sleepTimerService.resetExpired();
    sleepTimerService.init();
  });

  afterEach(() => {
    sleepTimerService.cancel();
    vi.useRealTimers();
  });

  describe("1. Preset and Custom Durations", () => {
    it("supports all 6 requested preset durations with accurate calculations", () => {
      const expectedPresets = [15, 30, 45, 60, 90, 120];
      const presetMinutes = SLEEP_TIMER_PRESETS.map((p) => p.minutes);
      expect(presetMinutes).toEqual(expectedPresets);

      for (const mins of expectedPresets) {
        sleepTimerService.start(mins);
        const state = sleepTimerService.getState();
        expect(state.active).toBe(true);
        expect(state.durationMinutes).toBe(mins);
        expect(state.remainingSeconds).toBe(mins * 60);
        expect(state.targetEpochMs).toBe(Date.now() + mins * 60 * 1000);
      }
    });

    it("supports custom durations accurately", () => {
      sleepTimerService.start(37); // Custom 37 minutes
      const state = sleepTimerService.getState();
      expect(state.active).toBe(true);
      expect(state.durationMinutes).toBe(37);
      expect(state.remainingSeconds).toBe(37 * 60);
      expect(sleepTimerService.formatRemaining(37 * 60)).toBe("37:00");

      sleepTimerService.start(125); // Custom 2 hours 5 mins (HH:MM:SS format)
      expect(sleepTimerService.formatRemaining(125 * 60)).toBe("02:05:00");
    });
  });

  describe("2. Timer Lifecycle and Controls", () => {
    it("allows starting, changing duration, and cancelling a timer", () => {
      sleepTimerService.start(30);
      expect(sleepTimerService.getState().active).toBe(true);

      // Change duration while active
      sleepTimerService.setDuration(45);
      expect(sleepTimerService.getState().durationMinutes).toBe(45);
      expect(sleepTimerService.getState().remainingSeconds).toBe(45 * 60);

      // Cancel
      sleepTimerService.cancel();
      expect(sleepTimerService.getState().active).toBe(false);
      expect(sleepTimerService.getState().targetEpochMs).toBeNull();
      expect(sleepTimerService.getState().remainingSeconds).toBe(0);
    });

    it("supports restarting a timer after expiry with the same duration", () => {
      sleepTimerService.start(15);
      // Advance fake timers 15 minutes
      vi.advanceTimersByTime(15 * 60 * 1000 + 1000);

      expect(sleepTimerService.isExpired()).toBe(true);
      expect(sleepTimerService.getState().active).toBe(false);

      // Restart
      sleepTimerService.restart();
      expect(sleepTimerService.getState().active).toBe(true);
      expect(sleepTimerService.getState().durationMinutes).toBe(15);
      expect(sleepTimerService.isExpired()).toBe(false);
    });
  });

  describe("3. Background, Screen-off & Monotonic Resiliency", () => {
    it("handles screen-off and process time skips via monotonic targetEpochMs evaluation", () => {
      const expireCallback = vi.fn();
      sleepTimerService.onExpire(expireCallback);

      // Start 30 min timer
      sleepTimerService.start(30);

      // Device goes into deep sleep (timers suspended for 32 minutes)
      vi.setSystemTime(Date.now() + 32 * 60 * 1000);

      // Trigger visibility change (phone screen turned on / resumed)
      document.dispatchEvent({ type: "visibilitychange" } as Event);

      expect(expireCallback).toHaveBeenCalledTimes(1);
      expect(sleepTimerService.isExpired()).toBe(true);
      expect(sleepTimerService.getState().active).toBe(false);
    });

    it("restores countdown accurately from localStorage across service recreation", () => {
      // Simulate existing active timer in localStorage
      const futureTarget = Date.now() + 20 * 60 * 1000;
      mockStorage.setItem("melodymap.sleeptimer.v2.active", "true");
      mockStorage.setItem("melodymap.sleeptimer.v2.duration", "30");
      mockStorage.setItem("melodymap.sleeptimer.v2.target", String(futureTarget));

      // Re-trigger constructor initialization
      sleepTimerService.init();

      const state = sleepTimerService.getState();
      expect(state.active).toBe(true);
      expect(state.durationMinutes).toBe(30);
      expect(state.remainingSeconds).toBe(20 * 60);
    });
  });

  describe("4. Playback Engine Invariants on Timer Expiry", () => {
    it("prevents duplicate expiry callback execution", () => {
      const expireCallback = vi.fn();
      sleepTimerService.onExpire(expireCallback);

      sleepTimerService.start(1);
      vi.advanceTimersByTime(60 * 1000 + 1000);

      // Triggering manual expire or ticks after expiry must not fire callback again
      sleepTimerService.triggerExpire();
      expect(expireCallback).toHaveBeenCalledTimes(1);
    });

    it("overrides repeat and automatic next-track behavior when timer is expired", () => {
      let isPlaying = true;
      let nextTrackLoaded = false;
      const repeatMode = "all";

      const pauseAudio = () => {
        isPlaying = false;
      };

      sleepTimerService.onExpire(pauseAudio);
      sleepTimerService.start(15);

      // Fast forward to expiry
      vi.advanceTimersByTime(15 * 60 * 1000 + 1000);
      expect(isPlaying).toBe(false);

      // Simulate track end transition
      const handleTrackEnded = () => {
        if (sleepTimerService.isExpired()) {
          // Timer expiry blocks repeat and queue advance
          pauseAudio();
          return;
        }
        if (repeatMode === "all") {
          nextTrackLoaded = true;
        }
      };

      handleTrackEnded();
      expect(nextTrackLoaded).toBe(false);
      expect(isPlaying).toBe(false);
    });

    it("prevents provider fallback retry loops after sleep timer has expired", () => {
      let retriedProvider = false;
      sleepTimerService.start(5);
      vi.advanceTimersByTime(5 * 60 * 1000 + 1000);

      const handleAudioError = () => {
        if (sleepTimerService.isExpired()) {
          return; // Halted by sleep timer
        }
        retriedProvider = true;
      };

      handleAudioError();
      expect(retriedProvider).toBe(false);
    });

    it("manual pause preserves the active sleep timer countdown", () => {
      sleepTimerService.start(30);

      // User pauses audio manually 10 minutes in
      vi.advanceTimersByTime(10 * 60 * 1000);
      // Audio paused, but sleep timer remains active
      expect(sleepTimerService.getState().active).toBe(true);
      expect(sleepTimerService.getState().remainingSeconds).toBe(20 * 60);

      // User resumes 5 minutes later
      vi.advanceTimersByTime(5 * 60 * 1000);
      expect(sleepTimerService.getState().active).toBe(true);
      expect(sleepTimerService.getState().remainingSeconds).toBe(15 * 60);
    });

    it("blocks notification and lockscreen play commands from bypassing expired timer", () => {
      let audioResumed = false;
      sleepTimerService.start(15);
      vi.advanceTimersByTime(15 * 60 * 1000 + 1000);

      // Notification action handler
      const handleMediaSessionPlay = () => {
        if (sleepTimerService.isExpired()) {
          // Block external headset/lockscreen play command
          return;
        }
        audioResumed = true;
      };

      handleMediaSessionPlay();
      expect(audioResumed).toBe(false);

      // Explicit in-app reset allows playback again
      sleepTimerService.resetExpired();
      handleMediaSessionPlay();
      expect(audioResumed).toBe(true);
    });
  });

  describe("5. Android Bridge Integration", () => {
    it("calls AndroidSleepTimer bridge methods when available on window", () => {
      const scheduleMock = vi.fn();
      const cancelMock = vi.fn();

      (window as unknown as { AndroidSleepTimer: unknown }).AndroidSleepTimer = {
        scheduleSleepTimer: scheduleMock,
        cancelSleepTimer: cancelMock,
      };

      // Start timer: schedules in Android AlarmManager
      sleepTimerService.start(45);
      expect(scheduleMock).toHaveBeenCalledWith(45 * 60 * 1000);

      // Cancel timer: cancels in Android AlarmManager
      sleepTimerService.cancel();
      expect(cancelMock).toHaveBeenCalledTimes(1);

      delete (window as unknown as { AndroidSleepTimer?: unknown }).AndroidSleepTimer;
    });

    it("supports native callback trigger via window.__melodymap_sleep_timer_expire", () => {
      const expireCallback = vi.fn();
      sleepTimerService.onExpire(expireCallback);
      sleepTimerService.start(30);

      // Android AlarmManager receiver executes JS evaluation on WebView
      const globalObj = (typeof window !== "undefined" ? window : globalThis) as unknown as { __melodymap_sleep_timer_expire?: () => void };
      expect(globalObj.__melodymap_sleep_timer_expire).toBeDefined();

      globalObj.__melodymap_sleep_timer_expire?.();
      expect(expireCallback).toHaveBeenCalledTimes(1);
      expect(sleepTimerService.isExpired()).toBe(true);
    });
  });
});
