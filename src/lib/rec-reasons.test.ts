import { describe, it, expect } from "vitest";
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
});
