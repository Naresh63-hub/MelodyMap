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

  it("rejects version knockoffs, reprises, and dialogue promos", () => {
    expect(isOriginalSong({ title: "Samajavaragamana (Female Version)", artist: "Sid Sriram" })).toBe(false);
    expect(isOriginalSong({ title: "Deva Deva (Reprise)", artist: "Arijit Singh" })).toBe(false);
    expect(isOriginalSong({ title: "Chitti (Dialogue Promo)", artist: "Radhan" })).toBe(false);
    expect(isOriginalSong({ title: "Song (BGM)", artist: "Composer" })).toBe(false);
  });
  it("rejects cheap local compilations and holiday festival albums", () => {
    expect(isOriginalSong({ title: "Pachchadanamey", album: "Classics Of Telugu Cinema", artist: "Hariharan" })).toBe(false);
    expect(isOriginalSong({ title: "Ranjithame", album: "Jani Master Ultimate Blockbuster Hits", artist: "Thaman S" })).toBe(false);
    expect(isOriginalSong({ title: "Mega Victory Mass", album: "Blockbuster Tollywood Ugadi", artist: "Various Artists" })).toBe(false);
    expect(isOriginalSong({ title: "Puvvalaku Rangey", album: "Bhaje Bhaje Holi Special Telugu Songs" })).toBe(false);
    expect(isOriginalSong({ title: "You & Me", album: "Rose Day Telugu Hits" })).toBe(false);
    expect(isOriginalSong({ title: "Vurike Chilakaa", album: "Kuchi Kuchi Koonamma Classic Telugu Hits" })).toBe(false);
    expect(isOriginalSong({ title: "Adivo Alladivo", album: "Top 90s Telugu Songs" })).toBe(false);
    expect(isOriginalSong({ title: "Best Of Tollywood 2023", artist: "Various Artists" })).toBe(false);
  });

  it("rejects devotional, temple, religious chants and hymns", () => {
    expect(isOriginalSong({ title: "Amalo Maa Yamma", album: "Akkadevathala Paatalu", artist: "Village Deity" })).toBe(false);
    expect(isOriginalSong({ title: "Adivo Alladivo", subtitle: "Annamayya Keerthana", album: "Classical" })).toBe(false);
    expect(isOriginalSong({ title: "Sri Venkateswara Suprabhatam", artist: "M. S. Subbulakshmi" })).toBe(false);
    expect(isOriginalSong({ title: "Shiva Stotram", album: "Lord Shiva Chants" })).toBe(false);
    expect(isOriginalSong({ title: "Ayyappa Swamy Bhajana", album: "Sabarimala Paatalu" })).toBe(false);
    expect(isOriginalSong({ title: "Hanuman Chalisa", artist: "Hariharan" })).toBe(false);
  });

  it("rejects speeches, web series, promos, and discourses", () => {
    expect(isOriginalSong({ title: "Kadapa Web Series", artist: "RGV" })).toBe(false);
    expect(isOriginalSong({ title: "Kadapa Web Series Promo Song", artist: "Director" })).toBe(false);
    expect(isOriginalSong({ title: "Director Speech at Audio Launch", artist: "Anchor" })).toBe(false);
    expect(isOriginalSong({ title: "Chaganti Koteswara Rao Pravachanam", artist: "Chaganti" })).toBe(false);
  });

  it("approves genuine studio film soundtracks and singles (Spotify standard)", () => {
    expect(isOriginalSong({ title: "Chuttamalle", artist: "Shilpa Rao, Anirudh Ravichander", album: "Devara Part 1" })).toBe(true);
    expect(isOriginalSong({ title: "Samajavaragamana", artist: "Sid Sriram", album: "Ala Vaikunthapurramuloo" })).toBe(true);
    expect(isOriginalSong({ title: "Kurchi Madathapetti", artist: "Thaman S, Sahithi Chaganti", album: "Guntur Kaaram" })).toBe(true);
    expect(isOriginalSong({ title: "Tauba Tauba", artist: "Karan Aujla", album: "Bad Newz" })).toBe(true);
    expect(isOriginalSong({ title: "Espresso", artist: "Sabrina Carpenter", album: "Short n' Sweet" })).toBe(true);
  });
});

describe("isMusicTrack with isOriginalSong integration", () => {
  it("rejects remixes, covers, and local compilations from music recommendations", () => {
    expect(isMusicTrack({ title: "Tum Hi Ho (DJ Mix)", artist: "Arijit Singh", duration: "3:30" })).toBe(false);
    expect(isMusicTrack({ title: "Pachchadanamey", album: "Classics Of Telugu Cinema", duration: "4:15" })).toBe(false);
    expect(isMusicTrack({ title: "Tum Hi Ho", artist: "Arijit Singh", duration: "3:30" })).toBe(true);
  });
});

