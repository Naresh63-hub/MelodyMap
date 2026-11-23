import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { explainPick } from "./rec-reasons";
import type { SessionContext } from "./bandit-policy";

describe("explainPick (Truthful recommendation reason badges)", () => {
  const baseCtx: SessionContext = {
    hourOfDay: 14,
    sessionCompletions: 2,
    sessionSkips: 0,
    likedTracks: [],
    dislikedTracks: [],
    downloadedTracks: [],
  };

  it("returns undefined when track is missing or has no title", () => {
    expect(explainPick(null, baseCtx, "made-for-you")).toBeUndefined();
    expect(explainPick(undefined, baseCtx, "made-for-you")).toBeUndefined();
    expect(explainPick({ title: "" }, baseCtx, "made-for-you")).toBeUndefined();
  });

  it("returns 'Because you liked {artist}' when candidate artist is in likedTracks", () => {
    const ctx: SessionContext = {
      ...baseCtx,
      likedTracks: [
        { id: "1", title: "Samajavaragamana", artist: "Sid Sriram" },
      ],
    };
    const track = {
      id: "2",
      title: "Inkem Inkem",
      artist: "Sid Sriram",
    };
    expect(explainPick(track, ctx, "made-for-you")).toBe("Because you liked Sid Sriram");
  });

  it("matches liked artist case-insensitively and handles featuring artists", () => {
    const ctx: SessionContext = {
      ...baseCtx,
      likedTracks: [
        { id: "1", title: "Track A", artist: "Anirudh Ravichander" },
      ],
    };
    const track = {
      id: "2",
      title: "Track B",
      artist: "Anirudh Ravichander, Jonita Gandhi",
    };
    expect(explainPick(track, ctx, "made-for-you")).toBe("Because you liked Anirudh Ravichander");
  });

  it("returns 'From your downloaded artist {artist}' when artist is in downloadedTracks", () => {
    const ctx: SessionContext = {
      ...baseCtx,
      downloadedTracks: [
        { id: "d1", title: "D1", artist: "A.R. Rahman" },
      ],
    };
    const track = {
      id: "3",
      title: "New Song",
      artist: "A.R. Rahman",
    };
    expect(explainPick(track, ctx, "made-for-you")).toBe("From your downloaded artist A.R. Rahman");
  });

  it("prefers liked over downloaded if both match", () => {
    const ctx: SessionContext = {
      ...baseCtx,
      likedTracks: [{ id: "l1", title: "L1", artist: "SPB" }],
      downloadedTracks: [{ id: "d1", title: "D1", artist: "SPB" }],
    };
    const track = { id: "4", title: "Old Hit", artist: "SPB" };
    expect(explainPick(track, ctx, "made-for-you")).toBe("Because you liked SPB");
  });

  it("returns 'Trending in {language}' when source is 'trending' and language is known", () => {
    const track = {
      id: "t1",
      title: "Trending Telugu Song",
      artist: "Thaman S",
      languageCode: "te",
    };
    expect(explainPick(track, baseCtx, "trending")).toBe("Trending in Telugu");
  });

  it("does not return 'Trending in {language}' if source is not 'trending'", () => {
    const track = {
      id: "t1",
      title: "Trending Telugu Song",
      artist: "Thaman S",
      languageCode: "te",
    };
    expect(explainPick(track, baseCtx, "made-for-you")).toBeUndefined();
  });

  it("does not return 'Trending in {language}' if language cannot be determined", () => {
    const track = {
      id: "t2",
      title: "Random Song",
      artist: "Unknown Artist",
    };
    expect(explainPick(track, baseCtx, "trending")).toBeUndefined();
  });

  it("returns 'Late night chill' when hour is late night (22-4) and track has chill vibe", () => {
    const lateNightHours = [22, 23, 0, 1, 2, 3, 4];
    for (const hour of lateNightHours) {
      const ctx: SessionContext = {
        ...baseCtx,
        hourOfDay: hour,
      };
      const track = {
        id: "c1",
        title: "Midnight Lofi Acoustic Guitar",
        artist: "Chill Beats",
      };
      expect(explainPick(track, ctx, "made-for-you")).toBe("Late night chill");
    }
  });

  it("does not return 'Late night chill' during daytime even if track is chill", () => {
    const daytimeHours = [10, 12, 14, 18, 20];
    for (const hour of daytimeHours) {
      const ctx: SessionContext = {
        ...baseCtx,
        hourOfDay: hour,
      };
      const track = {
        id: "c1",
        title: "Midnight Lofi Acoustic Guitar",
        artist: "Chill Beats",
      };
      expect(explainPick(track, ctx, "made-for-you")).toBeUndefined();
    }
  });

  it("does not return 'Late night chill' during late night if track is high energy / party", () => {
    const ctx: SessionContext = {
      ...baseCtx,
      hourOfDay: 23,
    };
    const track = {
      id: "p1",
      title: "High Energy Dance Party Workout EDM",
      artist: "DJ Rocker",
    };
    expect(explainPick(track, ctx, "made-for-you")).toBeUndefined();
  });

  it("returns undefined when no evidence matches (never invents reasons)", () => {
    const track = {
      id: "u1",
      title: "Standard Pop Song",
      artist: "Unrelated Artist",
    };
    expect(explainPick(track, baseCtx, "made-for-you")).toBeUndefined();
    expect(explainPick(track, null, "search")).toBeUndefined();
  });

  it("returns undefined when no liked/downloaded artist, not trending, and not late-night chill", () => {
    const ctx: SessionContext = {
      hourOfDay: 14, // daytime (not late night)
      likedTracks: [{ id: "l1", title: "Song 1", artist: "Artist A" }],
      downloadedTracks: [{ id: "d1", title: "Song 2", artist: "Artist B" }],
    };
    const track = {
      id: "u1",
      title: "Midday Pop Hit",
      artist: "Completely Unrelated Artist C",
    };
    // source is not "trending", artist is neither Artist A nor Artist B, hour is 14 -> must be undefined
    expect(explainPick(track, ctx, "made-for-you")).toBeUndefined();
    expect(explainPick(track, ctx, "daily-mix")).toBeUndefined();
    expect(explainPick(track, ctx, "autodj-radio")).toBeUndefined();
  });

  it("returns 'From a composer you enjoy' when candidate is a known composer in liked or taste profile", () => {
    const ctx: SessionContext = {
      ...baseCtx,
      likedTracks: [{ id: "l1", title: "Song 1", artist: "Devi Sri Prasad" }],
    };
    const track = {
      id: "c1",
      title: "New Film Track",
      artist: "Devi Sri Prasad",
    };
    expect(explainPick(track, ctx, "made-for-you")).toBe("Because you liked Devi Sri Prasad");

    // When in tasteProfile.topComposers but not in likedTracks:
    const ctxComposer: any = {
      ...baseCtx,
      likedTracks: [],
      tasteProfile: {
        topComposers: [{ name: "S. Thaman", score: 8.5 }],
      },
    };
    const track2 = {
      id: "c2",
      title: "Soundtrack Theme",
      artist: "S. Thaman",
    };
    expect(explainPick(track2, ctxComposer, "made-for-you")).toBe("From a composer you enjoy");
  });

  it("returns 'Similar to your downloaded songs' when candidate shares a soundtrack album with a downloaded song", () => {
    const ctx: SessionContext = {
      ...baseCtx,
      downloadedTracks: [{ id: "d1", title: "Song 1", artist: "Singer X", album: "Pushpa" }],
    };
    const track = {
      id: "c1",
      title: "Another Pushpa Song",
      artist: "Singer Y",
      album: "Pushpa",
    };
    expect(explainPick(track, ctx, "made-for-you")).toBe("Similar to your downloaded songs");
  });

  it("returns 'From your favorite soundtrack' when movie matches top soundtracks in taste profile", () => {
    const ctx: any = {
      ...baseCtx,
      tasteProfile: {
        topSoundtracks: [{ name: "rrr", score: 9.0 }],
      },
    };
    const track = {
      id: "t1",
      title: "Dosti",
      artist: "Singer Z",
      album: "RRR",
    };
    expect(explainPick(track, ctx, "made-for-you")).toBe("From your favorite soundtrack");
  });

  it("returns 'Discover a new singer' when source is discover", () => {
    const track = {
      id: "disc1",
      title: "Fresh Track",
      artist: "Unexplored Artist",
    };
    expect(explainPick(track, baseCtx, "discover")).toBe("Discover a new singer");
  });

  it("returns 'Based on your listening mood' when active mood matches track energy and keywords", () => {
    const ctx: SessionContext = {
      ...baseCtx,
      activeMood: "Late Night Chill",
    };
    const track = {
      id: "m1",
      title: "Chill Acoustic Lo-Fi Ballad",
      artist: "Ambient Artist",
    };
    expect(explainPick(track, ctx, "made-for-you")).toBe("Based on your listening mood");
  });

  it("source-text test: fails if any generic fallback string is present in rec-reasons.ts", () => {
    const sourceFilePath = path.resolve(__dirname, "rec-reasons.ts");
    const sourceCode = fs.readFileSync(sourceFilePath, "utf-8");

    const forbiddenStrings = [
      "Based on your taste",
      "Recommended for you",
      "Top pick",
      "Popular choice",
      "You might like",
      "Similar to what you love",
      "Because you listen to music",
    ];

    for (const forbidden of forbiddenStrings) {
      expect(sourceCode.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }

    expect(sourceCode).toContain("return undefined;");
  });
});
