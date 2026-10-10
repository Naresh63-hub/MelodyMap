import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  normalizePodcastLanguage,
  searchPodcasts,
  getPodcastEpisodes,
} from "./podcast.server";
import { episodeToTrack, type PodcastEpisode } from "./podcast.types";
import { isPodcastTrack } from "./track-filters";
import { hasPlayableDuration } from "./feed-freshness";
import type { Track } from "./library";

describe("Podcast Subsystem", () => {
  describe("normalizePodcastLanguage", () => {
    it("maps Telugu to ISO 'te' and Indian iTunes store 'in'", () => {
      const norm = normalizePodcastLanguage("Telugu");
      expect(norm.code).toBe("te");
      expect(norm.name).toBe("Telugu");
      expect(norm.country).toBe("in");
    });

    it("maps Hindi to ISO 'hi' and Indian iTunes store 'in'", () => {
      const norm = normalizePodcastLanguage("Hindi");
      expect(norm.code).toBe("hi");
      expect(norm.name).toBe("Hindi");
      expect(norm.country).toBe("in");
    });

    it("maps Tamil to ISO 'ta' and Indian iTunes store 'in'", () => {
      const norm = normalizePodcastLanguage("Tamil");
      expect(norm.code).toBe("ta");
      expect(norm.name).toBe("Tamil");
      expect(norm.country).toBe("in");
    });

    it("maps Kannada to ISO 'kn' and Indian iTunes store 'in'", () => {
      const norm = normalizePodcastLanguage("kannada");
      expect(norm.code).toBe("kn");
      expect(norm.name).toBe("Kannada");
      expect(norm.country).toBe("in");
    });

    it("maps English to ISO 'en' and US store 'us'", () => {
      const norm = normalizePodcastLanguage("English");
      expect(norm.code).toBe("en");
      expect(norm.name).toBe("English");
      expect(norm.country).toBe("us");
    });

    it("handles ISO code inputs directly", () => {
      expect(normalizePodcastLanguage("te").name).toBe("Telugu");
      expect(normalizePodcastLanguage("hi").name).toBe("Hindi");
      expect(normalizePodcastLanguage("en").country).toBe("us");
    });

    it("defaults unknown languages safely without crashing", () => {
      const fallback = normalizePodcastLanguage("unknown-xyz");
      expect(fallback.code).toBeDefined();
      expect(fallback.country).toBeDefined();
    });
  });

  describe("episodeToTrack", () => {
    const mockEpisode: PodcastEpisode = {
      id: "podcast:ep:12345",
      podcastId: "podcast:show:987",
      podcastTitle: "Telugu Tech Podcast",
      title: "Episode 1: AI & Deep Learning in 2026",
      description: "An in-depth discussion on machine learning models.",
      artworkUrl: "https://example.com/show-art.jpg",
      audioUrl: "https://media.example.com/audio/ep1.mp3",
      duration: "45:30",
      durationSeconds: 2730,
      publishedAt: "2026-09-15T10:00:00Z",
      provider: "itunes",
    };

    it("converts PodcastEpisode into a compatible Track object", () => {
      const track = episodeToTrack(mockEpisode);
      expect(track.id).toBe("podcast:ep:12345");
      expect(track.title).toBe("Episode 1: AI & Deep Learning in 2026");
      expect(track.artist).toBe("Telugu Tech Podcast");
      expect(track.previewUrl).toBe("https://media.example.com/audio/ep1.mp3");
      expect(track.duration).toBe("45:30");
      expect(track.durationSeconds).toBe(2730);
      expect(track.source).toBe("podcast");
      expect(track.playable).toBe(true);
    });

    it("marks tracks without audioUrl as unplayable", () => {
      const track = episodeToTrack({ ...mockEpisode, audioUrl: "" });
      expect(track.playable).toBe(false);
    });
  });

  describe("Podcast Identification & Duration Immunity", () => {
    it("identifies podcast tracks by source or id prefix", () => {
      const podcastTrack: Track = {
        id: "podcast:ep:999",
        title: "Daily News Bulletin",
        artist: "News Express",
        duration: "35:00",
        source: "podcast",
        thumbnail: "https://example.com/thumb.jpg",
      };
      expect(isPodcastTrack(podcastTrack)).toBe(true);

      const trackById: Track = {
        id: "podcast:ep:888",
        title: "Storytelling Podcast",
        artist: "Host",
        duration: "20:00",
        thumbnail: "https://example.com/thumb.jpg",
      };
      expect(isPodcastTrack(trackById)).toBe(true);
    });

    it("rejects regular music tracks from being classified as podcasts", () => {
      const musicTrack: Track = {
        id: "deezer:12345",
        title: "Samajavaragamana",
        artist: "Sid Sriram",
        duration: "3:45",
        source: "deezer",
        thumbnail: "https://example.com/thumb.jpg",
      };
      expect(isPodcastTrack(musicTrack)).toBe(false);

      // YouTube compilation tracks and record label uploads from user screenshot
      expect(
        isPodcastTrack({
          id: "yt:purelove",
          title: "Pure Love Vibes Telugu Songs",
          artist: "Aditya Music PLAYBACK",
          duration: "45:00",
        }),
      ).toBe(false);

      expect(
        isPodcastTrack({
          id: "yt:romantic",
          title: "Best Romantic Songs",
          artist: "Grow Music",
          duration: "30:00",
        }),
      ).toBe(false);

      expect(
        isPodcastTrack({
          id: "yt:yaalalo",
          title: "YAALALO YAALALO Full Video Song",
          artist: "T-Series Telugu",
          duration: "5:30",
        }),
      ).toBe(false);
    });

    it("exempts podcast episodes from 600-second music duration restriction", () => {
      const longMusicTrack: Track = {
        id: "yt:overlong123",
        title: "All Time Telugu Hits Jukebox",
        artist: "Various",
        duration: "45:00", // 2700s > 600s
        thumbnail: "https://example.com/thumb.jpg",
      };

      // Music tracks >600s are forbidden by hasPlayableDuration and are NOT podcasts
      expect(hasPlayableDuration(longMusicTrack)).toBe(false);
      expect(isPodcastTrack(longMusicTrack)).toBe(false);

      const longPodcastEpisode: Track = {
        id: "podcast:ep:long1",
        title: "Deep History: Vijayanagara Empire",
        artist: "Telugu History Show",
        duration: "1:15:20", // 4520s >> 600s
        source: "podcast",
        thumbnail: "https://example.com/thumb.jpg",
      };

      // Podcasts are legitimate long-form audio and identified as podcasts
      expect(isPodcastTrack(longPodcastEpisode)).toBe(true);
    });
  });

  describe("searchPodcasts & Strict Language Policy", () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
      vi.restoreAllMocks();
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("queries iTunes with country='in' when Telugu language is requested", async () => {
      let requestedUrl = "";
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        requestedUrl = url;
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              resultCount: 1,
              results: [
                {
                  collectionId: 1001,
                  collectionName: "Telugu Geethalu Podcast",
                  artistName: "Radio Telugu",
                  artworkUrl600: "https://example.com/telugu.jpg",
                  primaryGenreName: "Music",
                  trackCount: 15,
                  feedUrl: "https://example.com/feed.xml",
                },
              ],
            }),
        });
      });

      const podcasts = await searchPodcasts({ language: "Telugu", limit: 10 });
      expect(requestedUrl).toContain("country=in");
      expect(podcasts.length).toBe(1);
      expect(podcasts[0]?.title).toBe("Telugu Geethalu Podcast");
    });

    it("rejects shows with conflicting language brackets (e.g. Hindi when Telugu selected)", async () => {
      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              resultCount: 2,
              results: [
                {
                  collectionId: 2001,
                  collectionName: "Tech Talk (Hindi)", // Conflicting bracket
                  artistName: "Hindi Creator",
                  artworkUrl600: "https://example.com/hindi.jpg",
                  primaryGenreName: "Technology",
                },
                {
                  collectionId: 2002,
                  collectionName: "Telugu Varthalu Show", // Valid Telugu
                  artistName: "Telugu News",
                  artworkUrl600: "https://example.com/telugu.jpg",
                  primaryGenreName: "News",
                },
              ],
            }),
        }),
      );

      const podcasts = await searchPodcasts({ language: "Telugu" });
      expect(podcasts.length).toBe(1);
      expect(podcasts[0]?.title).toBe("Telugu Varthalu Show");
    });

    it("strictly adheres to zero-fallback policy: returns empty array if no matches", async () => {
      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              resultCount: 0,
              results: [],
            }),
        }),
      );

      const podcasts = await searchPodcasts({ language: "Telugu" });
      // MUST NOT substitute Joe Rogan or English shows!
      expect(podcasts).toEqual([]);
    });
  });

  describe("getPodcastEpisodes", () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("retrieves playable episodes with direct audio URLs and accurate durations", async () => {
      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              resultCount: 3,
              results: [
                {
                  wrapperType: "track",
                  kind: "podcast",
                  collectionName: "Telugu Tech Show",
                }, // Feed header row in iTunes lookup
                {
                  wrapperType: "podcastEpisode",
                  trackId: 5001,
                  trackName: "Episode 1: Getting Started with React",
                  description: "Introduction to React and Vite.",
                  episodeUrl: "https://cdn.example.com/ep1.mp3",
                  trackTimeMillis: 1800000, // 30 mins
                  releaseDate: "2026-09-01T00:00:00Z",
                  artworkUrl600: "https://example.com/ep1.jpg",
                },
                {
                  wrapperType: "podcastEpisode",
                  trackId: 5002,
                  trackName: "Episode 2: TypeScript Advanced Types",
                  description: "Generics and conditional types.",
                  episodeUrl: "https://cdn.example.com/ep2.mp3",
                  trackTimeMillis: 2700000, // 45 mins
                  releaseDate: "2026-09-08T00:00:00Z",
                  artworkUrl600: "https://example.com/ep2.jpg",
                },
              ],
            }),
        }),
      );

      const episodes = await getPodcastEpisodes("1001", 10);
      expect(episodes.length).toBe(2);
      expect(episodes[0]?.id).toBe("podcast:ep:5001");
      expect(episodes[0]?.title).toBe("Episode 1: Getting Started with React");
      expect(episodes[0]?.audioUrl).toBe("https://cdn.example.com/ep1.mp3");
      expect(episodes[0]?.duration).toBe("30:00");
      expect(episodes[0]?.durationSeconds).toBe(1800);

      expect(episodes[1]?.id).toBe("podcast:ep:5002");
      expect(episodes[1]?.duration).toBe("45:00");
      expect(episodes[1]?.durationSeconds).toBe(2700);
    });
  });
});
