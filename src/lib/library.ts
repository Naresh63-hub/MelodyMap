import { useCallback, useEffect, useRef, useState } from "react";
import type { PlaybackSource } from "@/lib/providers/types";
import { inferLanguageFromArtists } from "./language-artists";

export type Track = {
  id: string;
  title: string;
  artist: string;
  duration: string;
  thumbnail: string;
  reason?: string | undefined;
  /** Direct audio URL (e.g. Audius stream, Jamendo MP3, Archive, podcast) — bypasses stream proxy. */
  previewUrl?: string | undefined;
  /** Source provider */
  source?: "youtube" | "deezer" | "audius" | "jamendo" | "archive" | "podcast" | "multi" | undefined;
  album?: string | undefined;
  year?: string | undefined;
  canonicalTrackId?: string | undefined;
  provider?: string | undefined;
  providerTrackId?: string | undefined;
  playable?: boolean | undefined;
  playbackSource?: PlaybackSource | undefined;
  availableAlternatives?: PlaybackSource[] | undefined;
  recordingId?: string | undefined;
  isrc?: string | undefined;
  isExplicit?: boolean | undefined;
  durationSeconds?: number | undefined;
  languageCode?: string | undefined;
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
  "Bengali",
  "Marathi",
  "Gujarati",
  "Bhojpuri",
  "Urdu",
  "Japanese",
] as const;

export const PODCAST_TOPICS = [
  "Tech",
  "Cinema",
  "History",
  "Motivation",
  "Business",
  "Science",
  "Health",
  "Comedy",
  "True Crime",
  "Sports",
  "News",
  "Finance",
  "Psychology",
  "Travel",
] as const;

/** Popular artists/singers by language, for quick picking on login & in settings. */
export const SUGGESTED_ARTISTS = [
  // Hindi / Bollywood
  "Arijit Singh",
  "Shreya Ghoshal",
  "Atif Aslam",
  "Kishore Kumar",
  "Lata Mangeshkar",
  "Neha Kakkar",
  "Badshah",
  "Jubin Nautiyal",
  // Telugu
  "Sid Sriram",
  "S. P. Balasubrahmanyam",
  "Shreya Ghoshal",
  "Anirudh Ravichander",
  "Armaan Malik",
  // Tamil
  "A. R. Rahman",
  "Anirudh Ravichander",
  "Ilaiyaraaja",
  "S. Janaki",
  "Sid Sriram",
  // Malayalam
  "K. J. Yesudas",
  "Vineeth Sreenivasan",
  "Shreya Ghoshal",
  // Kannada
  "S. P. Balasubrahmanyam",
  "Vijay Prakash",
  "Armaan Malik",
  // Punjabi
  "Diljit Dosanjh",
  "Sidhu Moose Wala",
  "Karan Aujla",
  "Arijit Singh",
  // English / International
  "Taylor Swift",
  "Ed Sheeran",
  "Adele",
  "Coldplay",
  "Billie Eilish",
  "The Weeknd",
  // Korean
  "BTS",
  "BLACKPINK",
  "NewJeans",
  "IU",
  // Spanish
  "Bad Bunny",
  "Shakira",
  "Rosalía",
  // Arabic
  "Amr Diab",
  "Nancy Ajram",
  "Fairuz",
] as const;

export type RecSettings = {
  moods: Record<string, number>; // 0-100 weighting per mood
  genres: string[];
  languages: string[];
  /** Favorite artists/singers — drives language-based song picks. */
  artists: string[];
  podcastTopics: string[]; // topics the podcast mix should chase
  injectInterval: number; // insert a fresh release into the queue every N songs (0 = off)
  notifyNewDrops: boolean; // browser notification when a favourite artist drops a song
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
  artists: [],
  podcastTopics: [],
  injectInterval: 5,
  notifyNewDrops: false,
  discovery: 40,
  energy: 50,
  instrumentalOnly: false,
};

const LIKES_KEY = "melodymap.likes.v1";
const DISLIKES_KEY = "melodymap.dislikes.v1";
const HISTORY_KEY = "melodymap.history.v1";
const PODCAST_HISTORY_KEY = "melodymap.podcast_history.v1";
const PLAYLISTS_KEY = "melodymap.playlists.v1";
export const SETTINGS_KEY = "melodymap.recsettings.v1";
const STATS_KEY = "melodymap.stats.v1";

import {
  isMusicTrack,
  isPodcastTrack,
  parseDurationSeconds,
  parseDurationSeconds as parseDurationSecs,
  NON_MUSIC_KEYWORDS,
  COMPILATION_KEYWORDS,
  JUNK_MEDIA_KEYWORDS,
  PODCAST_POSITIVE_KEYWORDS,
} from "./track-filters";

export {
  isMusicTrack,
  isPodcastTrack,
  parseDurationSeconds,
  parseDurationSecs,
  NON_MUSIC_KEYWORDS,
  COMPILATION_KEYWORDS,
  JUNK_MEDIA_KEYWORDS,
  PODCAST_POSITIVE_KEYWORDS,
};

/** Behavioural signal per song: how often it's replayed vs skipped, and when. */
export type PlayStat = {

  track: Track;
  plays: number;
  skips: number;
  completions: number;
  lastAt: number;
};

export type Stats = Record<string, PlayStat>;

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch (err) {
    console.warn(`[MelodyMap] Failed to read "${key}" from localStorage:`, err);
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`[MelodyMap] Failed to write "${key}" to localStorage (quota?):`, err);
  }
}

function uid(): string {
  return crypto.randomUUID();
}

const PLAYBACK_KEY = "melodymap.playback.v1";

export type SavedPlayback = {
  queue: Track[];
  index: number;
  position: number;
  isPlaying?: boolean;
};

/** Last queue + seek position, so reopening the app resumes where you left off. */
export function readPlayback(): SavedPlayback | null {
  const saved = read<SavedPlayback | null>(PLAYBACK_KEY, null);
  if (!saved || !Array.isArray(saved.queue) || saved.queue.length === 0) return null;
  const validQueue = saved.queue.filter(
    (t) => t && typeof t.id === "string" && t.id.trim().length > 0 && t.id !== "undefined",
  );
  if (validQueue.length === 0) return null;
  return {
    ...saved,
    queue: validQueue,
    index: Math.min(Math.max(0, saved.index || 0), validQueue.length - 1),
  };
}

export function writePlayback(value: SavedPlayback) {
  write(PLAYBACK_KEY, { ...value, queue: value.queue.slice(0, 100) });
}


const EPISODE_KEY = "melodymap.episodePositions.v1";

export type EpisodePosition = {
  position: number;
  duration: number;
  updatedAt: number;
};

/** Per-episode listening positions, so a podcast can offer to resume. */
export function readEpisodePositions(): Record<string, EpisodePosition> {
  const saved = read<Record<string, EpisodePosition> | null>(EPISODE_KEY, null);
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
  return saved;
}

export function writeEpisodePosition(videoId: string, position: number, duration: number) {
  // Never delete here — a track loaded but not yet played reports position 0,
  // and we don't want that wiping a saved spot. Clear via clearEpisodePosition.
  if (position <= 5 || duration <= 0) return;
  const all = readEpisodePositions();
  all[videoId] = { position, duration, updatedAt: Date.now() };
  write(EPISODE_KEY, all);
}

export function clearEpisodePosition(videoId: string) {
  const all = readEpisodePositions();
  delete all[videoId];
  write(EPISODE_KEY, all);
}


import type { BanditModelState } from "./bandit-policy";

type LibraryDoc = {
  likes: Track[];
  dislikes: Track[];
  history: Track[];
  podcastHistory?: Track[];
  playlists: Playlist[];
  settings: RecSettings;
  stats?: Stats;
  banditModel?: BanditModelState;
  telemetryEvents?: any[];
  playback?: SavedPlayback;
};

function mergeStats(a: Stats, b: Stats): Stats {
  const out: Stats = { ...a };
  for (const [id, s] of Object.entries(b)) {
    const prev = out[id];
    out[id] = prev
      ? {
          track: prev.track,
          plays: Math.max(prev.plays, s.plays),
          skips: Math.max(prev.skips, s.skips),
          completions: Math.max(prev.completions, s.completions),
          lastAt: Math.max(prev.lastAt, s.lastAt),
        }
      : s;
  }
  return out;
}


function mergeById<T extends { id: string }>(a: T[], b: T[], max: number): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of [...a, ...b]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out.slice(0, max);
}

import { areSameTrack, trackExistsIn } from "@/lib/track-dedup";
import type { TrackLike } from "@/lib/track-dedup";

/**
 * Local-first library. When a listener is signed in, the same data syncs to
 * their account so the feed follows them to any device.
 */
export function useLibrary(userId?: string | null) {
  const [hydrated, setHydrated] = useState(false);
  const [likes, setLikes] = useState<Track[]>([]);
  const [dislikes, setDislikes] = useState<Track[]>([]);
  const [history, setHistory] = useState<Track[]>([]);
  const [podcastHistory, setPodcastHistory] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [settings, setSettings] = useState<RecSettings>(DEFAULT_SETTINGS);
  const [stats, setStats] = useState<Stats>({});
  const [syncedUser, setSyncedUser] = useState<string | null>(null);
  const pullingRef = useRef(false);

  useEffect(() => {
    // 1. Sanitize likes: keep only pure music tracks without deleting unformatted tracks
    const rawLikes = read<Track[]>(LIKES_KEY, []);
    const musicLikes = rawLikes.filter((t) => isMusicTrack(t, true, true));
    setLikes(musicLikes);
    if (musicLikes.length !== rawLikes.length) {
      write(LIKES_KEY, musicLikes);
    }

    setDislikes(read<Track[]>(DISLIKES_KEY, []));

    // 2. Sanitize history: split into music vs podcast history
    const rawHistory = read<Track[]>(HISTORY_KEY, []);
    const musicHistory = rawHistory.filter((t) => isMusicTrack(t, true, true));
    const extractedPodcasts = rawHistory.filter(isPodcastTrack);

    const rawPodcastHistory = read<Track[]>(PODCAST_HISTORY_KEY, []);
    const combinedPodcasts = mergeById(rawPodcastHistory, extractedPodcasts, 200);

    setHistory(musicHistory);
    setPodcastHistory(combinedPodcasts);

    write(HISTORY_KEY, musicHistory);
    write(PODCAST_HISTORY_KEY, combinedPodcasts);

    setPlaylists(read<Playlist[]>(PLAYLISTS_KEY, []));
    setSettings({ ...DEFAULT_SETTINGS, ...read<Partial<RecSettings>>(SETTINGS_KEY, {}) });
    setStats(read<Stats>(STATS_KEY, {}));
    setHydrated(true);
  }, []);


  /** Pull the account copy once per sign-in and merge it with what's on device. */
  useEffect(() => {
    if (!hydrated || !userId || syncedUser === userId || pullingRef.current) return;
    pullingRef.current = true;
    let cancelled = false;

    void (async () => {
      try {
        const { supabase } = await import("@/lib/supabase");
        const { data, error } = await supabase
          .from("user_library")
          .select("data")
          .eq("user_id", userId)
          .maybeSingle();

        if (cancelled) return;

        if (data?.data && !error) {
          const docData = data.data as Partial<LibraryDoc>;
          setLikes((prev) => {
            const next = mergeById((docData.likes ?? []).filter((t) => isMusicTrack(t, true, true)), prev, 200);
            write(LIKES_KEY, next);
            return next;
          });
          setDislikes((prev) => {
            const next = mergeById(docData.dislikes ?? [], prev, 200);
            write(DISLIKES_KEY, next);
            return next;
          });
          setHistory((prev) => {
            const next = mergeById(prev, (docData.history ?? []).filter((t) => isMusicTrack(t, true, true)), 200);
            write(HISTORY_KEY, next);
            return next;
          });
          if (docData.podcastHistory) {
            setPodcastHistory((prev) => {
              const next = mergeById(prev, docData.podcastHistory ?? [], 200);
              write(PODCAST_HISTORY_KEY, next);
              return next;
            });
          }
          setPlaylists((prev) => {
            const next = mergeById(docData.playlists ?? [], prev, 200);
            write(PLAYLISTS_KEY, next);
            return next;
          });
          if (docData.stats) {
            setStats((prev) => {
              const next = mergeStats(prev, docData.stats ?? {});
              write(STATS_KEY, next);
              return next;
            });
          }
          if (docData.settings) {
            const next = { ...DEFAULT_SETTINGS, ...docData.settings };
            setSettings(next);
            write(SETTINGS_KEY, next);
          }
          if (docData.banditModel) {
            try {
              const { thompsonSamplingPolicy } = await import("@/lib/bandit-policy");
              thompsonSamplingPolicy.setModelState(docData.banditModel);
            } catch {}
          }
          if (docData.playback && Array.isArray(docData.playback.queue) && docData.playback.queue.length > 0) {
            const currentPlayback = readPlayback();
            if (!currentPlayback || currentPlayback.queue.length === 0) {
              writePlayback(docData.playback);
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("melodymap:playback-synced"));
              }
            }
          }
        }
        // Mark synced only AFTER pull finishes and merges so push won't overwrite cloud data
        setSyncedUser(userId);
      } catch (err) {
        console.warn("[MelodyMap] Initial cloud pull error:", err);
        // Allow push on failure after attempt
        setSyncedUser(userId);
      } finally {
        pullingRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, userId, syncedUser]);

  useEffect(() => {
    if (!userId) {
      setSyncedUser(null);
    }
  }, [userId]);

  /** Push changes back to the account, debounced so typing/likes don't spam it. */
  useEffect(() => {
    if (!hydrated || !userId || syncedUser !== userId) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const { supabase } = await import("@/lib/supabase");
        const { thompsonSamplingPolicy } = await import("@/lib/bandit-policy");
        const { telemetry } = await import("@/lib/telemetry");
        if (cancelled) return;
        
        const banditModel = thompsonSamplingPolicy.getModelState();
        const recentTelemetry = telemetry.drainEvents(30);

        const { error } = await supabase.from("user_library").upsert({
          user_id: userId,
          data: {
            likes,
            dislikes,
            history: history.slice(0, 100),
            podcastHistory: podcastHistory.slice(0, 100),
            playlists,
            settings,
            stats,
            banditModel,
            telemetryEvents: recentTelemetry,
            playback: readPlayback() ?? null,
            updatedAt: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        });
        if (error) {
          console.warn("[MelodyMap] Library Supabase sync failed:", error.message);
        }
      } catch (err) {
        console.warn("[MelodyMap] Library Supabase sync error:", err);
      }
    }, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [hydrated, userId, syncedUser, likes, dislikes, history, podcastHistory, playlists, settings, stats]);



  const toggleLike = useCallback((track: Track) => {
    setDislikes((prev) => {
      const next = prev.filter((t) => !areSameTrack(t, track as TrackLike));
      write(DISLIKES_KEY, next);
      return next;
    });
    setLikes((prev) => {
      const next = trackExistsIn(prev, track as TrackLike)
        ? prev.filter((t) => !areSameTrack(t, track as TrackLike))
        : [track, ...prev].slice(0, 200);
      write(LIKES_KEY, next);
      return next;
    });
  }, []);

  /** Thumbs-down: removes from favourites and tells the AI to avoid this song. */
  const toggleDislike = useCallback((track: Track) => {
    setLikes((prev) => {
      const next = prev.filter((t) => !areSameTrack(t, track as TrackLike));
      write(LIKES_KEY, next);
      return next;
    });
    setDislikes((prev) => {
      const next = trackExistsIn(prev, track as TrackLike)
        ? prev.filter((t) => !areSameTrack(t, track as TrackLike))
        : [track, ...prev].slice(0, 200);
      write(DISLIKES_KEY, next);
      return next;
    });
  }, []);

  /** Bumps a song's behavioural counters (plays / skips / completions). */
  const bump = useCallback((track: Track, field: "plays" | "skips" | "completions") => {
    setStats((prev) => {
      const existing = prev[track.id];
      const entry: PlayStat = existing
        ? { ...existing, track, [field]: existing[field] + 1, lastAt: Date.now() }
        : { track, plays: 0, skips: 0, completions: 0, lastAt: Date.now(), [field]: 1 };
      const next = { ...prev, [track.id]: entry };

      // Cap to 200 most recent entries to prevent localStorage quota exhaustion
      const values = Object.values(next);
      if (values.length > 200) {
        values.sort((a, b) => b.lastAt - a.lastAt);
        const capped: Stats = {};
        for (const item of values.slice(0, 200)) {
          if (item.track?.id) capped[item.track.id] = item;
        }
        write(STATS_KEY, capped);
        return capped;
      }

      write(STATS_KEY, next);
      return next;
    });
  }, []);

  const logPlay = useCallback(
    (track: Track) => {
      if (isMusicTrack(track)) {
        setHistory((prev) => {
          const next = [track, ...prev.filter((t) => !areSameTrack(t, track as TrackLike))].slice(0, 200);
          write(HISTORY_KEY, next);
          return next;
        });
      } else {
        setPodcastHistory((prev) => {
          const next = [track, ...prev.filter((t) => !areSameTrack(t, track as TrackLike))].slice(0, 200);
          write(PODCAST_HISTORY_KEY, next);
          return next;
        });
      }
      bump(track, "plays");
    },
    [bump],
  );

  /** A song left early counts as a skip; one heard to the end counts as a completion. */
  const logSkip = useCallback((track: Track) => bump(track, "skips"), [bump]);
  const logComplete = useCallback((track: Track) => bump(track, "completions"), [bump]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    write(HISTORY_KEY, []);
  }, []);

  const clearPodcastHistory = useCallback(() => {
    setPodcastHistory([]);
    write(PODCAST_HISTORY_KEY, []);
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
          p.id === id && !trackExistsIn(p.tracks, track as TrackLike)
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
    podcastHistory,
    playlists,
    settings,
    stats,
    logSkip,
    logComplete,
    toggleLike,
    toggleDislike,

    logPlay,

    clearHistory,
    clearPodcastHistory,
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
    settings.languages.length
      ? `Only songs in these languages: ${settings.languages.join(", ")}.`
      : "",
    settings.artists.length
      ? `Favorite artists and singers: ${settings.artists.join(", ")}. Prioritize their songs.`
      : "",

    `Familiarity vs discovery: ${settings.discovery}% deep cuts, ${100 - settings.discovery}% familiar hits.`,
    `Energy level target: ${settings.energy}/100.`,
    settings.instrumentalOnly ? "Only instrumental tracks, no vocals." : "",
  ].filter(Boolean);

  return parts.join(" ");
}

const WEEKS_4 = 28 * 24 * 60 * 60 * 1000;

/** Replay Mix: songs you've had on repeat over the last few weeks. */
export function replayMix(stats: Stats, limit = 30): Track[] {
  const now = Date.now();
  return Object.values(stats)
    .filter((s) => now - s.lastAt < WEEKS_4 && s.plays + s.completions > 1)
    .sort((a, b) => {
      const score = (s: PlayStat) => s.plays * 2 + s.completions * 3 - s.skips * 2;
      return score(b) - score(a) || b.lastAt - a.lastAt;
    })
    .slice(0, limit)
    .map((s) => s.track);
}

/** Artists you actually listen to, ranked by plays then likes. */
export function topArtists(stats: Stats, likes: Track[], limit = 12): string[] {
  const score = new Map<string, number>();
  for (const s of Object.values(stats)) {
    const artist = s.track.artist;
    if (!artist) continue;
    score.set(artist, (score.get(artist) ?? 0) + s.plays + s.completions * 2 - s.skips);
  }
  for (const t of likes) {
    if (t.artist) score.set(t.artist, (score.get(t.artist) ?? 0) + 3);
  }
  return [...score.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([artist]) => artist);
}

/** Songs you keep skipping — a strong negative signal for the next picks. */
export function skippedLabels(stats: Stats, limit = 15): string[] {
  return Object.values(stats)
    .filter((s) => s.skips >= 2 && s.skips > s.completions)
    .sort((a, b) => b.skips - a.skips)
    .slice(0, limit)
    .map((s) => trackLabel(s.track));
}

/** Recent listening as an ordered sequence with the action taken on each track. */
export function sequenceBrief(history: Track[], stats: Stats, limit = 15): string[] {
  return history.slice(0, limit).map((t) => {
    const s = stats[t.id];
    const action = !s
      ? "played"
      : s.skips > s.completions
        ? "skipped"
        : s.plays > 1
          ? `replayed x${s.plays}`
          : "played";
    return `${trackLabel(t)} — ${action}`;
  });
}

export type LibraryBackup = {
  version: 1;
  exportedAt: number;
  likes: Track[];
  dislikes: Track[];
  history: Track[];
  podcastHistory: Track[];
  playlists: Playlist[];
  settings: RecSettings;
  stats: Stats;
};

/**
 * 1-Click Library Export: Serializes all user library data into a clean JSON backup.
 */
export function exportLibraryData(): string {
  if (typeof window === "undefined") return "{}";
  const data: LibraryBackup = {
    version: 1,
    exportedAt: Date.now(),
    likes: read<Track[]>(LIKES_KEY, []),
    dislikes: read<Track[]>(DISLIKES_KEY, []),
    history: read<Track[]>(HISTORY_KEY, []),
    podcastHistory: read<Track[]>(PODCAST_HISTORY_KEY, []),
    playlists: read<Playlist[]>(PLAYLISTS_KEY, []),
    settings: read<RecSettings>(SETTINGS_KEY, DEFAULT_SETTINGS),
    stats: read<Stats>(STATS_KEY, {}),
  };
  return JSON.stringify(data, null, 2);
}

/**
 * 1-Click Library Import: Restores user library data from a JSON backup.
 */
export function importLibraryData(jsonString: string): { success: boolean; error?: string } {
  if (typeof window === "undefined") return { success: false, error: "No window context" };
  try {
    const data = JSON.parse(jsonString) as Partial<LibraryBackup>;
    if (!data || typeof data !== "object") {
      return { success: false, error: "Invalid backup format" };
    }

    if (Array.isArray(data.likes)) write(LIKES_KEY, data.likes);
    if (Array.isArray(data.dislikes)) write(DISLIKES_KEY, data.dislikes);
    if (Array.isArray(data.history)) write(HISTORY_KEY, data.history);
    if (Array.isArray(data.podcastHistory)) write(PODCAST_HISTORY_KEY, data.podcastHistory);
    if (Array.isArray(data.playlists)) write(PLAYLISTS_KEY, data.playlists);
    if (data.settings && typeof data.settings === "object") write(SETTINGS_KEY, data.settings);
    if (data.stats && typeof data.stats === "object") write(STATS_KEY, data.stats);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Invalid JSON syntax" };
  }
}

/**
 * Language metadata for cross-script detection and regional music industry keywords.
 */
const LANGUAGE_PROFILES: Record<
  string,
  {
    script?: RegExp;
    industries?: string[];
  }
> = {
  telugu: {
    script: /[\u0C00-\u0C7F]/,
    industries: ["tollywood"],
  },
  tamil: {
    script: /[\u0B80-\u0BFF]/,
    industries: ["kollywood"],
  },
  hindi: {
    script: /[\u0900-\u097F]/,
    industries: ["bollywood"],
  },
  malayalam: {
    script: /[\u0D00-\u0D7F]/,
    industries: ["mollywood"],
  },
  kannada: {
    script: /[\u0C80-\u0CFF]/,
    industries: ["sandalwood"],
  },
  punjabi: {
    script: /[\u0A00-\u0A7F]/,
    industries: ["pollywood"],
  },
  bengali: {
    script: /[\u0980-\u09FF]/,
  },
  korean: {
    script: /[\uAC00-\uD7AF\u1100-\u11FF]/,
    industries: ["kpop", "k-pop"],
  },
  arabic: {
    script: /[\u0600-\u06FF]/,
  },
  marathi: {
    script: /[\u0900-\u097F]/,
  },
};

/**
 * Checks whether a track is consistent with the specified selected languages.
 * If a track explicitly advertises a different language (e.g. "(Hindi Version)",
 * conflicting regional film industry, or foreign script when that language is not selected),
 * this returns false to prevent language cross-contamination.
 */
export function isLanguageConsistent(
  track: { title?: string | undefined; artist?: string | undefined; languageCode?: string | undefined },
  selectedLanguages: string[],
): boolean {
  if (!selectedLanguages || selectedLanguages.length === 0) return true;

  const selectedSet = new Set(selectedLanguages.map((l) => l.trim().toLowerCase()));

  // 1. Explicit languageCode check
  if (track.languageCode) {
    const code = track.languageCode.trim().toLowerCase();
    const matchesAny = selectedLanguages.some(
      (l) => l.toLowerCase().startsWith(code) || code.startsWith(l.toLowerCase().slice(0, 2)),
    );
    if (!matchesAny && code !== "und" && code !== "zxx") {
      return false;
    }
  }

  const rawTitle = track.title || "";
  const rawArtist = track.artist || "";
  const rawCombined = `${rawTitle} ${rawArtist}`;
  const text = rawCombined.toLowerCase();

  // 2. Unicode script conflict checking
  // If text contains characters from a script corresponding to a language that is NOT selected,
  // reject the candidate.
  for (const [langName, profile] of Object.entries(LANGUAGE_PROFILES)) {
    if (profile.script && profile.script.test(rawCombined)) {
      if (!selectedSet.has(langName)) {
        // Special case: Hindi and Marathi share Devanagari script.
        if (langName === "marathi" && selectedSet.has("hindi")) {
          continue;
        }
        if (langName === "hindi" && selectedSet.has("marathi")) {
          continue;
        }
        return false;
      }
    }
  }

  // 3. Known regional language names and industry conflict checking
  const allKnownLanguages = [
    "hindi",
    "telugu",
    "tamil",
    "malayalam",
    "kannada",
    "punjabi",
    "bengali",
    "marathi",
    "gujarati",
    "bhojpuri",
    "korean",
    "spanish",
    "arabic",
  ];

  const conflictingLanguages = allKnownLanguages.filter((l) => !selectedSet.has(l));

  for (const conflict of conflictingLanguages) {
    // Check bracket tags: e.g. "(Hindi)", "[Tamil]", "(Hindi Version)"
    const bracketPattern = new RegExp(`[\\(\\[][^\\)\\]]*\\b${conflict}\\b[^\\)\\]]*[\\)\\]]`, "i");
    if (bracketPattern.test(text)) {
      return false;
    }

    // Check delimited tags: e.g. "| Hindi |", "- Hindi -", "/ Tamil /"
    const delimiterPattern = new RegExp(`[\\|\\-\\/\u2013\u2014]\\s*${conflict}\\s*[\\|\\-\\/\u2013\u2014]`, "i");
    if (delimiterPattern.test(text)) {
      return false;
    }

    // Check phrases like "Hindi Song", "Punjabi Songs", "in Hindi", "Telugu Lyrical"
    const phrasePattern = new RegExp(
      `\\b(${conflict}\\s+(song|songs|hits|version|dub|audio|video|jukebox|remix|mashup|lyric|lyrics|lyrical|mp3|movie|cinema)|in\\s+${conflict})\\b`,
      "i",
    );
    if (phrasePattern.test(text)) {
      return false;
    }

    // Check conflicting industry tags (e.g. "Bollywood" when Hindi is not selected)
    const profile = LANGUAGE_PROFILES[conflict];
    if (profile?.industries) {
      for (const industry of profile.industries) {
        const indPattern = new RegExp(`\\b${industry}\\b`, "i");
        if (indPattern.test(text)) {
          return false;
        }
      }
    }
  }

  // 4. Artist-based language detection: the artist map is the ONLY reliable
  // signal for romanized titles ("Kadhalin Deepam" has no Tamil script and no
  // language tag). A known artist tied to a non-selected language marks the
  // track as out-of-feed. Ambiguous multi-industry artists (playback singers
  // like Shreya Ghoshal or Arijit Singh) return null and are let through, so
  // cross-language legends are never wrongly rejected.
  const inferred = inferLanguageFromArtists(rawArtist);
  if (inferred && !selectedSet.has(inferred.toLowerCase())) {
    return false;
  }

  return true;
}

/**
 * Known modern artists and producers who debuted in the modern streaming era (2005+)
 * to strictly exclude from the Old Songs / Golden Era / Retro feed.
 */
const MODERN_BLOCKED_ARTISTS = [
  // South Indian Modern
  "sid sriram",
  "anirudh",
  "anirudh ravichander",
  "devi sri prasad",
  "thaman",
  "santhosh narayanan",
  "anurag kulkarni",
  "ram miriyala",
  "mangli",
  "hesham abdul",
  "sam c.s",
  "g.v. prakash",
  "hiphop tamizha",
  "sushin shyam",
  "dhee",
  "armaan malik",
  "jonita gandhi",
  "leon james",
  "vivek-mervin",
  // Hindi / Bollywood / Desi Modern
  "arijit singh",
  "neha kakkar",
  "badshah",
  "guru randhawa",
  "honey singh",
  "yo yo honey singh",
  "mc stan",
  "king",
  "raftaar",
  "divine",
  "jubin nautiyal",
  "darshan raval",
  "prateek kuhad",
  "jasleen royal",
  "tony kakkar",
  "dhvani bhanushali",
  "b praak",
  "jaani",
  "harrdy sandhu",
  "mika singh",
  "meet bros",
  "amal mallik",
  // Punjabi Modern
  "ap dhillon",
  "sidhu moose",
  "shubh",
  "karan aujla",
  "diljit dosanjh",
  "amrit maan",
  "jordan sandhu",
  // Western / International Modern
  "taylor swift",
  "justin bieber",
  "drake",
  "billie eilish",
  "olivia rodrigo",
  "dua lipa",
  "ariana grande",
  "the weeknd",
  "post malone",
  "bruno mars",
  "ed sheeran",
  "harry styles",
  "bts",
  "blackpink",
  "travis scott",
  "kendrick lamar",
  "imagine dragons",
  "shawn mendes",
  "selena gomez",
  "camila cabello",
  "doja cat",
  "charlie puth",
  "lil nas x",
  "miley cyrus",
  "alan walker",
  "marshmello",
  "chainsmokers",
  "david guetta",
  "calvin harris",
  "martin garrix",
];

const MODERN_TAGS = [
  "phonk",
  "speed up",
  "sped up",
  "slowed",
  "reverb",
  "drill",
  "trap mix",
  "edm",
  "club mix",
  "bass boosted",
  "lofi flip",
  "reels",
  "tiktok",
  "shorts",
  "dj remix",
];

/**
 * Validates that a track strictly belongs to the Golden Era / Vintage Retro Classics catalog.
 * Guarantees that contemporary songs, modern remixes, and post-2005 hits are filtered out.
 */
export function isOldEraTrack(track: {
  title?: string | undefined;
  artist?: string | undefined;
  album?: string | undefined;
  year?: string | number | undefined;
}): boolean {
  if (!track) return false;

  const title = (track.title || "").toLowerCase();
  const artist = (track.artist || "").toLowerCase();
  const text = `${title} ${artist}`;

  // 1. Strict Year validation
  if (track.year !== undefined && track.year !== null) {
    const parsed = parseInt(String(track.year).trim(), 10);
    if (!isNaN(parsed) && parsed >= 2005) {
      return false;
    }
  }

  // 2. Block modern artists
  for (const modern of MODERN_BLOCKED_ARTISTS) {
    if (artist.includes(modern) || title.includes(modern)) {
      return false;
    }
  }

  // 3. Block modern electronic / viral tags
  for (const tag of MODERN_TAGS) {
    if (title.includes(tag)) {
      return false;
    }
  }

  // 4. Reject explicit modern 4-digit years in title (2005-2029) unless qualified by vintage indicators
  const modernYearMatch = text.match(/\b20(0[5-9]|[12][0-9])\b/);
  if (modernYearMatch) {
    const vintageIndicators = [
      "remaster",
      "remastered",
      "restored",
      "50s",
      "60s",
      "70s",
      "80s",
      "90s",
      "195",
      "196",
      "197",
      "198",
      "199",
      "golden",
      "retro",
      "classic",
      "evergreen",
      "old",
    ];
    const hasVintageContext = vintageIndicators.some((kw) => text.includes(kw));
    if (!hasVintageContext) {
      return false;
    }
  }

  return true;
}



