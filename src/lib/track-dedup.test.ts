import { describe, expect, it } from "vitest";

import { areSameTrack, dedupeTracks, norm, stringSimilarity, cleanYouTubeTrackMetadata } from "./track-dedup";

describe("norm", () => {
  it("lowercases and strips noise words and punctuation", () => {
    expect(norm("Track Title (Official Music Video)")).toBe("title");
    expect(norm("  HELLO   World  ")).toBe("hello world");
    expect(norm("Don't Stop [HD]")).toBe("don't stop");
  });

  it("normalizes smart quotes and backticks to standard apostrophe", () => {
    expect(norm("Don‘t Stop")).toBe("don't stop");
    expect(norm("Don’t Stop")).toBe("don't stop");
    expect(norm("Don`t Stop")).toBe("don't stop");
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

describe("cleanYouTubeTrackMetadata", () => {
  it("removes YouTube label channel names and parses real song title, artist and movie", () => {
    const res1 = cleanYouTubeTrackMetadata(
      "Petta (Telugu) - Peydhavi Chivarakey Video | Rajinikanth | Anirudh Ravichander",
      "SonyMusicSouthVEVO",
    );
    expect(res1.title).toBe("Peydhavi Chivarakey");
    expect(res1.artist).toBe("Anirudh Ravichander");
    expect(res1.album).toBe("Petta (Telugu)");

    const res2 = cleanYouTubeTrackMetadata(
      "Chitti | Jathi Ratnalu | Naveen Polishetty, Faria Abdullah | Radhan",
      "Aditya Music",
    );
    expect(res2.title).toBe("Chitti");
    expect(res2.artist).toBe("Radhan");
    expect(res2.album).toBe("Jathi Ratnalu");

    const res3 = cleanYouTubeTrackMetadata(
      "Nee Daare Video Song | Least Eligible Bachelor | Harsha Chemudu, Aishwarya",
      "Aditya Music",
    );
    expect(res3.title).toBe("Nee Daare");
    expect(res3.album).toBe("Least Eligible Bachelor");

    const res4 = cleanYouTubeTrackMetadata(
      'Arijit Singh - Kesariya (From "Brahmastra")',
      "Sony Music India",
    );
    expect(res4.title).toBe("Kesariya");
    expect(res4.artist).toBe("Arijit Singh");
    expect(res4.album).toBe("Brahmastra");

    const res5 = cleanYouTubeTrackMetadata(
      "Taylor Swift - Cruel Summer (Official Audio)",
      "TaylorSwiftVEVO",
    );
    expect(res5.title).toBe("Cruel Summer");
    expect(res5.artist).toBe("Taylor Swift");
  });

  it("leaves standard titles and clean artists intact", () => {
    const res = cleanYouTubeTrackMetadata("Ordinary Song Name", "Artist Name");
    expect(res.title).toBe("Ordinary Song Name");
    expect(res.artist).toBe("Artist Name");
  });
});
