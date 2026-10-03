import { describe, expect, it, beforeEach } from "vitest";
import {
  isLowNetworkModeEnabled,
  setLowNetworkMode,
  getOptimizedThumbnailUrl,
} from "./network-mode";

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

if (typeof globalThis.window === "undefined") {
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: mockStorage,
    dispatchEvent: () => true,
  };
}

describe("Network Mode & Bandwidth Adaptation", () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  it("defaults to false when no setting is saved and browser connection is normal", () => {
    expect(isLowNetworkModeEnabled()).toBe(false);
  });

  it("persists explicit low network mode setting", () => {
    setLowNetworkMode(true);
    expect(isLowNetworkModeEnabled()).toBe(true);

    setLowNetworkMode(false);
    expect(isLowNetworkModeEnabled()).toBe(false);
  });

  it("optimizes YouTube thumbnails when Low Network Mode is active", () => {
    const highResYt = "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg";
    const hqYt = "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg";

    // When disabled, returns original
    expect(getOptimizedThumbnailUrl(highResYt, false)).toBe(highResYt);

    // When enabled, transforms to lightweight mqdefault.jpg (~8KB)
    expect(getOptimizedThumbnailUrl(highResYt, true)).toBe(
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
    );
    expect(getOptimizedThumbnailUrl(hqYt, true)).toBe(
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
    );
  });

  it("optimizes Deezer/Audius thumbnails when Low Network Mode is active", () => {
    const deezerHigh = "https://e-cdns-images.dzcdn.net/images/cover/abc/1000x1000-000000-80-0-0.jpg";
    expect(getOptimizedThumbnailUrl(deezerHigh, true)).toBe(
      "https://e-cdns-images.dzcdn.net/images/cover/abc/250x250-000000-80-0-0.jpg",
    );
  });

  it("handles undefined or empty URLs safely", () => {
    expect(getOptimizedThumbnailUrl(undefined)).toBe("");
    expect(getOptimizedThumbnailUrl("")).toBe("");
  });
});
