import { beforeEach, describe, expect, it, vi } from "vitest";

const memory = vi.hoisted(() => new Map<string, string>());

vi.mock("./safe-storage", () => ({
  safeStorage: {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => {
      memory.set(k, v);
    },
    removeItem: (k: string) => {
      memory.delete(k);
    },
  },
}));

import {
  getArtistRecentSkipHealth,
  recordArtistTerminalOutcome,
  recordArtistTelemetryEvent,
  clearArtistRecentStore,
  normalizeArtistName,
} from "./artist-recent";
import type { PlaybackTelemetryEvent } from "./telemetry";

describe("artist-recent", () => {
  beforeEach(() => {
    memory.clear();
    clearArtistRecentStore();
  });

  it("normalizes artist names consistently", () => {
    expect(normalizeArtistName("Anirudh Ravichander feat. Jonita")).toBe("anirudh ravichander");
    expect(normalizeArtistName("  Sid Sriram, Shreya Ghoshal ")).toBe("sid sriram");
    expect(normalizeArtistName("")).toBe("");
    expect(normalizeArtistName(null)).toBe("");
  });

  it("returns 1.0 skip health for artists with no recorded history", () => {
    expect(getArtistRecentSkipHealth("Brand New Artist")).toBe(1.0);
    expect(getArtistRecentSkipHealth(null)).toBe(1.0);
  });

  it("calculates skip health according to formula: 1 - recentSkips / (recentPlays + 1)", () => {
    // 1 play, which is a skip: 1 - 1/(1+1) = 0.5
    recordArtistTerminalOutcome("Artist A", true);
    expect(getArtistRecentSkipHealth("Artist A")).toBeCloseTo(0.5, 4);

    // 2nd play, completed: 2 plays, 1 skip: 1 - 1/(2+1) = 0.6667
    recordArtistTerminalOutcome("Artist A", false);
    expect(getArtistRecentSkipHealth("Artist A")).toBeCloseTo(1 - 1 / 3, 4);

    // 3rd play, completed: 3 plays, 1 skip: 1 - 1/(3+1) = 0.75
    recordArtistTerminalOutcome("Artist A", false);
    expect(getArtistRecentSkipHealth("Artist A")).toBeCloseTo(0.75, 4);
  });

  it("keeps only the last 10 outcomes in sliding window", () => {
    // Record 10 skips -> 1 - 10 / (10 + 1) = 1 - 10/11 = 1/11 ≈ 0.0909
    for (let i = 0; i < 10; i++) {
      recordArtistTerminalOutcome("Frequent Artist", true);
    }
    expect(getArtistRecentSkipHealth("Frequent Artist")).toBeCloseTo(1 / 11, 4);

    // Now record 10 completions -> skips slide out
    for (let i = 0; i < 10; i++) {
      recordArtistTerminalOutcome("Frequent Artist", false);
    }
    // 0 skips, 10 plays -> 1 - 0 / 11 = 1.0
    expect(getArtistRecentSkipHealth("Frequent Artist")).toBeCloseTo(1.0, 4);
  });

  it("evicts oldest artist when store exceeds 200 artists", () => {
    for (let i = 0; i < 205; i++) {
      recordArtistTerminalOutcome(`Artist_${i}`, false);
    }
    // The first 5 should be evicted
    expect(getArtistRecentSkipHealth("Artist_0")).toBe(1.0); // fresh default
    expect(getArtistRecentSkipHealth("Artist_204")).toBe(1.0); // was recorded with 0 skips
  });

  it("parses terminal events correctly from telemetry", () => {
    const baseEv = (type: any, pos: number): PlaybackTelemetryEvent => ({
      id: "ev-test",
      trackId: "t1",
      title: "Title",
      artist: "Test Artist",
      eventType: type,
      positionSeconds: pos,
      durationSeconds: 200,
      fractionPlayed: pos / 200,
      timestamp: Date.now(),
    });

    // Milestone event ignored
    recordArtistTelemetryEvent(baseEv("PLAY_25S", 25));
    expect(getArtistRecentSkipHealth("Test Artist")).toBe(1.0);

    // COMPLETED -> not skip
    recordArtistTelemetryEvent(baseEv("COMPLETED", 200));
    // 1 play, 0 skips -> 1 - 0 / 2 = 1.0
    expect(getArtistRecentSkipHealth("Test Artist")).toBe(1.0);

    // SKIPPED < 10s -> skip
    recordArtistTelemetryEvent(baseEv("SKIPPED", 5));
    // 2 plays, 1 skip -> 1 - 1 / 3 = 0.6667
    expect(getArtistRecentSkipHealth("Test Artist")).toBeCloseTo(2 / 3, 4);

    // SKIPPED >= 10s -> not an early skip
    recordArtistTelemetryEvent(baseEv("SKIPPED", 15));
    // 3 plays, 1 skip -> 1 - 1 / 4 = 0.75
    expect(getArtistRecentSkipHealth("Test Artist")).toBeCloseTo(0.75, 4);

    // DISLIKED -> skip
    recordArtistTelemetryEvent(baseEv("DISLIKED", 20));
    // 4 plays, 2 skips -> 1 - 2 / 5 = 0.6
    expect(getArtistRecentSkipHealth("Test Artist")).toBeCloseTo(0.6, 4);
  });
});
