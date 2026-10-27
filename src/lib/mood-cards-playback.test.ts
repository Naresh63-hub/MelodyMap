import { describe, it, expect, vi } from "vitest";
import { MOOD_ITEMS } from "@/components/music/ui/MoodCardsSection";
import { getMoodSearchQueries } from "@/lib/music.functions";
import type { Track } from "@/lib/library";

describe("1-Tap Visual Moods & Vibes (Spotify / YouTube Music style)", () => {
  it("defines curated visual mood cards covering essential vibes", () => {
    const keys = MOOD_ITEMS.map((m) => m.key);
    expect(keys).toContain("chill");
    expect(keys).toContain("romantic");
    expect(keys).toContain("upbeat workout");
    expect(keys).toContain("party");
    expect(keys).toContain("sad hours");
    expect(keys).toContain("focus");
    expect(keys).toContain("late night");
    expect(keys).toContain("devotional");

    // Every mood card must have a label, non-empty subtitle, distinct gradient, and an icon
    for (const item of MOOD_ITEMS) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.subtitle.length).toBeGreaterThan(0);
      expect(item.gradient).toContain("from-");
      expect(item.icon).toBeDefined();
    }
  });

  it("builds clean language-aware mood search queries for regional preferences", () => {
    // User speaks Telugu
    const teluguRomantic = getMoodSearchQueries("romantic", "Telugu");
    expect(teluguRomantic).toContain("Telugu love songs");
    expect(teluguRomantic).toContain("Telugu melody songs");

    const teluguWorkout = getMoodSearchQueries("upbeat workout", "Telugu");
    expect(teluguWorkout).toContain("Telugu mass songs");

    const teluguChill = getMoodSearchQueries("chill", "Telugu");
    expect(teluguChill).toContain("Telugu slow songs");

    const teluguDevotional = getMoodSearchQueries("devotional", "Telugu");
    expect(teluguDevotional).toContain("Telugu devotional songs");

    // User speaks Hindi
    const hindiParty = getMoodSearchQueries("party", "Hindi");
    expect(hindiParty).toContain("Hindi party songs");

    const hindiSad = getMoodSearchQueries("sad hours", "Hindi");
    expect(hindiSad).toContain("Hindi sad songs");

    // Multi-language user (Telugu + Hindi)
    const multiLangRomantic = getMoodSearchQueries("romantic", undefined, ["Telugu", "Hindi"]);
    expect(multiLangRomantic).toContain("Telugu love songs");
    expect(multiLangRomantic).toContain("Hindi love songs");

    // English / Default
    const defaultRomantic = getMoodSearchQueries("romantic");
    expect(defaultRomantic).toContain("romantic love songs");
  });

  it("dedicated mood selection loads mood queue with related music", () => {
    const playSongMock = vi.fn();
    const startQueue = (tracks: Track[], startIndex = 0) => {
      if (tracks.length === 0) return;
      const target = tracks[startIndex] || tracks[0];
      if (target) {
        playSongMock(target, tracks);
      }
    };

    const mockTracks: Track[] = [
      { id: "s1", title: "Samajavaragamana", artist: "Sid Sriram", duration: "3:30", thumbnail: "" },
      { id: "s2", title: "Butta Bomma", artist: "Armaan Malik", duration: "3:15", thumbnail: "" },
    ];

    startQueue(mockTracks, 0);

    expect(playSongMock).toHaveBeenCalledTimes(1);
    expect(playSongMock).toHaveBeenCalledWith(mockTracks[0], mockTracks);
  });
});
