import { describe, expect, it } from "vitest";
import { isOriginalSong, isMusicTrack } from "./track-filters";

describe("isOriginalSong", () => {
  it("approves original songs", () => {
    expect(isOriginalSong({ title: "Kesariya", artist: "Arijit Singh", album: "Brahmastra" })).toBe(true);
    expect(isOriginalSong({ title: "Shape of You", artist: "Ed Sheeran" })).toBe(true);
    expect(isOriginalSong({ title: "Tum Hi Ho", artist: "Arijit Singh", album: "Aashiqui 2" })).toBe(true);
    expect(isOriginalSong({ title: "Chitti", artist: "Radhan", album: "Jathi Ratnalu" })).toBe(true);
    expect(isOriginalSong({ title: "Blinding Lights", artist: "The Weeknd" })).toBe(true);
    expect(isOriginalSong({ title: "Matrix", artist: "Various Artists" })).toBe(true);
    expect(isOriginalSong({ title: "Six", artist: "Broadway" })).toBe(true);
  });

  it("rejects remixes", () => {
    expect(isOriginalSong({ title: "Kesariya (Remix)", artist: "Arijit Singh" })).toBe(false);
    expect(isOriginalSong({ title: "Tum Hi Ho - DJ Chetas Remix", artist: "Arijit Singh" })).toBe(false);
    expect(isOriginalSong({ title: "Blinding Lights (Remixed)", artist: "The Weeknd" })).toBe(false);
    expect(isOriginalSong({ title: "Song Name", album: "Bollywood Remixes 2024" })).toBe(false);
  });

  it("rejects covers", () => {
    expect(isOriginalSong({ title: "Shape of You (Cover)", artist: "Unknown Artist" })).toBe(false);
    expect(isOriginalSong({ title: "Tum Hi Ho (Acoustic Cover)", artist: "Singer" })).toBe(false);
    expect(isOriginalSong({ title: "Kesariya", artist: "Cover Singer" })).toBe(false);
    expect(isOriginalSong({ title: "Song Name", album: "Acoustic Covers Vol. 1" })).toBe(false);
  });

  it("rejects mixes, mashups, and lofi versions", () => {
    expect(isOriginalSong({ title: "Kesariya (Dance Mix)", artist: "Arijit Singh" })).toBe(false);
    expect(isOriginalSong({ title: "Kesariya (Lofi Flip)", artist: "Bollywood Lofi" })).toBe(false);
    expect(isOriginalSong({ title: "Kesariya (Slowed and Reverb)", artist: "VIBIE" })).toBe(false);
    expect(isOriginalSong({ title: "Bollywood Mashup 2023", artist: "DJ Mix" })).toBe(false);
    expect(isOriginalSong({ title: "Best Hindi Songs Medley", artist: "Various" })).toBe(false);
    expect(isOriginalSong({ title: "Chitti (Club Mix)", artist: "Radhan" })).toBe(false);
  });

  it("rejects instrumentals and karaoke", () => {
    expect(isOriginalSong({ title: "Kesariya (Instrumental)", artist: "Pritam" })).toBe(false);
    expect(isOriginalSong({ title: "Tum Hi Ho (Karaoke Version)", artist: "Mithoon" })).toBe(false);
    expect(isOriginalSong({ title: "Song", artist: "Rishi Kumar Instrumentals" })).toBe(false);
  });
});

describe("isMusicTrack with isOriginalSong integration", () => {
  it("rejects remixes and covers from music recommendations", () => {
    expect(isMusicTrack({ title: "Tum Hi Ho (DJ Mix)", artist: "Arijit Singh", duration: "3:30" })).toBe(false);
    expect(isMusicTrack({ title: "Tum Hi Ho", artist: "Arijit Singh", duration: "3:30" })).toBe(true);
  });
});
