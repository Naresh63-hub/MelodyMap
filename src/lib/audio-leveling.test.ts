import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  computeSourceGain,
  computeEffectiveVolume,
  isVolumeLevelingEnabled,
  setVolumeLevelingEnabled,
  rampAudioVolume,
} from "./audio-leveling";

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
const eventListeners: Record<string, Set<Function>> = {};

if (typeof globalThis.localStorage === "undefined") {
  (globalThis as any).localStorage = mockStorage;
}

if (typeof globalThis.window === "undefined") {
  (globalThis as any).window = {
    localStorage: mockStorage,
    addEventListener: (type: string, fn: Function) => {
      if (!eventListeners[type]) eventListeners[type] = new Set();
      eventListeners[type].add(fn);
    },
    removeEventListener: (type: string, fn: Function) => {
      eventListeners[type]?.delete(fn);
    },
    dispatchEvent: (ev: any) => {
      eventListeners[ev.type]?.forEach((fn) => fn(ev));
      return true;
    },
  };
}

if (typeof globalThis.CustomEvent === "undefined") {
  (globalThis as any).CustomEvent = class CustomEvent {
    type: string;
    detail: any;
    constructor(type: string, init?: any) {
      this.type = type;
      this.detail = init?.detail;
    }
  };
}

describe("MelodyMap Safe Audio Leveling & Peak Protection", () => {
  beforeEach(() => {
    mockStorage.clear();
    for (const key of Object.keys(eventListeners)) {
      eventListeners[key]?.clear();
    }
    vi.restoreAllMocks();
  });

  afterEach(() => {
    mockStorage.clear();
  });

  describe("1. Source Gain Offset", () => {
    it("returns neutral 1.00x (0 dB) for tracks without verified LUFS to avoid guessing and abrupt jumps", () => {
      expect(computeSourceGain({ id: "podcast:episode_42" })).toBe(1.0);
      expect(computeSourceGain({ id: "custom_id", source: "podcast" })).toBe(1.0);
      expect(computeSourceGain({ id: "saavn:song_123" })).toBe(1.0);
      expect(computeSourceGain({ id: "yt_track_abc" })).toBe(1.0);
      expect(computeSourceGain({ id: "audius:777" })).toBe(1.0);
      expect(computeSourceGain({ id: "jamendo:888" })).toBe(1.0);
    });

    it("respects verified explicit targetGain and clamps within safe bounds [0.5, 1.0]", () => {
      expect(computeSourceGain({ id: "track_with_meta", targetGain: 0.9 })).toBeCloseTo(0.9, 2);
      expect(computeSourceGain({ id: "track_too_high", targetGain: 1.4 })).toBe(1.0);
      expect(computeSourceGain({ id: "track_too_low", targetGain: 0.2 })).toBe(0.5);
    });

    it("returns neutral 1.00x when track is missing or invalid", () => {
      expect(computeSourceGain(null)).toBe(1.0);
      expect(computeSourceGain(undefined)).toBe(1.0);
      expect(computeSourceGain({ id: "" })).toBe(1.0);
    });
  });

  describe("2. Effective Volume & Peak Protection Ceiling", () => {
    it("applies verified targetGain while strictly preserving user volume baseline", () => {
      const effective = computeEffectiveVolume(0.8, { id: "track_with_meta", targetGain: 0.9 }, true);
      expect(effective).toBeCloseTo(0.72, 3);
    });

    it("preserves exact user volume with neutral gain on unmeasured sources", () => {
      const effective = computeEffectiveVolume(0.85, { id: "podcast:ep1" }, true);
      expect(effective).toBe(0.85);
    });

    it("strictly clamps maximum volume at 1.0 ceiling", () => {
      const effectiveMax = computeEffectiveVolume(1.0, { id: "track_high", targetGain: 1.0 }, true);
      expect(effectiveMax).toBe(1.0);

      // Even if userVolume was somehow > 1.0
      const excessive = computeEffectiveVolume(1.5, { id: "podcast:ep1" }, true);
      expect(excessive).toBe(1.0);
    });

    it("strictly clamps negative volumes to 0.0", () => {
      expect(computeEffectiveVolume(-0.2, { id: "podcast:ep1" }, true)).toBe(0.0);
    });

    it("bypasses gain calculation when leveling is disabled, preserving user volume", () => {
      const disabledVol = computeEffectiveVolume(0.8, { id: "track_with_meta", targetGain: 0.9 }, false);
      expect(disabledVol).toBe(0.8);
    });
  });

  describe("3. Leveling Preference & Event Dispatching", () => {
    it("defaults to enabled (true)", () => {
      expect(isVolumeLevelingEnabled()).toBe(true);
    });

    it("persists toggled state to localStorage and dispatches event", () => {
      const listener = vi.fn();
      window.addEventListener("melodymap:leveling-change", listener);

      setVolumeLevelingEnabled(false);
      expect(isVolumeLevelingEnabled()).toBe(false);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { enabled: false },
        }),
      );

      setVolumeLevelingEnabled(true);
      expect(isVolumeLevelingEnabled()).toBe(true);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { enabled: true },
        }),
      );

      window.removeEventListener("melodymap:leveling-change", listener);
    });
  });

  describe("4. Smooth 50ms Volume Micro-Ramping", () => {
    it("ramps audio volume smoothly towards target volume without clicks", async () => {
      vi.useFakeTimers();
      const mockAudio = { volume: 0.5 } as HTMLAudioElement;

      rampAudioVolume(mockAudio, 0.9, 50);

      // Midway through 50ms (at 25ms)
      vi.advanceTimersByTime(25);
      expect(mockAudio.volume).toBeGreaterThan(0.5);
      expect(mockAudio.volume).toBeLessThan(0.9);

      // At completion (50ms)
      vi.advanceTimersByTime(35);
      expect(mockAudio.volume).toBeCloseTo(0.9, 2);

      vi.useRealTimers();
    });

    it("cancels ramp immediately when cancel function is called", () => {
      vi.useFakeTimers();
      const mockAudio = { volume: 0.2 } as HTMLAudioElement;

      const cancel = rampAudioVolume(mockAudio, 1.0, 50);
      vi.advanceTimersByTime(20);
      const intermediateVol = mockAudio.volume;
      expect(intermediateVol).toBeGreaterThan(0.2);

      // Cancel mid-ramp
      cancel();

      // Advancing further does not change volume
      vi.advanceTimersByTime(50);
      expect(mockAudio.volume).toBe(intermediateVol);

      vi.useRealTimers();
    });

    it("applies target immediately if target is already close to current volume", () => {
      const mockAudio = { volume: 0.801 } as HTMLAudioElement;
      const cancel = rampAudioVolume(mockAudio, 0.8, 50);
      expect(mockAudio.volume).toBe(0.8);
      cancel();
    });
  });
});
