/**
 * Music Provider Registry
 * Manages provider metadata, terms compliance, rate limiting, and capability discovery.
 */

import type { ProviderCapabilities, MusicProviderName } from "./types";

export const PROVIDER_REGISTRY: Record<MusicProviderName, ProviderCapabilities> = {
  audius: {
    name: "audius",
    displayName: "Audius (Decentralized Catalog)",
    canDiscover: true,
    canMetadata: true,
    canPlayback: true,
    playbackType: "full",
    requiresAuth: false,
    requiresApiKey: false,
    rateLimitPerMin: 120,
    description: "Artist-uploaded independent and decentralized music with official authorized 320kbps full streaming.",
    termsUrl: "https://audius.org/terms-of-use",
  },
  jamendo: {
    name: "jamendo",
    displayName: "Jamendo Music",
    canDiscover: true,
    canMetadata: true,
    canPlayback: true,
    playbackType: "full",
    requiresAuth: false,
    requiresApiKey: false,
    rateLimitPerMin: 100,
    description: "Curated independent music catalog licensed under Creative Commons with official full-length MP3 playback.",
    termsUrl: "https://www.jamendo.com/legal/terms-of-use",
  },
  deezer: {
    name: "deezer",
    displayName: "Deezer API",
    canDiscover: true,
    canMetadata: true,
    canPlayback: true,
    playbackType: "preview",
    requiresAuth: false,
    requiresApiKey: false,
    rateLimitPerMin: 50,
    description: "Global commercial music catalog providing official ISRCs, rich metadata, and 30-second audio previews.",
    termsUrl: "https://developers.deezer.com/guidelines",
  },
  archive: {
    name: "archive",
    displayName: "Internet Archive",
    canDiscover: true,
    canMetadata: true,
    canPlayback: true,
    playbackType: "full",
    requiresAuth: false,
    requiresApiKey: false,
    rateLimitPerMin: 60,
    description: "Public domain historical recordings and Live Music Archive with legitimate non-commercial access.",
    termsUrl: "https://archive.org/about/terms.php",
  },
  musicbrainz: {
    name: "musicbrainz",
    displayName: "MusicBrainz",
    canDiscover: false,
    canMetadata: true,
    canPlayback: false,
    playbackType: "none",
    requiresAuth: false,
    requiresApiKey: false,
    rateLimitPerMin: 60,
    description: "Open community encyclopedia providing authoritative recording IDs, releases, and work relationships. Metadata-only.",
    termsUrl: "https://musicbrainz.org/doc/MusicBrainz_Database/Download",
  },
  listenbrainz: {
    name: "listenbrainz",
    displayName: "ListenBrainz",
    canDiscover: false,
    canMetadata: true,
    canPlayback: false,
    playbackType: "none",
    requiresAuth: false,
    requiresApiKey: false,
    rateLimitPerMin: 60,
    description: "Open source listening history platform providing community listening insights. Metadata-only.",
    termsUrl: "https://listenbrainz.org/",
  },
  youtube: {
    name: "youtube",
    displayName: "YouTube Music (Fallback)",
    canDiscover: true,
    canMetadata: true,
    canPlayback: true,
    playbackType: "full",
    requiresAuth: false,
    requiresApiKey: false,
    rateLimitPerMin: 60,
    description: "Secondary fallback provider utilized only when primary open and licensed catalogs cannot find a match.",
    termsUrl: "https://www.youtube.com/t/terms",
  },
};

/**
 * Returns capability disclosure for all providers.
 */
export function getRegisteredProviders(): ProviderCapabilities[] {
  return Object.values(PROVIDER_REGISTRY);
}

/**
 * Check if a provider supports authorized full-track playback.
 */
export function isFullPlaybackProvider(name: MusicProviderName): boolean {
  return PROVIDER_REGISTRY[name]?.playbackType === "full";
}
