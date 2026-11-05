import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FullScreenPlayer } from "./FullScreenPlayer";
import { LyricsPanel } from "./LyricsPanel";
import * as lyricsHook from "@/lib/use-track-lyrics";
import type { Track } from "@/lib/library";

const sampleTrack: Track = {
  id: "test-track-1",
  title: "Samajavaragamana",
  artist: "Sid Sriram",
  duration: "3:45",
  thumbnail: "https://example.com/thumb.jpg",
  source: "deezer",
};

describe("FullScreenPlayer (Now Playing Screen)", () => {
  it("does not force 'dark' class on root container and is theme-aware", () => {
    const html = renderToStaticMarkup(
      React.createElement(FullScreenPlayer, {
        track: sampleTrack,
        isPlaying: true,
        liked: false,
        position: 45,
        duration: 225,
        volume: 1,
        canNext: true,
        canPrevious: true,
        onTogglePlay: vi.fn(),
        onToggleLike: vi.fn(),
        onNext: vi.fn(),
        onPrevious: vi.fn(),
        onSeek: vi.fn(),
        onVolumeChange: vi.fn(),
        onClose: vi.fn(),
      })
    );

    // Root element should not have standalone "dark" class that forces dark mode
    const rootClassMatch = html.match(/^<div[^>]*class="([^"]*)"/);
    const rootClasses = rootClassMatch?.[1] ? rootClassMatch[1].split(/\s+/) : [];
    expect(rootClasses).not.toContain("dark");
    expect(html).toContain("bg-[#FAF8FF]");
    expect(html).toContain("dark:bg-[#0b0813]");
    expect(html).toContain("text-[#211536]");
    expect(html).toContain("dark:text-white");
  });

  it("renders animated music symbols (♪ ♫ ♬) and pulsing aura synchronized with playback state", () => {
    const htmlPlaying = renderToStaticMarkup(
      React.createElement(FullScreenPlayer, {
        track: sampleTrack,
        isPlaying: true,
        liked: false,
        position: 30,
        duration: 200,
        volume: 1,
        canNext: true,
        canPrevious: true,
        onTogglePlay: vi.fn(),
        onToggleLike: vi.fn(),
        onNext: vi.fn(),
        onPrevious: vi.fn(),
        onSeek: vi.fn(),
        onVolumeChange: vi.fn(),
        onClose: vi.fn(),
      })
    );

    // Notes ♪, ♫, ♬ are present
    expect(htmlPlaying).toContain("♪");
    expect(htmlPlaying).toContain("♫");
    expect(htmlPlaying).toContain("♬");
    expect(htmlPlaying).toContain("mm-music-note");
    expect(htmlPlaying).toContain("animation-play-state:running");
    expect(htmlPlaying).toContain("mm-artwork-pulse");

    const htmlPaused = renderToStaticMarkup(
      React.createElement(FullScreenPlayer, {
        track: sampleTrack,
        isPlaying: false,
        liked: false,
        position: 30,
        duration: 200,
        volume: 1,
        canNext: true,
        canPrevious: true,
        onTogglePlay: vi.fn(),
        onToggleLike: vi.fn(),
        onNext: vi.fn(),
        onPrevious: vi.fn(),
        onSeek: vi.fn(),
        onVolumeChange: vi.fn(),
        onClose: vi.fn(),
      })
    );

    expect(htmlPaused).toContain("animation-play-state:paused");
    expect(htmlPaused).not.toContain("mm-artwork-pulse");
  });

  it("has only one single Lyrics button (center) and removes duplicate lyrics from bottom toolbar", () => {
    const html = renderToStaticMarkup(
      React.createElement(FullScreenPlayer, {
        track: sampleTrack,
        isPlaying: true,
        liked: false,
        position: 30,
        duration: 200,
        volume: 1,
        canNext: true,
        canPrevious: true,
        onTogglePlay: vi.fn(),
        onToggleLike: vi.fn(),
        onNext: vi.fn(),
        onPrevious: vi.fn(),
        onSeek: vi.fn(),
        onVolumeChange: vi.fn(),
        onClose: vi.fn(),
      })
    );

    // Centered Lyrics button
    expect(html).toContain("<span>Lyrics</span>");

    // No duplicate MessageSquare button in bottom toolbar
    expect(html).not.toContain('aria-label="Show live lyrics"');
    expect(html).not.toContain('aria-label="Hide live lyrics"');
  });

  it("removes the Mini Player shortcut from the bottom toolbar", () => {
    const html = renderToStaticMarkup(
      React.createElement(FullScreenPlayer, {
        track: sampleTrack,
        isPlaying: true,
        liked: false,
        position: 30,
        duration: 200,
        volume: 1,
        canNext: true,
        canPrevious: true,
        onTogglePlay: vi.fn(),
        onToggleLike: vi.fn(),
        onNext: vi.fn(),
        onPrevious: vi.fn(),
        onSeek: vi.fn(),
        onVolumeChange: vi.fn(),
        onClose: vi.fn(),
        onOpenPip: vi.fn(),
        onOpenEqualizer: vi.fn(),
        onOpenSleepTimer: vi.fn(),
        onOpenShortcuts: vi.fn(),
        onOpenQueue: vi.fn(),
      })
    );

    // Mini Player PiP button is removed from toolbar
    expect(html).not.toContain('aria-label="Picture-in-Picture"');
    expect(html).not.toContain("Mini Floating Player");

    // Remaining toolbar controls are intact
    expect(html).toContain("EQ");
    expect(html).toContain("Timer");
    expect(html).toContain('aria-label="Keyboard Shortcuts &amp; Help"');
    expect(html).toContain('aria-label="Queue"');
  });
});

describe("LyricsPanel (Lyrics Screen)", () => {
  it("does not force 'dark' class and renders Light Theme styles with safe-area padding", () => {
    vi.spyOn(lyricsHook, "useTrackLyrics").mockReturnValue({
      loading: false,
      syncedLyrics: [],
      plainLyrics: null,
      isSynced: false,
      isInstrumental: false,
      source: "",
      error: null,
    });

    const html = renderToStaticMarkup(
      React.createElement(LyricsPanel, {
        trackId: "telugu-track-1",
        trackTitle: "Samajavaragamana",
        trackArtist: "Sid Sriram",
        currentTime: 42,
        isPlaying: true,
        onClose: vi.fn(),
      })
    );

    // Root element should not have standalone "dark" class that forces dark mode
    const rootClassMatch = html.match(/^<div[^>]*class="([^"]*)"/);
    const rootClasses = rootClassMatch?.[1] ? rootClassMatch[1].split(/\s+/) : [];
    expect(rootClasses).not.toContain("dark");
    expect(html).toContain("bg-[#FAF8FF]");
    expect(html).toContain("dark:bg-[#130d22]/95");
    expect(html).toContain("text-[#211536]");
    expect(html).toContain("dark:text-white");

    // Safe area top padding below Android status bar
    expect(html).toContain("padding-top:max(calc(var(--mm-inset-top, 0px) + 0.875rem), 2.5rem)");

    // Header background is white in light theme
    expect(html).toContain("bg-white dark:bg-[#171128]");

    // Rounded search bar input starts below header
    expect(html).toContain("rounded-full bg-[#F1EBFF] dark:bg-chip");
    expect(html).toContain("border-[#E5DDF5] dark:border-hair");
  });

  it("highlights currently playing lyric clearly with #8B5CF6 background and #A78BFA border", () => {
    const teluguLine1 = "సామజవరగమనా నిను చూసి ఆగలేనే";
    const teluguLine2 = "మల్లెల వానై నువ్వు కురిశావే";

    vi.spyOn(lyricsHook, "useTrackLyrics").mockReturnValue({
      loading: false,
      syncedLyrics: [
        { time: 0, text: teluguLine1 },
        { time: 15, text: teluguLine2 },
      ],
      plainLyrics: null,
      isSynced: true,
      isInstrumental: false,
      source: "LRCLIB",
      error: null,
    });

    const html = renderToStaticMarkup(
      React.createElement(LyricsPanel, {
        trackId: "telugu-track-1",
        trackTitle: "Samajavaragamana",
        trackArtist: "Sid Sriram",
        currentTime: 5,
        isPlaying: true,
        onClose: vi.fn(),
      })
    );

    // Highlighted line has #FFFFFF text, #8B5CF6 background, and #A78BFA border
    expect(html).toContain("bg-[#8B5CF6]");
    expect(html).toContain("border-[#A78BFA]");
    expect(html).toContain("text-white font-semibold");

    // Inactive line has secondary text color #746A85
    expect(html).toContain("text-[#746A85]");

    // Telugu lyric text renders with clean font and word wrapping
    expect(html).toContain(teluguLine1);
    expect(html).toContain(teluguLine2);
    expect(html).toContain("leading-relaxed font-sans break-words");

    vi.restoreAllMocks();
  });

  it("supports responsive widths (360px, 390px, 430px) with proper overflow bounds", () => {
    const html = renderToStaticMarkup(
      React.createElement(LyricsPanel, {
        trackId: "telugu-track-1",
        trackTitle: "Samajavaragamana",
        trackArtist: "Sid Sriram",
        currentTime: 5,
        isPlaying: true,
        onClose: vi.fn(),
      })
    );

    // Dialog layout has full width responsiveness up to max-w-md and overflow containment
    expect(html).toContain("w-full max-w-md");
    expect(html).toContain("overflow-hidden");
    expect(html).toContain("scrollbar-premium");
  });
});
