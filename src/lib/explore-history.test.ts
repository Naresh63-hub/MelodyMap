import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  MAX_RECENT_SEEN_CAPACITY,
  normalizeTrackIdentity,
  normalizeIdentityText,
  getRecentlySeenIdentities,
  getRecentlySeenSet,
  isRecentlySeen,
  recordSeenTrackIdentities,
  clearRecentlySeenHistory,
} from "./explore-history";

describe("Explore Recently Seen History", () => {
  let storage: Map<string, string>;
  let mockLocalStorage: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
    clear: () => void;
  };

  beforeEach(() => {
    storage = new Map();
    mockLocalStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, String(value));
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
    };

    const mockWindow = {
      localStorage: mockLocalStorage,
    };

    vi.stubGlobal("window", mockWindow);
    vi.stubGlobal("localStorage", mockLocalStorage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("normalizes identity text cleanly", () => {
    expect(normalizeIdentityText("  Hello, World! -- (Official Video)  ")).toBe("hello world official video");
    expect(normalizeIdentityText("Chuttamalle (From \"Devara\")")).toBe("chuttamalle from devara");
    expect(normalizeIdentityText(null)).toBe("");
    expect(normalizeIdentityText(undefined)).toBe("");
  });

  it("computes track identity preferring ID and falling back to title::artist", () => {
    expect(normalizeTrackIdentity({ id: "saavn:12345", title: "Track", artist: "Artist" })).toBe("saavn:12345");
    expect(normalizeTrackIdentity({ id: "", title: "Track Name", artist: "Artist Name" })).toBe("track name::artist name");
    expect(normalizeTrackIdentity({ title: "Only Title" })).toBe("only title");
    expect(normalizeTrackIdentity(null)).toBeNull();
  });

  it("records tracks and bounds to MAX_RECENT_SEEN_CAPACITY with FIFO eviction", () => {
    // 50 tracks = ~100 identities (ID + fallback)
    const tracksBatch1 = Array.from({ length: 50 }).map((_, i) => ({
      id: `track-${i}`,
      title: `Song ${i}`,
      artist: `Artist ${i}`,
    }));

    recordSeenTrackIdentities(tracksBatch1);
    const seenSet1 = getRecentlySeenSet();
    expect(seenSet1.has("track-0")).toBe(true);
    expect(seenSet1.has("track-49")).toBe(true);

    // Add another 100 tracks (~200 identities). Total identities (100 + 200 = 300) exceeds 250.
    const tracksBatch2 = Array.from({ length: 100 }).map((_, i) => ({
      id: `track-${50 + i}`,
      title: `Song ${50 + i}`,
      artist: `Artist ${50 + i}`,
    }));

    recordSeenTrackIdentities(tracksBatch2);
    const list = getRecentlySeenIdentities();
    expect(list.length).toBeLessThanOrEqual(MAX_RECENT_SEEN_CAPACITY);
    const seenSet2 = getRecentlySeenSet();

    // Newest track MUST be present
    expect(seenSet2.has("track-149")).toBe(true);
    // Oldest track (track-0) should have been evicted by FIFO
    expect(seenSet2.has("track-0")).toBe(false);
  });

  it("identifies tracks as recently seen via ID or title::artist fallback", () => {
    recordSeenTrackIdentities([
      { id: "saavn:song-1", title: "Naatu Naatu", artist: "Rahul Sipligunj" },
    ]);

    const seenSet = getRecentlySeenSet();
    // Match by ID
    expect(isRecentlySeen({ id: "saavn:song-1" }, seenSet)).toBe(true);

    // Match by normalized title & artist even if ID is different (re-upload or different provider)
    expect(
      isRecentlySeen(
        { id: "deezer:different-id", title: "Naatu Naatu", artist: "Rahul Sipligunj" },
        seenSet,
      ),
    ).toBe(true);

    // Unseen track
    expect(
      isRecentlySeen(
        { id: "saavn:song-unseen", title: "Brand New Melody", artist: "New Singer" },
        seenSet,
      ),
    ).toBe(false);
  });

  it("handles storage exceptions gracefully", () => {
    mockLocalStorage.setItem = () => {
      throw new Error("QuotaExceededError");
    };

    expect(() => {
      recordSeenTrackIdentities([{ id: "test", title: "test", artist: "test" }]);
    }).not.toThrow();
  });

  it("clears history cleanly", () => {
    recordSeenTrackIdentities([{ id: "t1" }, { id: "t2" }]);
    expect(getRecentlySeenIdentities().length).toBeGreaterThan(0);
    clearRecentlySeenHistory();
    expect(getRecentlySeenIdentities().length).toBe(0);
  });
});
