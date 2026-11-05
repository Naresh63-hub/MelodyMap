import { describe, it, expect } from "vitest";
import { deduplicateTracks } from "./LanguageArtistPicker";
import type { Track } from "@/lib/library";

describe("LanguageArtistPicker - deduplicateTracks", () => {
  it("deduplicates tracks that share the same ID", () => {
    const input: Track[] = [
      { id: "saavn_101", title: "Kesariya", artist: "Arijit Singh", album: "Brahmastra", duration: "4:28", thumbnail: "" },
      { id: "saavn_101", title: "Kesariya", artist: "Arijit Singh", album: "Brahmastra", duration: "4:28", thumbnail: "" },
    ];

    const result = deduplicateTracks(input);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("saavn_101");
  });

  it("deduplicates tracks with different IDs when normalized title and artist match", () => {
    // JioSaavn often returns multiple releases of the exact same song under different IDs
    const input: Track[] = [
      { id: "saavn_original_1", title: "Kesariya", artist: "Arijit Singh", album: "Brahmastra", duration: "4:28", thumbnail: "" },
      { id: "saavn_compilation_2", title: "kesariya", artist: "  arijit   singh  ", album: "Best of 2022", duration: "4:28", thumbnail: "" },
    ];

    const result = deduplicateTracks(input);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("saavn_original_1");
  });

  it("normalizes case, punctuation, and extra whitespace correctly", () => {
    const input: Track[] = [
      { id: "id_1", title: "Apna Bana Le", artist: "Arijit Singh", duration: "3:35", thumbnail: "" },
      { id: "id_2", title: "  apna   bana   le  ", artist: "ARIJIT SINGH", duration: "3:35", thumbnail: "" },
      { id: "id_3", title: "Apna Bana Le (Audio)", artist: "Arijit Singh", duration: "3:35", thumbnail: "" },
    ];

    const result = deduplicateTracks(input);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("id_1");
  });

  it("preserves different songs that share identical titles but have different artists", () => {
    // "Kesariya" can be performed by different singers or different tracks entirely
    const input: Track[] = [
      { id: "arijit_kesariya", title: "Kesariya", artist: "Arijit Singh", duration: "4:28", thumbnail: "" },
      { id: "other_kesariya", title: "Kesariya", artist: "Sreerama Chandra", duration: "4:30", thumbnail: "" },
    ];

    const result = deduplicateTracks(input);
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(["arijit_kesariya", "other_kesariya"]);
  });

  it("preserves distinct tracks from different artists and languages", () => {
    const input: Track[] = [
      { id: "t1", title: "Chaleya", artist: "Arijit Singh, Shilpa Rao", duration: "3:20", thumbnail: "" },
      { id: "t2", title: "Arabic Kuthu", artist: "Anirudh Ravichander", duration: "4:40", thumbnail: "" },
      { id: "t3", title: "Naatu Naatu", artist: "Rahul Sipligunj, Kaala Bhairava", duration: "3:35", thumbnail: "" },
      { id: "t4", title: "Chaleya", artist: "Arijit Singh, Shilpa Rao", duration: "3:20", thumbnail: "" }, // duplicate
    ];

    const result = deduplicateTracks(input);
    expect(result).toHaveLength(3);
    expect(result.map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
  });

  it("handles tracks with missing or empty IDs using composite title:::artist fallback", () => {
    const input: Track[] = [
      { id: "", title: "Tum Hi Ho", artist: "Arijit Singh", duration: "4:22", thumbnail: "" },
      { id: "", title: "tum hi ho", artist: "arijit singh", duration: "4:22", thumbnail: "" },
      { id: "valid_id", title: "Tum Hi Ho", artist: "Arijit Singh", duration: "4:22", thumbnail: "" },
    ];

    const result = deduplicateTracks(input);
    expect(result).toHaveLength(1);
  });
});
