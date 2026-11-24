import { describe, it, expect } from "vitest";
import {
  parseDjPrompt,
  buildDjQueries,
  formatDjTracks,
  QUICK_VIBE_PRESETS,
  type ParsedDjPrompt,
} from "./melody-dj";
import type { Track } from "./library";

describe("melody-dj", () => {
  describe("QUICK_VIBE_PRESETS", () => {
    it("contains expected presets with non-empty fields", () => {
      expect(QUICK_VIBE_PRESETS.length).toBeGreaterThanOrEqual(5);
      for (const preset of QUICK_VIBE_PRESETS) {
        expect(preset.id).toBeTruthy();
        expect(preset.emoji).toBeTruthy();
        expect(preset.label).toBeTruthy();
        expect(preset.prompt).toBeTruthy();
        expect(preset.color).toBeTruthy();
      }
    });
  });

  describe("parseDjPrompt", () => {
    it("detects high energy from workout/gym/party keywords", () => {
      const parsed = parseDjPrompt("Heavy gym workout mass beats for running");
      expect(parsed.energy).toBe("high");
      expect(parsed.title).toContain("High Energy");
    });

    it("detects chill energy from acoustic/relaxing keywords", () => {
      const parsed = parseDjPrompt("Calm relaxing unwinding chill acoustic soothing");
      expect(parsed.energy).toBe("chill");
      expect(parsed.title).toContain("Chill Acoustic");
    });

    it("detects classic era from 90s/vintage keywords", () => {
      const parsed = parseDjPrompt("90s golden era evergreen");
      expect(parsed.era).toBe("classic");
    });

    it("detects retro era from 2000s keywords", () => {
      const parsed = parseDjPrompt("2000s nostalgic film songs");
      expect(parsed.era).toBe("retro");
    });

    it("detects languages mentioned in prompt", () => {
      const parsed = parseDjPrompt("Telugu and Tamil songs");
      expect(parsed.languages).toContain("Telugu");
      expect(parsed.languages).toContain("Tamil");
    });

    it("falls back to default languages when none detected", () => {
      const parsed = parseDjPrompt("Peaceful vibes", ["Malayalam"]);
      expect(parsed.languages).toEqual(["Malayalam"]);
    });

    it("detects artists and composers mentioned in prompt", () => {
      const parsed = parseDjPrompt("Sid Sriram soothing songs");
      expect(parsed.artists).toContain("Sid Sriram");
      expect(parsed.title).toBe("Sid Sriram & Similar Vibe");
    });

    it("extracts vibe keywords and assigns vibe title", () => {
      const parsed = parseDjPrompt("Rainy monsoon highway drive with guitar and flute");
      expect(parsed.vibeKeywords).toEqual(
        expect.arrayContaining(["monsoon", "rain", "highway", "drive", "guitar", "flute"]),
      );
      expect(parsed.title).toBe("Monsoon Vibe DJ");
    });
  });

  describe("buildDjQueries", () => {
    it("constructs targeted queries including artist when present", () => {
      const parsed: ParsedDjPrompt = {
        energy: "chill",
        era: "modern",
        languages: ["Telugu"],
        artists: ["Sid Sriram"],
        vibeKeywords: ["monsoon"],
        title: "Sid Sriram & Similar Vibe",
      };

      const queries = buildDjQueries(parsed);
      expect(queries.length).toBeGreaterThan(0);
      expect(queries.length).toBeLessThanOrEqual(6);
      expect(queries.some((q) => q.includes("Sid Sriram"))).toBe(true);
      expect(queries.some((q) => q.includes("telugu"))).toBe(true);
    });

    it("constructs era-specific queries for 90s classic", () => {
      const parsed: ParsedDjPrompt = {
        energy: "medium",
        era: "classic",
        languages: ["Hindi"],
        artists: [],
        vibeKeywords: [],
        title: "Hindi 90s",
      };

      const queries = buildDjQueries(parsed);
      expect(queries.some((q) => q.includes("90s") || q.includes("classic"))).toBe(true);
    });
  });

  describe("formatDjTracks", () => {
    const makeTrack = (id: string, title: string, artist: string, duration: number, album?: string): Track => ({
      id,
      title,
      artist,
      duration: String(duration),
      durationSeconds: duration,
      album: album || `Album ${id}`,
      thumbnail: `https://example.com/${id}.jpg`,
      previewUrl: `https://example.com/${id}.mp3`,
    });

    it("filters out remix, ringtone, and short unplayable tracks", () => {
      const tracks: Track[] = [
        makeTrack("1", "Samajavaragamana", "Sid Sriram", 210, "Ala Vaikunthapurramuloo"),
        makeTrack("2", "Samajavaragamana (Remix)", "DJ Mix", 210, "Remix Album"), // remix filtered
        makeTrack("3", "Tone Promo", "Sid Sriram", 15, "Promo Album"), // too short (< 45s)
        makeTrack("4", "Butta Bomma", "Armaan Malik", 195, "Ala Vaikunthapurramuloo 2"),
      ];

      const parsed: ParsedDjPrompt = {
        energy: "medium",
        era: "modern",
        languages: ["Telugu"],
        artists: [],
        vibeKeywords: [],
        title: "Test",
      };

      const result = formatDjTracks(tracks, parsed, 10);
      const titles = result.map((t) => t.title);
      expect(titles).toContain("Samajavaragamana");
      expect(titles).toContain("Butta Bomma");
      expect(titles).not.toContain("Samajavaragamana (Remix)");
      expect(titles).not.toContain("Tone Promo");
    });

    it("deduplicates tracks with identical IDs or titles", () => {
      const tracks: Track[] = [
        makeTrack("1", "Inkem Inkem", "Sid Sriram", 240, "Geetha Govindam"),
        makeTrack("1", "Inkem Inkem", "Sid Sriram", 240, "Geetha Govindam"), // duplicate id
        makeTrack("2", "Inkem Inkem", "Sid Sriram", 240, "Geetha Govindam Repack"), // duplicate title & artist
        makeTrack("3", "Vachindamma", "Sid Sriram", 220, "Geetha Govindam Single"),
      ];

      const parsed: ParsedDjPrompt = {
        energy: "chill",
        era: "modern",
        languages: ["Telugu"],
        artists: [],
        vibeKeywords: [],
        title: "Test",
      };

      const result = formatDjTracks(tracks, parsed, 10);
      expect(result.length).toBe(2);
      expect(result.map((t) => t.title)).toEqual(["Inkem Inkem", "Vachindamma"]);
    });
  });
});
