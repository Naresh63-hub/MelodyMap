/**
 * Unified multi-provider music types and contracts.
 * Normalizes all streaming and metadata sources into a single Spotify-like canonical model.
 */

export type MusicProviderName =
  | "saavn"
  | "audius"
  | "jamendo"
  | "deezer"
  | "archive"
  | "youtube"
  | "musicbrainz"
  | "listenbrainz";

export type PlaybackSourceType = "full" | "preview" | "stream_proxy" | "youtube_iframe";

/**
 * An authorized, playable audio source for a track.
 */
export interface PlaybackSource {
  provider: MusicProviderName;
  providerTrackId: string;
  url: string;
  type: PlaybackSourceType;
  bitrateKbps?: number | undefined;
  format?: string | undefined;
  isFallback?: boolean | undefined;
}

/**
 * Metadata capabilities and compliance disclosure for each registered provider.
 */
export interface ProviderCapabilities {
  name: MusicProviderName;
  displayName: string;
  canDiscover: boolean;
  canMetadata: boolean;
  canPlayback: boolean;
  playbackType: "full" | "preview" | "none";
  requiresAuth: boolean;
  requiresApiKey: boolean;
  rateLimitPerMin?: number | undefined;
  description: string;
  termsUrl?: string | undefined;
}

/**
 * Unified canonical Track model across all providers.
 * Drop-in compatible with MelodyMap's existing Track interface.
 */
export interface UnifiedTrack {
  id: string; // compatibility ID
  canonicalTrackId: string; // unique recording / song fingerprint
  title: string;
  artist: string;
  album?: string | undefined;
  duration: string; // "m:ss" format for UI
  durationSeconds: number; // raw numeric duration for filters & playback
  thumbnail: string;
  artwork?: string | undefined;
  languageCode?: string | undefined;
  provider: MusicProviderName;
  providerTrackId: string;
  playable: boolean;
  playbackSource?: PlaybackSource | undefined;
  availableAlternatives?: PlaybackSource[] | undefined; // Alternative providers for the SAME recording
  recordingId?: string | undefined; // MusicBrainz Recording UUID if resolved
  isrc?: string | undefined; // International Standard Recording Code
  isExplicit?: boolean | undefined;
  year?: string | undefined;
  source?: "saavn" | "audius" | "jamendo" | "deezer" | "archive" | "youtube" | "podcast" | "multi" | undefined;
  previewUrl?: string | undefined; // direct audio URL for HTML5 player
  reason?: string | undefined;
}

/**
 * Common search query options for multi-provider discovery.
 */
export interface ProviderSearchOptions {
  limit?: number | undefined;
  language?: string | undefined;
  languageCode?: string | undefined;
  genre?: string | undefined;
  signal?: AbortSignal | undefined;
}
