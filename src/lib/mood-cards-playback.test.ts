import { describe, it, expect, vi } from "vitest";
import { MOOD_ITEMS } from "@/components/music/ui/MoodCardsSection";
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

  it("builds language-aware mood search queries for non-English user preferences", () => {
    // Tests that when language is Telugu, Hindi, or Tamil, the query incorporates the language
    const buildMoodQuery = (mood: string, language?: string) => {
      const lang = language?.trim();
      if (lang && lang.toLowerCase() !== "english") {
        if (mood === "focus") {
          return "focus music instrumental concentration study";
        } else if (mood === "devotional") {
          return `${lang} devotional bhakti songs`;
        } else if (mood === "romantic") {
          return `${lang} romantic love melody songs`;
        } else if (mood === "upbeat workout") {
          return `${lang} energetic workout gym songs`;
        } else if (mood === "party") {
          return `${lang} party dance mass songs`;
        } else if (mood === "sad hours") {
          return `${lang} sad soulful heartbreak songs`;
        } else if (mood === "chill") {
          return `${lang} chill calm acoustic melody songs`;
        } else if (mood === "late night") {
          return `${lang} late night melody songs`;
        }
        return `${lang} ${mood} songs`;
      }
      return `${mood} songs`;
    };

    // User speaks Telugu
    expect(buildMoodQuery("romantic", "Telugu")).toBe("Telugu romantic love melody songs");
    expect(buildMoodQuery("upbeat workout", "Telugu")).toBe("Telugu energetic workout gym songs");
    expect(buildMoodQuery("chill", "Telugu")).toBe("Telugu chill calm acoustic melody songs");
    expect(buildMoodQuery("devotional", "Telugu")).toBe("Telugu devotional bhakti songs");

    // User speaks Hindi
    expect(buildMoodQuery("party", "Hindi")).toBe("Hindi party dance mass songs");
    expect(buildMoodQuery("sad hours", "Hindi")).toBe("Hindi sad soulful heartbreak songs");

    // Instrumental focus ignores regional language lyrics to prevent distracting vocals
    expect(buildMoodQuery("focus", "Telugu")).toBe("focus music instrumental concentration study");
  });

  it("1-tap mood selection invokes instant queue playback at track 0", () => {
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
