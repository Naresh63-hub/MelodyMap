/**
 * Internet Archive Music Provider
 * Searches legitimate public domain recordings, live music archive, and historical audio collections.
 *
 * API Docs: https://archive.org/advancedsearch.php
 */

import type { UnifiedTrack, ProviderSearchOptions } from "./types";

interface ArchiveDoc {
  identifier: string;
  title?: string;
  creator?: string;
  year?: string;
  date?: string;
  length?: string;
}

interface ArchiveResponse {
  response: {
    docs: ArchiveDoc[];
    numFound: number;
  };
}

function parseArchiveDuration(raw?: string): number {
  if (!raw) return 180;
  // If formatted as HH:MM:SS or MM:SS
  if (raw.includes(":")) {
    const parts = raw.split(":").map(Number);
    if (parts.length === 3) return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
    if (parts.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
  }
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : 180;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export async function searchInternetArchive(
  query: string,
  options: ProviderSearchOptions = {},
): Promise<UnifiedTrack[]> {
  const clean = query.trim();
  if (!clean) return [];

  const limit = options.limit ?? 10;
  const qStr = `mediatype:(audio) AND (${clean}) AND format:(MP3 OR VBR MP3)`;
  const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(qStr)}&fl[]=identifier,title,creator,year,date,length&rows=${limit}&output=json`;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "MelodyMap/1.0",
      },
      signal: options.signal ?? AbortSignal.timeout(6000),
    });

    if (!res.ok) return [];

    const body = (await res.json()) as ArchiveResponse;
    if (!Array.isArray(body?.response?.docs)) return [];

    return body.response.docs
      .filter((doc) => doc.identifier && doc.title)
      .map((doc) => {
        const durSec = parseArchiveDuration(doc.length);
        // Ensure duration conforms to standard cap
        const safeDuration = durSec > 0 && durSec <= 600 ? Math.round(durSec) : 180;

        const streamUrl = `https://archive.org/download/${encodeURIComponent(doc.identifier)}/${encodeURIComponent(doc.identifier)}_vbr.mp3`;
        const artwork = `https://archive.org/services/img/${encodeURIComponent(doc.identifier)}`;

        return {
          id: `archive:${doc.identifier}`,
          canonicalTrackId: `archive:${doc.identifier}`,
          title: doc.title || "Archive Recording",
          artist: doc.creator || "Live Music Archive",
          album: doc.year ? `Live (${doc.year})` : "Internet Archive",
          duration: formatDuration(safeDuration),
          durationSeconds: safeDuration,
          thumbnail: artwork,
          artwork,
          year: doc.year,
          provider: "archive" as const,
          providerTrackId: doc.identifier,
          playable: true,
          playbackSource: {
            provider: "archive" as const,
            providerTrackId: doc.identifier,
            url: streamUrl,
            type: "full" as const,
            format: "mp3",
          },
          availableAlternatives: [],
          previewUrl: streamUrl,
          source: "archive" as const,
        };
      })
      .filter((t) => t.durationSeconds > 0 && t.durationSeconds <= 600);
  } catch {
    return [];
  }
}
