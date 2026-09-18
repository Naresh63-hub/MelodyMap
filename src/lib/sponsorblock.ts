/**
 * SponsorBlock API client for auto-skipping intros, outros, sponsor segments,
 * and non-music portions in YouTube tracks and music videos.
 */

export interface SponsorBlockSegment {
  category: "sponsor" | "intro" | "outro" | "selfpromo" | "music_offtopic" | string;
  start: number;
  end: number;
}

const cache = new Map<string, { segments: SponsorBlockSegment[]; expiresAt: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

const SPONSORBLOCK_STORAGE_KEY = "melodymap:sponsorblock_enabled";

export function getSponsorBlockEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const val = localStorage.getItem(SPONSORBLOCK_STORAGE_KEY);
    return val === null ? true : val === "true";
  } catch {
    return true;
  }
}

export function setSponsorBlockEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SPONSORBLOCK_STORAGE_KEY, String(enabled));
  } catch {}
}

/**
 * Fetches skip segments for a given YouTube video ID.
 * Returns an array of start/end ranges.
 */
export async function fetchSponsorBlockSegments(
  videoId: string,
): Promise<SponsorBlockSegment[]> {
  if (!videoId || videoId.startsWith("dz_") || videoId.length < 5) {
    return [];
  }

  const cached = cache.get(videoId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.segments;
  }

  try {
    const categories = JSON.stringify([
      "sponsor",
      "intro",
      "outro",
      "selfpromo",
      "music_offtopic",
    ]);
    const url = `https://sponsor.ajay.app/api/skipSegments?videoID=${encodeURIComponent(
      videoId,
    )}&categories=${encodeURIComponent(categories)}`;

    const res = await fetch(url, { method: "GET" });
    if (res.status === 404) {
      cache.set(videoId, { segments: [], expiresAt: Date.now() + CACHE_TTL_MS });
      return [];
    }

    if (!res.ok) {
      return [];
    }

    const data = (await res.json()) as Array<{
      category: string;
      segment: [number, number];
    }>;

    if (!Array.isArray(data)) return [];

    const segments: SponsorBlockSegment[] = data
      .filter((item) => item.segment && item.segment.length === 2)
      .map((item) => ({
        category: item.category,
        start: Number(item.segment[0]),
        end: Number(item.segment[1]),
      }))
      .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start);

    cache.set(videoId, { segments, expiresAt: Date.now() + CACHE_TTL_MS });
    return segments;
  } catch (err) {
    console.warn("[SponsorBlock] Fetch error:", err);
    return [];
  }
}

/**
 * Check if the given current time is inside any skip segment.
 * If so, returns the target timestamp to seek to (end of segment).
 */
export function findSkipTarget(
  currentTime: number,
  segments: SponsorBlockSegment[],
): { target: number; category: string } | null {
  if (!segments || segments.length === 0) return null;

  for (const seg of segments) {
    // If we are currently within the segment (with 0.1s threshold to avoid re-trigger loops)
    if (currentTime >= seg.start - 0.05 && currentTime < seg.end - 0.2) {
      return { target: seg.end + 0.1, category: seg.category };
    }
  }

  return null;
}
