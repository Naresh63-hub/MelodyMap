import { describe, it, expect } from "vitest";
import {
  buildUserTasteProfile,
  isKnownComposer,
  getTimeBlock,
  type TasteProfileInput,
} from "./taste-profile";

describe("User Taste Profile (Phase 2)", () => {
  it("identifies known composers correctly across industries", () => {
    expect(isKnownComposer("Devi Sri Prasad")).toBe(true);
    expect(isKnownComposer("S. Thaman")).toBe(true);
    expect(isKnownComposer("Anirudh Ravichander")).toBe(true);
    expect(isKnownComposer("A.R. Rahman")).toBe(true);
    expect(isKnownComposer("M.M. Keeravaani")).toBe(true);
    expect(isKnownComposer("Sid Sriram")).toBe(false);
    expect(isKnownComposer("Arijit Singh")).toBe(false);
  });

  it("determines time block accurately", () => {
    expect(getTimeBlock(6)).toBe("morning");
    expect(getTimeBlock(13)).toBe("afternoon");
    expect(getTimeBlock(19)).toBe("evening");
    expect(getTimeBlock(23)).toBe("night");
    expect(getTimeBlock(2)).toBe("night");
  });

  it("builds taste profile ranking downloaded and liked artists with high priority", () => {
    const input: TasteProfileInput = {
      likes: [
        { id: "l1", title: "Samajavaragamana", artist: "Sid Sriram" },
      ],
      downloads: [
        { id: "d1", title: "Oo Antava", artist: "Devi Sri Prasad", album: "Pushpa" },
      ],
      stats: {
        "s1": {
          plays: 5,
          completions: 4,
          skips: 0,
          track: { id: "s1", title: "Naatu Naatu", artist: "M.M. Keeravaani", album: "RRR" },
        },
      },
    };

    const profile = buildUserTasteProfile(input);

    // Devi Sri Prasad is a composer, should appear in topComposers
    expect(profile.topComposers.some((c) => c.name.toLowerCase().includes("devi sri prasad"))).toBe(true);
    // M.M. Keeravaani is a composer, should appear in topComposers
    expect(profile.topComposers.some((c) => c.name.toLowerCase().includes("keeravaani"))).toBe(true);
    // Sid Sriram is a singer, should appear in topSingers
    expect(profile.topSingers.some((s) => s.name.toLowerCase().includes("sid sriram"))).toBe(true);

    // Soundtracks extracted from album metadata
    expect(profile.topSoundtracks.some((st) => st.name.toLowerCase().includes("pushpa"))).toBe(true);
    expect(profile.topSoundtracks.some((st) => st.name.toLowerCase().includes("rrr"))).toBe(true);
  });

  it("incorporates negative feedback and penalizes repeated fast-skips and dislikes", () => {
    const input: TasteProfileInput = {
      dislikes: [
        { id: "dl1", title: "Hated Song", artist: "Annoying Singer" },
      ],
      sessionPenalizedArtists: ["Fast Skipped Artist"],
      sessionSkips: [
        { artist: "Bad Singer", title: "Bad Song", timestamp: Date.now() },
        { artist: "Bad Singer", title: "Another Bad Song", timestamp: Date.now() },
      ],
    };

    const profile = buildUserTasteProfile(input);

    expect(profile.penalizedArtists).toContain("fast skipped artist");
    expect(profile.penalizedArtists.some((p) => p.includes("annoying singer"))).toBe(true);
    expect(profile.fastSkippedArtists).toContain("fast skipped artist");
    // Penalized artists should NOT be in topSingers
    expect(profile.topSingers.some((s) => s.name.toLowerCase().includes("annoying singer"))).toBe(false);
  });

  it("distinguishes short-term focus from long-term lifetime affinities", () => {
    const input: TasteProfileInput = {
      history: [
        { id: "h1", title: "Recent Hit", artist: "Ram Miriyala" },
        { id: "h2", title: "Latest Song", artist: "Anurag Kulkarni" },
      ],
      likes: [
        { id: "l1", title: "Favorite Classic", artist: "Sid Sriram" },
      ],
      downloads: [
        { id: "d1", title: "Saved Song", artist: "Karthik" },
      ],
    };

    const profile = buildUserTasteProfile(input);

    expect(profile.shortTermFocus.recentSingers).toContain("Ram Miriyala");
    expect(profile.shortTermFocus.recentSingers).toContain("Anurag Kulkarni");
    expect(profile.longTermAffinities.lifetimeFavoriteSingers).toContain("Sid Sriram");
    expect(profile.longTermAffinities.downloadedSingers).toContain("Karthik");
  });

  it("learns empirical circadian energy preferences from actual playback history", () => {
    const input: TasteProfileInput = {
      hourOfDay: 23, // Late night
      history: [
        { id: "c1", title: "Midnight Lo-Fi Acoustic", artist: "Chill Artist" },
        { id: "c2", title: "Slowed Soft Melancholy Ballad", artist: "Sleep Music" },
        { id: "c3", title: "Peaceful Ambient Rain", artist: "Piano Artist" },
      ],
    };

    const profile = buildUserTasteProfile(input);

    expect(profile.currentHourEmpiricalEnergy).toBe("chill");
    expect(profile.circadianAffinity.night.avgEnergy).toBe("chill");
    expect(profile.preferredEnergy.chill).toBeGreaterThan(0.5);
  });
});
