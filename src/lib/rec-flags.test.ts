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
  DEFAULT_FLAGS,
  getAllRecFlags,
  getRecFlag,
  setRecFlag,
  getRecConfigChangedAt,
  touchRecConfigChangedAt,
  isDevModeEnabled,
  setDevModeEnabled,
  REC_CONFIG_CHANGED_AT_KEY,
  DEV_MODE_STORAGE_KEY,
} from "./rec-flags";

describe("rec-flags", () => {
  beforeEach(() => {
    memory.clear();
  });

  it("defaults to true for all flags matching current shipped behavior, and false for new experiment flags", () => {
    expect(DEFAULT_FLAGS.singlePassRanking).toBe(true);
    expect(DEFAULT_FLAGS.trainOnFullTrack).toBe(true);
    expect(DEFAULT_FLAGS.leakFreeTrainingContext).toBe(false);
    expect(getRecFlag("singlePassRanking")).toBe(true);
    expect(getRecFlag("trainOnFullTrack")).toBe(true);
    expect(getRecFlag("leakFreeTrainingContext")).toBe(false);
  });

  it("sets a flag to false and reads false back", () => {
    setRecFlag("singlePassRanking", false);
    expect(getRecFlag("singlePassRanking")).toBe(false);
    expect(getRecFlag("trainOnFullTrack")).toBe(true);
  });

  it("falls back to default on garbage or missing storage value", () => {
    memory.set("melodymap.flag.singlePassRanking", "invalid_garbage");
    expect(getRecFlag("singlePassRanking")).toBe(true);
  });

  it("getAllRecFlags returns all flags", () => {
    setRecFlag("trainOnFullTrack", false);
    const flags = getAllRecFlags();
    expect(flags).toEqual({
      singlePassRanking: true,
      trainOnFullTrack: false,
      leakFreeTrainingContext: false,
      languageFeature: false,
      artistRecentSkipFeature: false,
      noveltyMomentumFeature: false,
      movieTieBreaker: false,
      tasteArtistMix: false,
      languageQuotas: false,
      webAudioEq: false,
    });
  });

  describe("configChangedAt timestamp tracking", () => {
    it("returns null when no config has changed", () => {
      expect(getRecConfigChangedAt()).toBeNull();
    });

    it("updates configChangedAt when a flag value actually changes", () => {
      expect(getRecConfigChangedAt()).toBeNull();
      setRecFlag("singlePassRanking", false);
      const changedAt = getRecConfigChangedAt();
      expect(changedAt).toBeTruthy();
      expect(typeof changedAt).toBe("string");
      expect(new Date(changedAt!).toString()).not.toBe("Invalid Date");
    });

    it("does not update configChangedAt when setRecFlag is called with identical value", () => {
      // Default is true; calling setRecFlag(..., true) should not update timestamp
      setRecFlag("singlePassRanking", true);
      expect(getRecConfigChangedAt()).toBeNull();

      // Change it once
      setRecFlag("singlePassRanking", false);
      const firstTimestamp = getRecConfigChangedAt();
      expect(firstTimestamp).toBeTruthy();

      // Call again with false (identical value)
      setRecFlag("singlePassRanking", false);
      expect(getRecConfigChangedAt()).toBe(firstTimestamp);
    });

    it("touchRecConfigChangedAt writes current ISO string and returns it", () => {
      const touched = touchRecConfigChangedAt();
      expect(touched).toBeTruthy();
      expect(getRecConfigChangedAt()).toBe(touched);
    });
  });

  describe("developer mode toggle", () => {
    it("defaults to false", () => {
      expect(isDevModeEnabled()).toBe(false);
    });

    it("enables and disables developer mode in safeStorage", () => {
      setDevModeEnabled(true);
      expect(isDevModeEnabled()).toBe(true);
      expect(memory.get(DEV_MODE_STORAGE_KEY)).toBe("1");

      setDevModeEnabled(false);
      expect(isDevModeEnabled()).toBe(false);
      expect(memory.has(DEV_MODE_STORAGE_KEY)).toBe(false);
    });
  });
});
