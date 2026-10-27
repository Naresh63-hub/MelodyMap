/**
 * Lightweight, bounded history of recently displayed track identities for Explore & Discovery.
 *
 * Persists up to 250 track identities in localStorage under:
 *   melodymap.explore_recent_seen.v1
 *
 * Uses FIFO eviction with deduplication so older songs gracefully decay and
 * can resurface in future sessions, without permanently hiding popular tracks.
 */

export const EXPLORE_RECENT_SEEN_KEY = "melodymap.explore_recent_seen.v1";
export const MAX_RECENT_SEEN_CAPACITY = 250;

export interface TrackIdentityInput {
  id?: string | null | undefined;
  title?: string | null | undefined;
  artist?: string | null | undefined;
}

/**
 * Normalizes text for fallback identity matching (lowercase, removes special chars & excess spaces).
 */
export function normalizeIdentityText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Computes a stable identity key for a track.
 * Prefers the provider ID if available, otherwise builds a normalized `title::artist` key.
 */
export function normalizeTrackIdentity(track: TrackIdentityInput | null | undefined): string | null {
  if (!track || typeof track !== "object") return null;

  const id = typeof track.id === "string" ? track.id.trim() : "";
  if (id) {
    return id.toLowerCase();
  }

  const title = normalizeIdentityText(track.title);
  const artist = normalizeIdentityText(track.artist);
  if (title) {
    return artist ? `${title}::${artist}` : title;
  }

  return null;
}

function getStorage(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
    if (typeof localStorage !== "undefined") {
      return localStorage;
    }
  } catch {}
  return null;
}

/**
 * Returns the array of recently seen track identities from localStorage.
 * Gracefully returns an empty array on server-side or if storage is inaccessible.
 */
export function getRecentlySeenIdentities(): string[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(EXPLORE_RECENT_SEEN_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string" && item.length > 0);
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Returns a Set of recently seen identities for fast O(1) lookups.
 */
export function getRecentlySeenSet(): Set<string> {
  return new Set(getRecentlySeenIdentities());
}

/**
 * Checks whether a track was recently seen, checking both ID and fallback normalized identity.
 */
export function isRecentlySeen(
  track: TrackIdentityInput | null | undefined,
  seenSet?: ReadonlySet<string>,
): boolean {
  if (!track) return false;
  const set = seenSet ?? getRecentlySeenSet();
  if (set.size === 0) return false;

  // 1. Direct ID check
  if (track.id && typeof track.id === "string") {
    if (set.has(track.id.trim().toLowerCase())) return true;
  }

  // 2. Normalized title::artist fallback check
  const fallback = normalizeTrackIdentity({ title: track.title, artist: track.artist });
  if (fallback && set.has(fallback)) {
    return true;
  }

  return false;
}

/**
 * Records newly displayed track identities into bounded history.
 * Appends new identities, removes duplicates (moving newly seen to the end),
 * and evicts oldest entries when exceeding MAX_RECENT_SEEN_CAPACITY.
 */
export function recordSeenTrackIdentities(
  tracks: readonly (TrackIdentityInput | null | undefined)[],
): void {
  if (!tracks || tracks.length === 0) return;
  const storage = getStorage();
  if (!storage) return;

  try {
    const currentList = getRecentlySeenIdentities();
    const existingSet = new Set(currentList);
    const newItems: string[] = [];

    for (const t of tracks) {
      if (!t) continue;
      // Record primary ID
      if (t.id && typeof t.id === "string" && t.id.trim()) {
        const idKey = t.id.trim().toLowerCase();
        if (!existingSet.has(idKey)) {
          existingSet.add(idKey);
          newItems.push(idKey);
        }
      }
      // Also record title::artist fallback to catch re-uploads across providers
      const fallbackKey = normalizeTrackIdentity({ title: t.title, artist: t.artist });
      if (fallbackKey && !existingSet.has(fallbackKey)) {
        existingSet.add(fallbackKey);
        newItems.push(fallbackKey);
      }
    }

    if (newItems.length === 0) return;

    // Combine and slice to maximum capacity (FIFO eviction: keep newest entries)
    const combined = [...currentList, ...newItems];
    const bounded = combined.length > MAX_RECENT_SEEN_CAPACITY
      ? combined.slice(combined.length - MAX_RECENT_SEEN_CAPACITY)
      : combined;

    storage.setItem(EXPLORE_RECENT_SEEN_KEY, JSON.stringify(bounded));
  } catch {
    // Storage quota or permissions error — gracefully continue without breaking app
  }
}

/**
 * Clears recently seen history. Primarily for testing and settings reset.
 */
export function clearRecentlySeenHistory(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(EXPLORE_RECENT_SEEN_KEY);
  } catch {}
}
