import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MobileLibrary } from "./MobileLibrary";
import type { Track, Playlist } from "@/lib/library";

const mockTrack1: Track = {
  id: "track-1",
  title: "Song Alpha",
  artist: "Artist One",
  duration: "3:00",
  thumbnail: "https://example.com/alpha.jpg",
  source: "deezer",
};

const mockTrack2: Track = {
  id: "track-2",
  title: "Song Beta",
  artist: "Artist Two",
  duration: "3:35",
  thumbnail: "https://example.com/beta.jpg",
  source: "deezer",
};

const mockTrack3: Track = {
  id: "track-3",
  title: "Song Gamma",
  artist: "Artist Three",
  duration: "4:00",
  thumbnail: "https://example.com/gamma.jpg",
  source: "deezer",
};

const mockPlaylist1: Playlist = {
  id: "pl-1",
  name: "My Indie Mix",
  tracks: [mockTrack1, mockTrack2],
  createdAt: 1000,
};

const mockPlaylist2: Playlist = {
  id: "pl-2",
  name: "Late Night Beats",
  tracks: [mockTrack3],
  createdAt: 2000,
};

describe("MobileLibrary Component", () => {
  it("renders exactly the 3 simplified categories: Liked Songs, Playlists, Downloads", () => {
    const html = renderToStaticMarkup(
      React.createElement(MobileLibrary, {
        likes: [mockTrack1, mockTrack2],
        history: [mockTrack1],
        playlists: [mockPlaylist1, mockPlaylist2],
        downloads: [{ track: mockTrack3, size: 5000, savedAt: 12345 }],
        isPlaying: false,
        onNavigateSection: vi.fn(),
        onPlayTrack: vi.fn(),
      })
    );

    // Primary categories are rendered
    expect(html).toContain("Liked Songs");
    expect(html).toContain("Playlists");
    expect(html).toContain("Downloads");
    expect(html).toContain("Create Playlist +");
    expect(html).toContain("Recently Played");

    // Dynamic, accurate counts are shown
    expect(html).toContain("2 songs"); // Liked songs count
    expect(html).toContain("2 playlists • 3 songs"); // Playlists count & total tracks
    expect(html).toContain("1 song"); // Downloads count
  });

  it("removes redundant duplicate content (Chill Vibes and Workout Mix)", () => {
    const html = renderToStaticMarkup(
      React.createElement(MobileLibrary, {
        likes: [],
        history: [],
        playlists: [],
        downloads: [],
        isPlaying: false,
        onNavigateSection: vi.fn(),
        onPlayTrack: vi.fn(),
      })
    );

    // Duplicate cards MUST NOT exist
    expect(html).not.toContain("Chill Vibes");
    expect(html).not.toContain("Workout Mix");
    expect(html).not.toContain("Workout Mix &amp; Downloads");
    expect(html).not.toContain("Workout Mix & Downloads");

    // Hardcoded dummy counts MUST NOT exist
    expect(html).not.toContain("87 songs");
    expect(html).not.toContain("92 songs");
    expect(html).not.toContain("104 songs");
  });

  it("removes redundant dormant category pills above the cards", () => {
    const html = renderToStaticMarkup(
      React.createElement(MobileLibrary, {
        likes: [],
        history: [],
        playlists: [],
        downloads: [],
        isPlaying: false,
        onNavigateSection: vi.fn(),
        onPlayTrack: vi.fn(),
      })
    );

    // Dormant chips that duplicated the cards below are removed
    expect(html).not.toContain("mm-chip-active");
    expect(html).not.toContain("Downloaded"); // The old pill had "Downloaded"
  });

  it("handles empty library states gracefully with 0 counts", () => {
    const html = renderToStaticMarkup(
      React.createElement(MobileLibrary, {
        likes: [],
        history: [],
        playlists: [],
        downloads: [],
        isPlaying: false,
        onNavigateSection: vi.fn(),
        onPlayTrack: vi.fn(),
      })
    );

    expect(html).toContain("0 songs");
    expect(html).toContain("0 playlists");
  });

  it("renders recently played history tracks and See all link", () => {
    const html = renderToStaticMarkup(
      React.createElement(MobileLibrary, {
        likes: [],
        history: [mockTrack1, mockTrack2],
        playlists: [],
        downloads: [],
        isPlaying: false,
        onNavigateSection: vi.fn(),
        onPlayTrack: vi.fn(),
      })
    );

    expect(html).toContain("Recently Played");
    expect(html).toContain("See all");
    expect(html).toContain("Song Alpha");
    expect(html).toContain("Artist One");
    expect(html).toContain("Song Beta");
    expect(html).toContain("Artist Two");
  });
});
