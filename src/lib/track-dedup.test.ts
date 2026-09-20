import { describe, expect, it } from "vitest";

import { areSameTrack, dedupeTracks, norm, stringSimilarity } from "./track-dedup";

describe("norm", () => {
  it("lowercases and strips noise words and punctuation", () => {
    expect(norm("Track Title (Official Music Video)")).toBe("title");
    expect(norm("  HELLO   World  ")).toBe("hello world");
    expect(norm("Don't Stop [HD]")).toBe("don't stop");
  });
});

describe("stringSimilarity", () => {
  it("scores identical strings as 1", () => {
    expect(stringSimilarity("Arijit Singh - Tum Hi Ho", "Arijit Singh - Tum Hi Ho")).toBe(1);
  });

  it("is order-independent for token-sorted strings", () => {
    expect(stringSimilarity("Tum Hi Ho - Arijit Singh", "Arijit Singh - Tum Hi Ho")).toBeGreaterThan(
      0.9,
    );
  });

  it("scores unrelated strings low", () => {
    expect(stringSimilarity("Heavy Metal Anthem", "Gentle Piano Lullaby")).toBeLessThan(0.5);
  });
});

describe("areSameTrack", () => {
  it("matches same id", () => {
    expect(
      areSameTrack({ id: "abc", title: "X", artist: "Y" }, { id: "abc", title: "Different", artist: "Z" }),
    ).toBe(true);
  });

  it("matches the same song re-uploaded by different label channels", () => {
    const a = { id: "v1", title: "Tum Hi Ho (Official Video)", artist: "Sony Music India", duration: "4:22" };
    const b = { id: "v2", title: "Tum Hi Ho", artist: "Aditya Music", duration: "4:23" };
    expect(areSameTrack(a, b)).toBe(true);
  });

  it("rejects different songs even by the same artist", () => {
    const a = { id: "v1", title: "Song One", artist: "Same Artist", duration: "3:30" };
    const b = { id: "v2", title: "A Completely Different Song", artist: "Same Artist", duration: "5:45" };
    expect(areSameTrack(a, b)).toBe(false);
  });
});

describe("dedupeTracks", () => {
  it("removes fuzzy duplicates while preserving order", () => {
    const tracks = [
      { id: "1", title: "Kesariya (Official Video)", artist: "Arijit Singh", duration: "4:28" },
      { id: "2", title: "Kesariya", artist: "Arijit Singh", duration: "4:30" },
      { id: "3", title: "Apna Bana Le", artist: "Arijit Singh", duration: "4:40" },
    ];
    const deduped = dedupeTracks(tracks);
    expect(deduped).toHaveLength(2);
    expect(deduped[0]?.id).toBe("1");
    expect(deduped[1]?.id).toBe("3");
  });

  it("returns an empty array for empty input", () => {
    expect(dedupeTracks([])).toEqual([]);
  });
});
