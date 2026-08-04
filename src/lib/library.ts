import { useCallback, useEffect, useState } from "react";

export type Track = {
  id: string;
  title: string;
  artist: string;
  duration: string;
  thumbnail: string;
  reason?: string;
};

const LIKES_KEY = "vinyl.likes.v1";
const HISTORY_KEY = "vinyl.history.v1";

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
    /* storage full or blocked */
  }
}

export function useLibrary() {
  const [hydrated, setHydrated] = useState(false);
  const [likes, setLikes] = useState<Track[]>([]);
  const [history, setHistory] = useState<Track[]>([]);

  useEffect(() => {
    setLikes(read<Track[]>(LIKES_KEY, []));
    setHistory(read<Track[]>(HISTORY_KEY, []));
    setHydrated(true);
  }, []);

  const toggleLike = useCallback((track: Track) => {
    setLikes((prev) => {
      const next = prev.some((t) => t.id === track.id)
        ? prev.filter((t) => t.id !== track.id)
        : [track, ...prev].slice(0, 200);
      write(LIKES_KEY, next);
      return next;
    });
  }, []);

  const logPlay = useCallback((track: Track) => {
    setHistory((prev) => {
      const next = [track, ...prev.filter((t) => t.id !== track.id)].slice(0, 100);
      write(HISTORY_KEY, next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    write(HISTORY_KEY, []);
  }, []);

  return { hydrated, likes, history, toggleLike, logPlay, clearHistory };
}

export function trackLabel(track: Track) {
  return `${track.title} — ${track.artist}`;
}
