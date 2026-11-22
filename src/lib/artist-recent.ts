import { safeStorage } from "./safe-storage";
import type { PlaybackTelemetryEvent } from "./telemetry";

export interface ArtistRecentRecord {
  updatedAt: number;
  outcomes: boolean[]; // true = skip/negative, false = completion/positive
}

export type ArtistRecentStore = Record<string, ArtistRecentRecord>;

const STORAGE_KEY = "melodymap.artist_recent.v1";
const MAX_ARTISTS = 200;
const MAX_OUTCOMES_PER_ARTIST = 10;

export function normalizeArtistName(raw?: string | null): string {
  if (!raw) return "";
  const first = raw.split(/[,&/]|[\(\[]|\bfeat\b|\bft\b|\bfeaturing\b/i)[0] || "";
  return first.trim().toLowerCase();
}

function loadStore(): ArtistRecentStore {
  try {
    const raw = safeStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as ArtistRecentStore;
    }
    return {};
  } catch {
    return {};
  }
}

function saveStore(store: ArtistRecentStore): void {
  try {
    const keys = Object.keys(store);
    if (keys.length > MAX_ARTISTS) {
      keys.sort((a, b) => (store[a]?.updatedAt ?? 0) - (store[b]?.updatedAt ?? 0));
      const excess = keys.length - MAX_ARTISTS;
      for (let i = 0; i < excess; i++) {
        const key = keys[i];
        if (key) delete store[key];
      }
    }
    safeStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // best-effort
  }
}

export function recordArtistTerminalOutcome(artist: string | null | undefined, isSkip: boolean): void {
  const norm = normalizeArtistName(artist);
  if (!norm) return;

  const store = loadStore();
  const record = store[norm] ?? { updatedAt: Date.now(), outcomes: [] };
  record.updatedAt = Date.now();
  record.outcomes.push(isSkip);
  if (record.outcomes.length > MAX_OUTCOMES_PER_ARTIST) {
    record.outcomes = record.outcomes.slice(-MAX_OUTCOMES_PER_ARTIST);
  }
  store[norm] = record;
  saveStore(store);
}

export function getArtistRecentSkipHealth(artist: string | null | undefined): number {
  const norm = normalizeArtistName(artist);
  if (!norm) return 1.0;

  const store = loadStore();
  const record = store[norm];
  if (!record || !record.outcomes || record.outcomes.length === 0) {
    return 1.0;
  }

  const recentSkips = record.outcomes.filter((s) => s === true).length;
  const recentPlays = record.outcomes.length;
  const health = 1.0 - recentSkips / (recentPlays + 1);
  return Math.max(0.0, Math.min(1.0, health));
}

export function recordArtistTelemetryEvent(event: PlaybackTelemetryEvent): void {
  if (!event.artist) return;
  let isSkip: boolean | null = null;
  if (event.eventType === "COMPLETED" || event.eventType === "LIKED") {
    isSkip = false;
  } else if (event.eventType === "DISLIKED") {
    isSkip = true;
  } else if (event.eventType === "SKIPPED") {
    if (event.positionSeconds < 10) {
      isSkip = true;
    } else {
      isSkip = false;
    }
  }
  if (isSkip !== null) {
    recordArtistTerminalOutcome(event.artist, isSkip);
  }
}

export function clearArtistRecentStore(): void {
  try {
    safeStorage.removeItem(STORAGE_KEY);
  } catch {
    // best-effort
  }
}
