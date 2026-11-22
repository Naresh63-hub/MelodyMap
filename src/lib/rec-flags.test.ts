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

import { DEFAULT_FLAGS, getAllRecFlags, getRecFlag, setRecFlag } from "./rec-flags";

describe("rec-flags", () => {
  beforeEach(() => {
    memory.clear();
  });

  it("defaults to true for all flags matching current shipped behavior", () => {
    expect(DEFAULT_FLAGS.singlePassRanking).toBe(true);
    expect(DEFAULT_FLAGS.trainOnFullTrack).toBe(true);
    expect(getRecFlag("singlePassRanking")).toBe(true);
    expect(getRecFlag("trainOnFullTrack")).toBe(true);
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
    });
  });
});
