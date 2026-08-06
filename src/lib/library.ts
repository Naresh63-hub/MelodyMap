import { useCallback, useEffect, useState } from "react";

export type Track = {
  id: string;
  title: string;
  artist: string;
  duration: string;
  thumbnail: string;
  reason?: string;
};

export type Playlist = {
  id: string;
  name: string;
  tracks: Track[];
  createdAt: number;
};

export const GENRES = [
  "Pop",
  "Hip-hop",
  "R&B",
  "Rock",
  "Indie",
  "Electronic",
  "Jazz",
  "Lo-fi",
  "Classical",
  "Desi / Bollywood",
  "Afrobeats",
  "Metal",
] as const;

export const LANGUAGES = [
  "Hindi",
  "Telugu",
  "Tamil",
  "Malayalam",
  "Kannada",
  "Punjabi",
  "English",
  "Korean",
  "Spanish",
  "Arabic",
] as const;

export type RecSettings = {
  moods: Record<string, number>; // 0-100 weighting per mood
  genres: string[];
  languages: string[];
  discovery: number; // 0 = familiar, 100 = deep cuts
  energy: number; // 0 = calm, 100 = high energy
  instrumentalOnly: boolean;
};

export const MOODS = [
  "late night",
  "upbeat workout",
  "focus",
  "sad hours",
  "throwbacks",
  "romantic",
  "happy",
  "party",
  "chill",
  "devotional",
] as const;

export const DEFAULT_SETTINGS: RecSettings = {
  moods: Object.fromEntries(MOODS.map((m) => [m, 50])),
  genres: [],
  languages: [],
  discovery: 40,
  energy: 50,
  instrumentalOnly: false,
};

const LIKES_KEY = "vinyl.likes.v1";
const DISLIKES_KEY = "vinyl.dislikes.v1";
const HISTORY_KEY = "vinyl.history.v1";
const PLAYLISTS_KEY = "vinyl.playlists.v1";
const SETTINGS_KEY = "vinyl.recsettings.v1";


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

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function useLibrary() {
  const [hydrated, setHydrated] = useState(false);
  const [likes, setLikes] = useState<Track[]>([]);
  const [dislikes, setDislikes] = useState<Track[]>([]);
  const [history, setHistory] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [settings, setSettings] = useState<RecSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    setLikes(read<Track[]>(LIKES_KEY, []));
    setDislikes(read<Track[]>(DISLIKES_KEY, []));
    setHistory(read<Track[]>(HISTORY_KEY, []));
    setPlaylists(read<Playlist[]>(PLAYLISTS_KEY, []));
    setSettings({ ...DEFAULT_SETTINGS, ...read<Partial<RecSettings>>(SETTINGS_KEY, {}) });
    setHydrated(true);
  }, []);

  const toggleLike = useCallback((track: Track) => {
    setDislikes((prev) => {
      const next = prev.filter((t) => t.id !== track.id);
      write(DISLIKES_KEY, next);
      return next;
    });
    setLikes((prev) => {
      const next = prev.some((t) => t.id === track.id)
        ? prev.filter((t) => t.id !== track.id)
        : [track, ...prev].slice(0, 200);
      write(LIKES_KEY, next);
      return next;
    });
  }, []);

  /** Thumbs-down: removes from favourites and tells the AI to avoid this song. */
  const toggleDislike = useCallback((track: Track) => {
    setLikes((prev) => {
      const next = prev.filter((t) => t.id !== track.id);
      write(LIKES_KEY, next);
      return next;
    });
    setDislikes((prev) => {
      const next = prev.some((t) => t.id === track.id)
        ? prev.filter((t) => t.id !== track.id)
        : [track, ...prev].slice(0, 200);
      write(DISLIKES_KEY, next);
      return next;
    });
  }, []);

  const logPlay = useCallback((track: Track) => {
    setHistory((prev) => {
      const next = [track, ...prev.filter((t) => t.id !== track.id)].slice(0, 200);
      write(HISTORY_KEY, next);
      return next;
    });
  }, []);



  const clearHistory = useCallback(() => {
    setHistory([]);
    write(HISTORY_KEY, []);
  }, []);

  const savePlaylists = useCallback((updater: (prev: Playlist[]) => Playlist[]) => {
    setPlaylists((prev) => {
      const next = updater(prev);
      write(PLAYLISTS_KEY, next);
      return next;
    });
  }, []);

  const createPlaylist = useCallback(
    (name: string, tracks: Track[] = []) => {
      const playlist: Playlist = { id: uid(), name, tracks, createdAt: Date.now() };
      savePlaylists((prev) => [playlist, ...prev]);
      return playlist;
    },
    [savePlaylists],
  );

  const renamePlaylist = useCallback(
    (id: string, name: string) =>
      savePlaylists((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p))),
    [savePlaylists],
  );

  const deletePlaylist = useCallback(
    (id: string) => savePlaylists((prev) => prev.filter((p) => p.id !== id)),
    [savePlaylists],
  );

  const addToPlaylist = useCallback(
    (id: string, track: Track) =>
      savePlaylists((prev) =>
        prev.map((p) =>
          p.id === id && !p.tracks.some((t) => t.id === track.id)
            ? { ...p, tracks: [...p.tracks, track] }
            : p,
        ),
      ),
    [savePlaylists],
  );

  const removeFromPlaylist = useCallback(
    (id: string, trackId: string) =>
      savePlaylists((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, tracks: p.tracks.filter((t) => t.id !== trackId) } : p,
        ),
      ),
    [savePlaylists],
  );

  const removeManyFromPlaylist = useCallback(
    (id: string, trackIds: string[]) =>
      savePlaylists((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, tracks: p.tracks.filter((t) => !trackIds.includes(t.id)) } : p,
        ),
      ),
    [savePlaylists],
  );

  /** Moves selected tracks from one playlist into another (no duplicates). */
  const moveTracksToPlaylist = useCallback(
    (fromId: string, toId: string, trackIds: string[]) =>
      savePlaylists((prev) => {
        const source = prev.find((p) => p.id === fromId);
        if (!source || fromId === toId) return prev;
        const moving = source.tracks.filter((t) => trackIds.includes(t.id));
        return prev.map((p) => {
          if (p.id === fromId)
            return { ...p, tracks: p.tracks.filter((t) => !trackIds.includes(t.id)) };
          if (p.id === toId) {
            const fresh = moving.filter((t) => !p.tracks.some((x) => x.id === t.id));
            return { ...p, tracks: [...p.tracks, ...fresh] };
          }
          return p;
        });
      }),
    [savePlaylists],
  );

  const reorderPlaylist = useCallback(
    (id: string, from: number, to: number) =>
      savePlaylists((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          const tracks = [...p.tracks];
          const [moved] = tracks.splice(from, 1);
          if (!moved) return p;
          tracks.splice(to, 0, moved);
          return { ...p, tracks };
        }),
      ),
    [savePlaylists],
  );

  const updateSettings = useCallback((patch: Partial<RecSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      write(SETTINGS_KEY, next);
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    write(SETTINGS_KEY, DEFAULT_SETTINGS);
  }, []);

  return {
    hydrated,
    likes,
    dislikes,
    history,
    playlists,
    settings,
    toggleLike,
    toggleDislike,
    logPlay,

    clearHistory,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
    addToPlaylist,
    removeFromPlaylist,
    removeManyFromPlaylist,
    moveTracksToPlaylist,
    reorderPlaylist,
    updateSettings,
    resetSettings,
  };
}

export function trackLabel(track: Track) {
  return `${track.title} — ${track.artist}`;
}

/** Turns the tuning panel state into a short natural-language brief for the AI. */
export function settingsToBrief(settings: RecSettings, extraMood?: string) {
  const moods = Object.entries(settings.moods)
    .filter(([, v]) => v >= 60)
    .sort((a, b) => b[1] - a[1])
    .map(([m, v]) => `${m} (${v}%)`);
  const avoid = Object.entries(settings.moods)
    .filter(([, v]) => v <= 20)
    .map(([m]) => m);

  const parts = [
    extraMood ? `Right now they want: ${extraMood}.` : "",
    moods.length ? `Lean into these moods: ${moods.join(", ")}.` : "",
    avoid.length ? `Avoid: ${avoid.join(", ")}.` : "",
    settings.genres.length ? `Preferred genres: ${settings.genres.join(", ")}.` : "",
    `Familiarity vs discovery: ${settings.discovery}% deep cuts, ${100 - settings.discovery}% familiar hits.`,
    `Energy level target: ${settings.energy}/100.`,
    settings.instrumentalOnly ? "Only instrumental tracks, no vocals." : "",
  ].filter(Boolean);

  return parts.join(" ");
}
