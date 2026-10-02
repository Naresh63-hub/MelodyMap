/**
 * MusicBrainz Metadata Provider
 * Open music encyclopedia providing authoritative Recording IDs (MBID), ISRCs,
 * release relationships, and canonical metadata enrichment.
 *
 * NOTE: MusicBrainz is a pure METADATA provider; it does NOT provide audio streams.
 *
 * API Docs: https://musicbrainz.org/doc/MusicBrainz_API
 */

export interface MusicBrainzRecording {
  id: string; // MBID
  title: string;
  artist: string;
  isrcs: string[];
  durationMs?: number | undefined;
  releases?: string[] | undefined;
}

interface MbRecordingResult {
  id: string;
  title: string;
  length?: number | undefined;
  "artist-credit"?: Array<{ name: string }> | undefined;
  isrcs?: string[] | undefined;
  releases?: Array<{ title: string }> | undefined;
}

interface MbResponse {
  recordings?: MbRecordingResult[] | undefined;
}

export async function lookupMusicBrainzRecording(
  title: string,
  artist: string,
): Promise<MusicBrainzRecording | null> {
  const cleanTitle = title.trim();
  const cleanArtist = artist.trim();
  if (!cleanTitle) return null;

  const query = cleanArtist
    ? `recording:"${cleanTitle}" AND artist:"${cleanArtist}"`
    : `recording:"${cleanTitle}"`;

  const url = `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(query)}&fmt=json&limit=3`;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "MelodyMap/1.0.0 (https://github.com/Naresh63-hub/Musicplayer)",
      },
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as MbResponse;
    const first = data.recordings?.[0];
    if (!first) return null;

    const artistName = first["artist-credit"]?.map((a) => a.name).join(", ") || cleanArtist;

    return {
      id: first.id,
      title: first.title,
      artist: artistName,
      isrcs: first.isrcs || [],
      durationMs: first.length,
      releases: first.releases?.map((r) => r.title),
    };
  } catch {
    return null;
  }
}
