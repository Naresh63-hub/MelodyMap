import { describe, expect, it } from "vitest";
import { isAllowedUpstreamUrl } from "./stream-proxy-core";
import { PROVIDER_REGISTRY, isFullPlaybackProvider } from "./providers/registry";
import { searchDeezerTracks } from "./providers/deezer";
import { deduplicateMultiProviderTracks } from "./providers/dedup";
import type { UnifiedTrack } from "./providers/types";

describe("Strict Full-Length Playback Policy (No 30-Second Previews)", () => {
  it("rejects Deezer preview CDN (.dzcdn.net) in upstream stream proxy", () => {
    expect(isAllowedUpstreamUrl("https://cdns-preview-d.dzcdn.net/stream/12345.mp3")).toBe(false);
    expect(isAllowedUpstreamUrl("https://e-cdns-preview.dzcdn.net/stream/abc.mp4")).toBe(false);
  });

  it("allows authorized full-length stream providers (Audius, Jamendo, GoogleVideo)", () => {
    expect(isAllowedUpstreamUrl("https://creatornode.audius.co/tracks/stream/1")).toBe(true);
    expect(isAllowedUpstreamUrl("https://mp3d.jamendo.com/download/track/123/mp32")).toBe(true);
    expect(isAllowedUpstreamUrl("https://rr1---sn-xyz.googlevideo.com/videoplayback?x=1")).toBe(true);
  });

  it("marks Deezer in PROVIDER_REGISTRY as non-playable and metadata-only", () => {
    expect(PROVIDER_REGISTRY.deezer.canPlayback).toBe(false);
    expect(PROVIDER_REGISTRY.deezer.playbackType).toBe("none");
    expect(isFullPlaybackProvider("deezer")).toBe(false);
  });

  it("marks Deezer search results as non-playable without previewUrl", async () => {
    // Hermetic test mocking Deezer API
    const mockTrack = {
      id: 123456,
      title: "Test Song",
      artist: { id: 1, name: "Test Artist" },
      duration: 210,
      preview: "https://cdns-preview-d.dzcdn.net/stream/123456.mp3",
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ data: [mockTrack], total: 1 }), { status: 200 });

    try {
      const results = await searchDeezerTracks("Test Song");
      expect(results).toHaveLength(1);
      const track = results[0]!;
      expect(track.playable).toBe(false);
      expect(track.playbackSource).toBeUndefined();
      expect(track.previewUrl).toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("deduplication discards preview playback sources and keeps only full-length streams", () => {
    const fullTrack: UnifiedTrack = {
      id: "audius:abc",
      canonicalTrackId: "audius:abc",
      title: "Song A",
      artist: "Artist A",
      duration: "3:30",
      durationSeconds: 210,
      thumbnail: "",
      provider: "audius",
      providerTrackId: "abc",
      playable: true,
      playbackSource: {
        provider: "audius",
        providerTrackId: "abc",
        url: "https://audius.co/stream/abc",
        type: "full",
      },
      availableAlternatives: [],
      isrc: "TEST12345",
    };

    const previewTrack: UnifiedTrack = {
      id: "deezer:xyz",
      canonicalTrackId: "deezer:xyz",
      title: "Song A",
      artist: "Artist A",
      duration: "3:30",
      durationSeconds: 210,
      thumbnail: "",
      provider: "deezer",
      providerTrackId: "xyz",
      playable: false,
      playbackSource: {
        provider: "deezer",
        providerTrackId: "xyz",
        url: "https://cdns-preview.dzcdn.net/stream/xyz.mp3",
        type: "preview",
      },
      availableAlternatives: [],
      isrc: "TEST12345",
    };

    const deduplicated = deduplicateMultiProviderTracks([previewTrack, fullTrack]);
    expect(deduplicated).toHaveLength(1);
    expect(deduplicated[0]?.playbackSource?.type).toBe("full");
    expect(deduplicated[0]?.playbackSource?.provider).toBe("audius");
    // Preview source must NOT be added to availableAlternatives
    expect(deduplicated[0]?.availableAlternatives).toHaveLength(0);
  });
});
