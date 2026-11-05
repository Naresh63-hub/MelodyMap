import { describe, expect, it } from "vitest";
import type { Track } from "@/lib/library";
import {
  dedupeTracks,
  formatPlayCount,
  getTrackReleaseTimestamp,
} from "./ExploreSections";

describe("ExploreSections tab logic & utilities", () => {
  describe("formatPlayCount", () => {
    it("formats counts above 1 billion with B", () => {
      expect(formatPlayCount(1_500_000_000)).toBe("1.5B plays");
      expect(formatPlayCount(2_000_000_000)).toBe("2B plays");
    });

    it("formats counts above 1 million with M", () => {
      expect(formatPlayCount(27_236_183)).toBe("27.2M plays");
      expect(formatPlayCount(1_000_000)).toBe("1M plays");
      expect(formatPlayCount(5_450_000)).toBe("5.5M plays");
    });

    it("formats counts above 1 thousand with K", () => {
      expect(formatPlayCount(375_937)).toBe("375.9K plays");
      expect(formatPlayCount(12_000)).toBe("12K plays");
    });

    it("returns raw number for small counts and undefined for non-positive", () => {
      expect(formatPlayCount(450)).toBe("450 plays");
      expect(formatPlayCount(0)).toBeUndefined();
      expect(formatPlayCount(undefined)).toBeUndefined();
      expect(formatPlayCount(-10)).toBeUndefined();
    });
  });

  describe("getTrackReleaseTimestamp", () => {
    it("parses standard ISO YYYY-MM-DD release dates", () => {
      const track: Track = {
        id: "saavn:1",
        title: "Song 2024",
        artist: "Artist",
        duration: "3:30",
        thumbnail: "",
        releaseDate: "2024-12-05",
      };
      const timestamp = getTrackReleaseTimestamp(track);
      expect(timestamp).toBe(Date.parse("2024-12-05"));
    });

    it("parses DD-MM-YYYY release dates", () => {
      const track: Track = {
        id: "saavn:2",
        title: "Song Reversed",
        artist: "Artist",
        duration: "3:30",
        thumbnail: "",
        releaseDate: "15-08-2023",
      };
      const timestamp = getTrackReleaseTimestamp(track);
      expect(timestamp).toBe(Date.parse("2023-08-15"));
    });

    it("falls back to year when releaseDate is absent", () => {
      const track: Track = {
        id: "saavn:3",
        title: "Song Year Only",
        artist: "Artist",
        duration: "3:30",
        thumbnail: "",
        year: "2022",
      };
      const timestamp = getTrackReleaseTimestamp(track);
      expect(timestamp).toBe(new Date(2022, 0, 1).getTime());
    });

    it("returns 0 for track with no date info", () => {
      const track: Track = {
        id: "saavn:4",
        title: "No Date",
        artist: "Artist",
        duration: "3:30",
        thumbnail: "",
      };
      expect(getTrackReleaseTimestamp(track)).toBe(0);
    });
  });

  describe("dedupeTracks", () => {
    it("deduplicates tracks with identical IDs", () => {
      const tracks: Track[] = [
        { id: "saavn:10", title: "Song A", artist: "Artist 1", duration: "3:00", thumbnail: "" },
        { id: "saavn:10", title: "Song A", artist: "Artist 1", duration: "3:00", thumbnail: "" },
        { id: "saavn:20", title: "Song B", artist: "Artist 2", duration: "3:00", thumbnail: "" },
      ];
      const deduped = dedupeTracks(tracks);
      expect(deduped).toHaveLength(2);
      expect(deduped.map((t) => t.id)).toEqual(["saavn:10", "saavn:20"]);
    });

    it("deduplicates tracks with identical title and artist even if IDs differ", () => {
      const tracks: Track[] = [
        { id: "saavn:1", title: "Same Song", artist: "Famous Singer", duration: "3:00", thumbnail: "" },
        { id: "audius:2", title: "Same Song", artist: "Famous Singer", duration: "3:00", thumbnail: "" },
        { id: "saavn:3", title: "Different Song", artist: "Famous Singer", duration: "3:00", thumbnail: "" },
      ];
      const deduped = dedupeTracks(tracks);
      expect(deduped).toHaveLength(2);
      expect(deduped[0]?.id).toBe("saavn:1");
      expect(deduped[1]?.id).toBe("saavn:3");
    });

    it("respects excludeKeys set to prevent duplicates across sections", () => {
      const existingKeys = new Set(["saavn:1".toLowerCase()]);
      const tracks: Track[] = [
        { id: "saavn:1", title: "Existing", artist: "Artist", duration: "3:00", thumbnail: "" },
        { id: "saavn:2", title: "Fresh Drop", artist: "Artist", duration: "3:00", thumbnail: "" },
      ];
      const result = dedupeTracks(tracks, existingKeys);
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("saavn:2");
    });
  });

  describe("Sorting semantics for tabs", () => {
    it("New Releases sorts strictly by release date descending (newest first)", () => {
      const tracks: Track[] = [
        { id: "1", title: "Old 2021", artist: "A", duration: "3:00", thumbnail: "", releaseDate: "2021-05-01" },
        { id: "2", title: "Brand New 2024", artist: "B", duration: "3:00", thumbnail: "", releaseDate: "2024-11-20" },
        { id: "3", title: "Mid 2023", artist: "C", duration: "3:00", thumbnail: "", releaseDate: "2023-01-10" },
      ];

      const sorted = [...tracks].sort((a, b) => getTrackReleaseTimestamp(b) - getTrackReleaseTimestamp(a));
      expect(sorted.map((t) => t.id)).toEqual(["2", "3", "1"]);
    });

    it("Popular tab sorts strictly by play counts descending", () => {
      const tracks: Track[] = [
        { id: "1", title: "Moderate", artist: "A", duration: "3:00", thumbnail: "", playCount: 500_000 },
        { id: "2", title: "Mega Hit", artist: "B", duration: "3:00", thumbnail: "", playCount: 27_000_000 },
        { id: "3", title: "Indie Track", artist: "C", duration: "3:00", thumbnail: "", playCount: 15_000 },
        { id: "4", title: "Unrated Track", artist: "D", duration: "3:00", thumbnail: "" },
      ];

      const sorted = [...tracks].sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0));
      expect(sorted.map((t) => t.id)).toEqual(["2", "1", "3", "4"]);
    });
  });
});
