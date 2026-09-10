/**
 * Startup migration: safely deduplicate existing data created by previous
 * versions. Runs once per app version and is idempotent.
 */

import { dedupeTracks } from "@/lib/track-dedup";
import type { Track } from "@/lib/library";

const MIGRATION_KEY = "melodymap.migration.v1";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota exceeded — ignore
  }
}

type Playlist = {
  id: string;
  name: string;
  tracks: Track[];
  createdAt: number;
};

/**
 * Run all startup migrations. Safe to call multiple times — only runs
 * once per browser session thanks to a versioned migration flag.
 */
export function runStartupMigrations(): void {
  if (typeof window === "undefined") return;

  const migrated = read<string[]>(MIGRATION_KEY, []);
  if (migrated.includes("dedup-v1")) return;

  try {
    deduplicateTrackArray("melodymap.likes.v1");
    deduplicateTrackArray("melodymap.dislikes.v1");
    deduplicateTrackArray("melodymap.history.v1");
    deduplicatePlaylists("melodymap.playlists.v1");
  } catch (err) {
    console.warn("[MelodyMap] Startup migration failed:", err);
  }

  // Mark as done
  write(MIGRATION_KEY, [...migrated, "dedup-v1"]);
}

/** Deduplicate a Track[] stored in localStorage. */
function deduplicateTrackArray(key: string) {
  const tracks = read<Track[]>(key, []);
  if (!Array.isArray(tracks) || tracks.length === 0) return;
  const deduped = dedupeTracks(tracks);
  if (deduped.length < tracks.length) {
    console.info(`[MelodyMap] Deduped "${key}": ${tracks.length} → ${deduped.length} tracks`);
    write(key, deduped);
  }
}

/** Deduplicate tracks within each playlist. */
function deduplicatePlaylists(key: string) {
  const playlists = read<Playlist[]>(key, []);
  if (!Array.isArray(playlists) || playlists.length === 0) return;
  let changed = false;
  const fixed = playlists.map((p) => {
    if (!Array.isArray(p.tracks) || p.tracks.length === 0) return p;
    const deduped = dedupeTracks(p.tracks);
    if (deduped.length < p.tracks.length) {
      changed = true;
      return { ...p, tracks: deduped };
    }
    return p;
  });
  if (changed) {
    console.info(`[MelodyMap] Deduped playlists in "${key}"`);
    write(key, fixed);
  }
}
