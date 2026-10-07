/**
 * Playback URL policy: which tracks may use a direct URL and which must
 * stream through the server proxy.
 *
 * Catalog tracks (plain YouTube IDs) advertise a `previewUrl` from metadata
 * enrichment — a Deezer 30-SECOND SAMPLE. Playing that URL directly bypasses
 * the stream proxy entirely, so the server-side full-length fallback chain
 * (YouTube → Audius full track → Jamendo full track) never runs. That is why
 * songs used to cut off at 0:30 even after the server fallback shipped.
 *
 * Policy:
 *  - catalog tracks        → ALWAYS the proxy URL (full-length resolution)
 *  - audius/jamendo/archive → direct URL (already full-length, provider-authorized)
 *  - podcast:*              → direct URL (episode media, needs its own host)
 */
const FULL_LENGTH_DIRECT_PREFIXES = ["saavn:", "audius:", "jamendo:", "archive:", "podcast:"];

/** True when `track.id` belongs to a provider whose direct URL is a full-length track. */
export function hasFullLengthDirectSource(id: string | null | undefined): boolean {
  if (!id) return false;
  return FULL_LENGTH_DIRECT_PREFIXES.some((p) => id.startsWith(p));
}

/**
 * Best playback URL for a track: keep the direct URL only for genuinely
 * full-length external sources; everything else gets the proxy URL built by
 * `buildProxyUrl` (the player's own builder, which applies network-quality
 * settings) so the full-length fallback chain always has a chance.
 */
export function resolveTrackStreamUrl(
  track: { id: string; previewUrl?: string | undefined },
  buildProxyUrl: (id: string) => string,
): string {
  if (track.previewUrl && hasFullLengthDirectSource(track.id)) {
    return track.previewUrl;
  }
  return buildProxyUrl(track.id);
}
