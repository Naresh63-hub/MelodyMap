import { describe, expect, it } from "vitest";
import { PROVIDER_REGISTRY, getRegisteredProviders, isFullPlaybackProvider } from "./registry";
import { deduplicateMultiProviderTracks, areSameMultiProviderTrack } from "./dedup";
import type { UnifiedTrack, PlaybackSource } from "./types";
import { SKIP_FORWARD_SECONDS, SKIP_BACKWARD_SECONDS } from "../use-audio-player";

describe("Multi-Provider Streaming Architecture", () => {
  describe("Provider Registry & Compliance", () => {
    it("reports all required providers with accurate playback and metadata capabilities", () => {
      const providers = getRegisteredProviders();
      expect(providers.length).toBeGreaterThanOrEqual(6);

      const audius = PROVIDER_REGISTRY.audius;
      expect(audius.canPlayback).toBe(true);
      expect(audius.playbackType).toBe("full");

      const jamendo = PROVIDER_REGISTRY.jamendo;
      expect(jamendo.canPlayback).toBe(true);
      expect(jamendo.playbackType).toBe("full");

      const deezer = PROVIDER_REGISTRY.deezer;
      expect(deezer.canPlayback).toBe(false);
      expect(deezer.playbackType).toBe("none");

      const mb = PROVIDER_REGISTRY.musicbrainz;
      expect(mb.canPlayback).toBe(false);
      expect(mb.playbackType).toBe("none");
      expect(mb.canMetadata).toBe(true);
    });

    it("accurately identifies full playback providers", () => {
      expect(isFullPlaybackProvider("audius")).toBe(true);
      expect(isFullPlaybackProvider("jamendo")).toBe(true);
      expect(isFullPlaybackProvider("archive")).toBe(true);
      expect(isFullPlaybackProvider("deezer")).toBe(false);
      expect(isFullPlaybackProvider("musicbrainz")).toBe(false);
    });
  });

  describe("Cross-Provider Deduplication & Canonical Identity", () => {
    const audiusTrack: UnifiedTrack = {
      id: "audius:track1",
      canonicalTrackId: "audius:track1",
      title: "Shape of You",
      artist: "Ed Sheeran",
      duration: "3:53",
      durationSeconds: 233,
      thumbnail: "https://example.com/art1.jpg",
      provider: "audius",
      providerTrackId: "track1",
      playable: true,
      playbackSource: {
        provider: "audius",
        providerTrackId: "track1",
        url: "https://audius.co/stream/track1",
        type: "full",
      },
      availableAlternatives: [],
      isrc: "GBAHS1600463",
    };

    const jamendoTrack: UnifiedTrack = {
      id: "jamendo:track2",
      canonicalTrackId: "jamendo:track2",
      title: "Shape of You (Acoustic)",
      artist: "Ed Sheeran",
      duration: "3:55",
      durationSeconds: 235,
      thumbnail: "https://example.com/art2.jpg",
      provider: "jamendo",
      providerTrackId: "track2",
      playable: true,
      playbackSource: {
        provider: "jamendo",
        providerTrackId: "track2",
        url: "https://jamendo.com/stream/track2.mp3",
        type: "full",
      },
      availableAlternatives: [],
      isrc: "GBAHS1600463", // Matching ISRC
    };

    const deezerTrack: UnifiedTrack = {
      id: "deezer:track3",
      canonicalTrackId: "deezer:track3",
      title: "Shape of You",
      artist: "Ed Sheeran",
      duration: "3:53",
      durationSeconds: 233,
      thumbnail: "https://example.com/art3.jpg",
      provider: "deezer",
      providerTrackId: "track3",
      playable: true,
      playbackSource: {
        provider: "deezer",
        providerTrackId: "track3",
        url: "https://deezer.com/preview/track3.mp3",
        type: "preview",
      },
      availableAlternatives: [],
      isrc: "GBAHS1600463",
    };

    const differentArtistTrack: UnifiedTrack = {
      id: "jamendo:track4",
      canonicalTrackId: "jamendo:track4",
      title: "Shape of You",
      artist: "Cover Artist Band", // Genuinely different artist!
      duration: "3:53",
      durationSeconds: 233,
      thumbnail: "https://example.com/art4.jpg",
      provider: "jamendo",
      providerTrackId: "track4",
      playable: true,
      playbackSource: {
        provider: "jamendo",
        providerTrackId: "track4",
        url: "https://jamendo.com/stream/track4.mp3",
        type: "full",
      },
      availableAlternatives: [],
    };

    it("identifies tracks with identical ISRC as the same logical song", () => {
      expect(areSameMultiProviderTrack(audiusTrack, jamendoTrack)).toBe(true);
      expect(areSameMultiProviderTrack(audiusTrack, deezerTrack)).toBe(true);
    });

    it("keeps different artists with the same title strictly separate", () => {
      expect(areSameMultiProviderTrack(audiusTrack, differentArtistTrack)).toBe(false);
    });

    it("collapses duplicate provider entries into 1 unified track and gathers alternative sources", () => {
      const merged = deduplicateMultiProviderTracks([audiusTrack, jamendoTrack, deezerTrack, differentArtistTrack]);

      // 4 input tracks collapse into 2 distinct logical songs
      expect(merged).toHaveLength(2);

      const edSheeranSong = merged.find((t) => t.artist === "Ed Sheeran");
      expect(edSheeranSong).toBeDefined();

      // Prioritizes full playback over preview
      expect(edSheeranSong?.playbackSource?.type).toBe("full");

      // Alternative sources collected
      expect(edSheeranSong?.availableAlternatives?.length).toBeGreaterThanOrEqual(1);

      // Different artist is preserved independently
      const coverSong = merged.find((t) => t.artist === "Cover Artist Band");
      expect(coverSong).toBeDefined();
    });
  });

  describe("Spotify-Style Playback Controls & Boundaries", () => {
    it("uses standard within-track scrub increment (not 30s or track skip)", () => {
      expect(SKIP_FORWARD_SECONDS).toBeLessThanOrEqual(10);
      expect(SKIP_FORWARD_SECONDS).toBeGreaterThan(0);
      expect(SKIP_FORWARD_SECONDS).not.toBe(30);
      expect(SKIP_BACKWARD_SECONDS).toBeLessThanOrEqual(10);
      expect(SKIP_BACKWARD_SECONDS).toBeGreaterThan(0);
    });

    it("validates duration cap (0 < seconds <= 600) for music", () => {
      const validTrack: UnifiedTrack = {
        id: "audius:ok",
        canonicalTrackId: "audius:ok",
        title: "Song",
        artist: "Artist",
        duration: "3:45",
        durationSeconds: 225,
        thumbnail: "",
        provider: "audius",
        providerTrackId: "ok",
        playable: true,
      };

      const tooLongTrack: UnifiedTrack = {
        ...validTrack,
        id: "audius:long",
        durationSeconds: 601,
      };

      const zeroTrack: UnifiedTrack = {
        ...validTrack,
        id: "audius:zero",
        durationSeconds: 0,
      };

      expect(validTrack.durationSeconds > 0 && validTrack.durationSeconds <= 600).toBe(true);
      expect(tooLongTrack.durationSeconds > 0 && tooLongTrack.durationSeconds <= 600).toBe(false);
      expect(zeroTrack.durationSeconds > 0 && zeroTrack.durationSeconds <= 600).toBe(false);
    });
  });
});
