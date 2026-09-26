/**
 * Deezer Search API — free, no API key needed.
 *
 * Provides 30-second audio previews for tracks. Used as a fallback when
 * YouTube search fails or tracks are restricted. The preview URLs are
 * direct MP3 links that play in a plain <audio> element.
 */

import type { Track } from "./music.server";

type DeezerTrack = {
  id: number;
  title: string;
  artist: { name: string };
  album: {
    title: string;
    cover_medium: string;
    cover_big: string;
  };
  preview: string; // 30-second MP3 URL
  duration: number; // seconds
};

type DeezerSearchResponse = {
  data: DeezerTrack[];
  total: number;
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Search Deezer for tracks matching a query.
 * Returns tracks with direct audio preview URLs.
 */
export async function searchDeezer(
  query: string,
  limit = 10,
): Promise<Track[]> {
  const url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${limit}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": "MelodyMap/1.0" },
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    return [];
  }
  if (!res.ok) return [];

  let body: DeezerSearchResponse;
  try {
    body = (await res.json()) as DeezerSearchResponse;
  } catch {
    return [];
  }

  return (body.data ?? [])
    .filter((t) => t.preview && t.duration > 30)
    .map((t) => ({
      id: `deezer:${t.id}`,
      title: t.title,
      artist: t.artist?.name ?? "Unknown",
      duration: formatDuration(t.duration),
      thumbnail: t.album?.cover_medium ?? t.album?.cover_big ?? "",
      previewUrl: t.preview,
      source: "deezer" as const,
    }));
}

/**
 * Given a YouTube track title + artist, search Deezer for the same song.
 * Returns the direct preview URL or null.
 */
export async function findDeezerPreview(
  title: string,
  artist: string,
): Promise<string | null> {
  // Strip common YouTube title clutter for a cleaner search
  const cleanTitle = title
    .replace(/\|.*$/, "") // everything after |
    .replace(/\(.*official.*\)/gi, "") // (Official Video), etc.
    .replace(/\[.*\]/g, "") // [Lyrics], [HD], etc.
    .replace(/official video|official audio|lyrics|hd|4k|mv/gi, "")
    .trim()
    .slice(0, 80);

  const query = cleanTitle ? `${cleanTitle} ${artist}` : `${title} ${artist}`;
  const results = await searchDeezer(query, 3);
  return results[0]?.previewUrl ?? null;
}

// ─── Related Artists Graph & Fallback ──────────────────────────────

export const REGIONAL_ARTIST_GRAPH: Record<string, string[]> = {
  // Telugu
  "sid sriram": ["Anurag Kulkarni", "Ram Miriyala", "Armaan Malik", "Karthik", "Devi Sri Prasad"],
  "anirudh ravichander": ["Devi Sri Prasad", "S. Thaman", "Yuvan Shankar Raja", "Santhosh Narayanan", "G.V. Prakash Kumar"],
  "devi sri prasad": ["S. Thaman", "Anirudh Ravichander", "M.M. Keeravaani", "Ram Miriyala", "Chaitan Bharadwaj"],
  "s. thaman": ["Devi Sri Prasad", "Anirudh Ravichander", "Bheems Ceciroleo", "Chaitan Bharadwaj"],
  "sp balasubrahmanyam": ["K.J. Yesudas", "Hariharan", "Mano", "K.S. Chithra", "S. Janaki"],
  "s. p. balasubrahmanyam": ["K.J. Yesudas", "Hariharan", "Mano", "K.S. Chithra", "S. Janaki"],
  "ram miriyala": ["Anurag Kulkarni", "Mangli", "Rahul Sipligunj", "Bheems Ceciroleo", "Vivek Sagar"],
  "anurag kulkarni": ["Sid Sriram", "Ram Miriyala", "Karthik", "Armaan Malik"],
  // Hindi / Bollywood
  "arijit singh": ["Atif Aslam", "Mohit Chauhan", "Jubin Nautiyal", "Vishal Mishra", "KK"],
  "shreya ghoshal": ["Sunidhi Chauhan", "Alka Yagnik", "Neeti Mohan", "Chinmayi Sripaada", "Monali Thakur"],
  "atif aslam": ["Arijit Singh", "KK", "Mohit Chauhan", "Sonu Nigam", "Pritam"],
  "pritam": ["Sachin-Jigar", "Vishal-Shekhar", "A.R. Rahman", "Amit Trivedi", "Mithoon"],
  "sonu nigam": ["Shaan", "Udit Narayan", "Kumar Sanu", "Abhijeet Bhattacharya", "KK"],
  "kishore kumar": ["Mohammed Rafi", "Mukesh", "Manna Dey", "Lata Mangeshkar", "Asha Bhosle"],
  "diljit dosanjh": ["Karan Aujla", "AP Dhillon", "Sidhu Moose Wala", "Shubh", "Guru Randhawa"],
  "vishal mishra": ["Arijit Singh", "B Praak", "Jubin Nautiyal", "Sachet Tandon"],
  "b praak": ["Jaani", "Harrdy Sandhu", "Vishal Mishra", "Jassie Gill"],
  // Tamil
  "a.r. rahman": ["Harris Jayaraj", "Yuvan Shankar Raja", "Ilaiyaraaja", "Anirudh Ravichander", "G.V. Prakash Kumar"],
  "a. r. rahman": ["Harris Jayaraj", "Yuvan Shankar Raja", "Ilaiyaraaja", "Anirudh Ravichander", "G.V. Prakash Kumar"],
  "yuvan shankar raja": ["Harris Jayaraj", "Anirudh Ravichander", "D. Imman", "Santhosh Narayanan"],
  "ilaiyaraaja": ["SP Balasubrahmanyam", "M.S. Viswanathan", "K.J. Yesudas", "Deva"],
  "pradeep kumar": ["Sean Roldan", "Santhosh Narayanan", "Sid Sriram", "Govind Vasantha"],
  "santhosh narayanan": ["Sean Roldan", "Pradeep Kumar", "Anirudh Ravichander", "Yuvan Shankar Raja"],
  // English / Global
  "the weeknd": ["Post Malone", "Bruno Mars", "Dua Lipa", "Drake", "Kendrick Lamar"],
  "taylor swift": ["Olivia Rodrigo", "Billie Eilish", "Sabrina Carpenter", "Ariana Grande", "Lana Del Rey"],
  "coldplay": ["Imagine Dragons", "OneRepublic", "Maroon 5", "The Script", "Bastille"],
  "ed sheeran": ["Shawn Mendes", "Charlie Puth", "Lewis Capaldi", "James Arthur", "Sam Smith"],
  "billie eilish": ["Finneas", "Lorde", "Olivia Rodrigo", "Girl in Red", "Conan Gray"],
  "post malone": ["The Weeknd", "Swae Lee", "Juice WRLD", "Khalid", "Travis Scott"],
  "bruno mars": ["Anderson .Paak", "The Weeknd", "Charlie Puth", "Mark Ronson", "Justin Timberlake"],
};

interface CacheEntry {
  artists: string[];
  expiresAt: number;
}

const relatedArtistsCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Find musical peers and related artists for a given artist name.
 * Uses Deezer Related Artists API when available with an in-memory TTL cache,
 * and seamlessly falls back to our curated regional artist graph.
 */
export async function getRelatedArtists(artistName: string, limit = 5): Promise<string[]> {
  const norm = artistName.toLowerCase().trim();
  if (!norm) return [];

  // Check TTL cache
  const cached = relatedArtistsCache.get(norm);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.artists.slice(0, limit);
  }

  // 1. Try Deezer Search -> Related Artists
  try {
    const searchUrl = `https://api.deezer.com/search/artist?q=${encodeURIComponent(artistName)}&limit=1`;
    const searchRes = await fetch(searchUrl, {
      headers: { "User-Agent": "MelodyMap/1.0" },
      signal: AbortSignal.timeout(4000),
    });

    if (searchRes.ok) {
      const searchBody = (await searchRes.json()) as { data?: Array<{ id: number; name: string }> };
      const artistId = searchBody?.data?.[0]?.id;

      if (artistId) {
        const relatedUrl = `https://api.deezer.com/artist/${artistId}/related?limit=${limit + 2}`;
        const relatedRes = await fetch(relatedUrl, {
          headers: { "User-Agent": "MelodyMap/1.0" },
          signal: AbortSignal.timeout(4000),
        });

        if (relatedRes.ok) {
          const relatedBody = (await relatedRes.json()) as { data?: Array<{ name: string }> };
          const names = (relatedBody?.data ?? [])
            .map((a) => a.name?.trim())
            .filter((n): n is string => Boolean(n) && n.toLowerCase() !== norm);

          if (names.length > 0) {
            const finalPicks = names.slice(0, limit);
            relatedArtistsCache.set(norm, {
              artists: finalPicks,
              expiresAt: Date.now() + CACHE_TTL_MS,
            });
            return finalPicks;
          }
        }
      }
    }
  } catch {
    // Non-blocking Deezer error: fall through to regional graph
  }

  // 2. Fallback to regional artist graph
  const fallback = REGIONAL_ARTIST_GRAPH[norm] || [];
  if (fallback.length > 0) {
    const finalFallback = fallback.slice(0, limit);
    relatedArtistsCache.set(norm, {
      artists: finalFallback,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return finalFallback;
  }

  return [];
}
