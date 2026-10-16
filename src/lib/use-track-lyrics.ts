import { useState, useEffect } from "react";
import { getTrackLyrics } from "./music.functions";
import type { LyricLine } from "./lyrics.server";

export type { LyricLine };

export type TrackLyricsState = {
  loading: boolean;
  syncedLyrics: LyricLine[];
  plainLyrics: string | null;
  isSynced: boolean;
  isInstrumental: boolean;
  source: string;
  error: string | null;
};

// Memory-bounded client cache for instant lyrics on replay/navigation
const clientLyricsCache = new Map<string, TrackLyricsState>();
const MAX_CLIENT_CACHE = 100;

function getCacheKey(title: string, artist: string, trackId?: string): string {
  return `${trackId || ""}:${title.trim().toLowerCase()}:${artist.trim().toLowerCase()}`;
}

export function useTrackLyrics(params: {
  title?: string | undefined;
  artist?: string | undefined;
  trackId?: string | undefined;
  duration?: number | undefined;
}) {
  const { title = "", artist = "", trackId, duration } = params;
  const cacheKey = getCacheKey(title, artist, trackId);

  const [state, setState] = useState<TrackLyricsState>(() => {
    if (!title) {
      return {
        loading: false,
        syncedLyrics: [],
        plainLyrics: null,
        isSynced: false,
        isInstrumental: false,
        source: "",
        error: null,
      };
    }
    const cached = clientLyricsCache.get(cacheKey);
    if (cached) return cached;
    return {
      loading: true,
      syncedLyrics: [],
      plainLyrics: null,
      isSynced: false,
      isInstrumental: false,
      source: "",
      error: null,
    };
  });

  useEffect(() => {
    if (!title) {
      setState({
        loading: false,
        syncedLyrics: [],
        plainLyrics: null,
        isSynced: false,
        isInstrumental: false,
        source: "",
        error: null,
      });
      return;
    }

    const cached = clientLyricsCache.get(cacheKey);
    if (cached) {
      setState(cached);
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    void getTrackLyrics({
      data: {
        title,
        artist,
        trackId,
        duration,
      },
    })
      .then((res) => {
        if (cancelled) return;
        if (res.lyrics) {
          const isInstrumental = Boolean(res.lyrics.instrumental);
          const isSynced = Boolean(res.lyrics.synced && res.lyrics.synced.length > 0);
          const newState: TrackLyricsState = {
            loading: false,
            syncedLyrics: res.lyrics.synced || [],
            plainLyrics: res.lyrics.plain || null,
            isSynced,
            isInstrumental,
            source: res.lyrics.source || "lrclib",
            error: null,
          };

          if (clientLyricsCache.size >= MAX_CLIENT_CACHE) {
            const firstKey = clientLyricsCache.keys().next().value;
            if (firstKey) clientLyricsCache.delete(firstKey);
          }
          clientLyricsCache.set(cacheKey, newState);
          setState(newState);
        } else {
          const emptyState: TrackLyricsState = {
            loading: false,
            syncedLyrics: [],
            plainLyrics: null,
            isSynced: false,
            isInstrumental: false,
            source: "",
            error: res.error || "Lyrics unavailable",
          };
          clientLyricsCache.set(cacheKey, emptyState);
          setState(emptyState);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          loading: false,
          syncedLyrics: [],
          plainLyrics: null,
          isSynced: false,
          isInstrumental: false,
          source: "",
          error: err?.message || "Failed to load lyrics",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, title, artist, trackId, duration]);

  return state;
}
