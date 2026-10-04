import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Capacitor } from "@capacitor/core";

import {
  installMediaCommandHandler,
  isNativePlaybackEnv,
  notifyPlaybackPosition,
  notifyPlaybackState,
  requestBatteryOptimizationExemption,
  resolvePlaybackEngine,
} from "./native-playback";

type BridgeMock = {
  onPlay?: ReturnType<typeof vi.fn>;
  onPause?: ReturnType<typeof vi.fn>;
  onStop?: ReturnType<typeof vi.fn>;
  onPosition?: ReturnType<typeof vi.fn>;
  requestIgnoreBatteryOptimizations?: ReturnType<typeof vi.fn>;
};

type WindowMock = {
  AndroidPlayback?: BridgeMock;
  __melodymap_media_command?: (command: string) => void;
  localStorage?: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
  };
};

let windowMock: WindowMock;
let storage: Map<string, string>;

function setWindow(mock: WindowMock | undefined): void {
  (globalThis as unknown as { window?: WindowMock | undefined }).window = mock;
  (globalThis as unknown as { Window?: unknown }).Window = mock ? function Window() {} : undefined;
}

beforeEach(() => {
  storage = new Map();
  windowMock = {
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => void storage.set(key, value),
    },
  };
  setWindow(windowMock);
});

afterEach(() => {
  setWindow(undefined);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("resolvePlaybackEngine", () => {
  it("selects the youtube engine on deployed hosts (both native and web)", () => {
    expect(resolvePlaybackEngine({ isNative: true, hostname: "melodymap-pi.vercel.app" })).toBe("youtube");
    expect(resolvePlaybackEngine({ isNative: false, hostname: "melodymap-pi.vercel.app" })).toBe("youtube");
  });

  it("selects html5 on localhost and 127.0.0.1", () => {
    expect(resolvePlaybackEngine({ isNative: true, hostname: "localhost" })).toBe("html5");
    expect(resolvePlaybackEngine({ isNative: false, hostname: "localhost" })).toBe("html5");
    expect(resolvePlaybackEngine({ isNative: false, hostname: "127.0.0.1" })).toBe("html5");
  });

  it("falls back to youtube for empty hostnames on the web", () => {
    expect(resolvePlaybackEngine({ isNative: false, hostname: "" })).toBe("youtube");
  });
});

describe("isNativePlaybackEnv", () => {
  it("returns false without a window (SSR/node)", () => {
    setWindow(undefined);
    expect(isNativePlaybackEnv()).toBe(false);
  });

  it("detects the AndroidPlayback bridge", () => {
    windowMock.AndroidPlayback = {};
    expect(isNativePlaybackEnv()).toBe(true);
  });

  it("detects Capacitor native platform", () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    expect(isNativePlaybackEnv()).toBe(true);
  });

  it("returns false on a plain web page", () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(false);
    expect(isNativePlaybackEnv()).toBe(false);
  });
});

describe("notifyPlaybackState", () => {
  it("is a safe no-op without a bridge", () => {
    expect(() => notifyPlaybackState("playing", { title: "Song" })).not.toThrow();
  });

  it("sends a JSON payload to onPlay while playing", () => {
    const onPlay = vi.fn();
    windowMock.AndroidPlayback = { onPlay };
    notifyPlaybackState("playing", {
      id: "abc123",
      title: "Song Title",
      artist: "Artist",
      duration: 210,
      position: 42.7,
    });
    expect(onPlay).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(onPlay.mock.calls[0]?.[0] as string) as Record<string, unknown>;
    expect(payload).toMatchObject({
      id: "abc123",
      title: "Song Title",
      artist: "Artist",
      duration: 210,
      position: 42.7,
    });
  });

  it("routes paused/stopped to onPause/onStop", () => {
    const onPause = vi.fn();
    const onStop = vi.fn();
    windowMock.AndroidPlayback = { onPause, onStop };
    notifyPlaybackState("paused", { title: "Song" });
    notifyPlaybackState("stopped");
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("sanitizes non-finite durations and positions", () => {
    const onPlay = vi.fn();
    windowMock.AndroidPlayback = { onPlay };
    notifyPlaybackState("playing", { duration: Number.NaN, position: -5 });
    const payload = JSON.parse(onPlay.mock.calls[0]?.[0] as string) as Record<string, number>;
    expect(payload["duration"]).toBe(0);
    expect(payload["position"]).toBe(0);
  });

  it("does not throw when the bridge throws", () => {
    windowMock.AndroidPlayback = {
      onPlay: vi.fn(() => {
        throw new Error("bridge exploded");
      }),
    };
    expect(() => notifyPlaybackState("playing", { title: "Song" })).not.toThrow();
  });
});

describe("notifyPlaybackPosition", () => {
  it("forwards the position when supported", () => {
    const onPosition = vi.fn();
    windowMock.AndroidPlayback = { onPosition };
    notifyPlaybackPosition(87.5);
    expect(onPosition).toHaveBeenCalledWith(87.5);
  });

  it("is a no-op without onPosition support", () => {
    windowMock.AndroidPlayback = {};
    expect(() => notifyPlaybackPosition(10)).not.toThrow();
  });
});

describe("installMediaCommandHandler", () => {
  it("dispatches play/pause/next/prev commands", () => {
    const handlers = { play: vi.fn(), pause: vi.fn(), next: vi.fn(), prev: vi.fn() };
    const cleanup = installMediaCommandHandler(handlers);
    windowMock.__melodymap_media_command?.("play");
    windowMock.__melodymap_media_command?.("pause");
    windowMock.__melodymap_media_command?.("next");
    windowMock.__melodymap_media_command?.("prev");
    expect(handlers.play).toHaveBeenCalledTimes(1);
    expect(handlers.pause).toHaveBeenCalledTimes(1);
    expect(handlers.next).toHaveBeenCalledTimes(1);
    expect(handlers.prev).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("parses seek:<seconds> commands", () => {
    const seek = vi.fn();
    installMediaCommandHandler({ seek });
    windowMock.__melodymap_media_command?.("seek:142.5");
    expect(seek).toHaveBeenCalledWith(142.5);
    windowMock.__melodymap_media_command?.("seek:notanumber");
    expect(seek).toHaveBeenCalledTimes(1);
  });

  it("swallows handler exceptions and unknown commands", () => {
    installMediaCommandHandler({
      play: vi.fn(() => {
        throw new Error("nope");
      }),
    });
    expect(() => windowMock.__melodymap_media_command?.("play")).not.toThrow();
    expect(() => windowMock.__melodymap_media_command?.("mystery")).not.toThrow();
  });

  it("removes the dispatcher on cleanup", () => {
    const cleanup = installMediaCommandHandler({ play: vi.fn() });
    expect(windowMock.__melodymap_media_command).toBeTypeOf("function");
    cleanup();
    expect(windowMock.__melodymap_media_command).toBeUndefined();
  });
});

describe("requestBatteryOptimizationExemption", () => {
  it("prompts once per install and remembers the flag", () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    const request = vi.fn();
    windowMock.AndroidPlayback = { requestIgnoreBatteryOptimizations: request };
    requestBatteryOptimizationExemption();
    requestBatteryOptimizationExemption();
    requestBatteryOptimizationExemption();
    expect(request).toHaveBeenCalledTimes(1);
    expect(storage.get("melodymap.battery_prompt.v1")).toBe("1");
  });

  it("is a no-op on the web and without the bridge method", () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(false);
    const request = vi.fn();
    windowMock.AndroidPlayback = { requestIgnoreBatteryOptimizations: request };
    requestBatteryOptimizationExemption();
    expect(request).not.toHaveBeenCalled();

    windowMock.AndroidPlayback = {};
    requestBatteryOptimizationExemption();
    expect(storage.get("melodymap.battery_prompt.v1")).toBeUndefined();
  });

  it("still prompts when localStorage is unavailable", () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    const request = vi.fn();
    windowMock.AndroidPlayback = { requestIgnoreBatteryOptimizations: request };
    windowMock.localStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    requestBatteryOptimizationExemption();
    expect(request).toHaveBeenCalledTimes(1);
  });
});
