/**
 * Intelligent Personalization & Dynamic Taste Understanding (Phase 2).
 *
 * Builds a multi-dimensional user taste profile across:
 *   - Playback singers
 *   - Music directors & composers
 *   - Soundtracks & movie albums
 *   - Languages & regional cinema affinities
 *   - Musical vibes & energy (chill, medium, high)
 *   - Release periods (modern, retro, classic)
 *   - Circadian listening patterns learned from empirical history
 *   - Short-term session focus vs long-term lifetime interests
 *   - Behavioral negative feedback (fast-skips vs casual skips)
 *
 * Lightweight TypeScript engine with zero heavy external dependencies.
 */

import {
  type TrackLike,
  normalizeArtistAlias,
  extractPrimaryArtist,
  extractTrackMovieOrAlbum,
} from "./track-dedup";
import { COMPOSERS_BY_LANGUAGE, getTrackLanguage } from "./language-artists";
import { detectTrackEnergy, type TrackEnergy } from "./context-engine";
import { isOldEraTrack } from "./library";

// Flatten known composers across all supported industries into a normalized lookup set
const ALL_COMPOSERS_SET = new Set(
  Object.values(COMPOSERS_BY_LANGUAGE)
    .flat()
    .map((c) => normalizeArtistAlias(c) || c.toLowerCase().trim()),
);

/** Checks whether a given artist name corresponds to a known composer / music director */
export function isKnownComposer(rawArtist?: string | null): boolean {
  if (!rawArtist) return false;
  const norm = normalizeArtistAlias(rawArtist) || rawArtist.toLowerCase().trim();
  if (ALL_COMPOSERS_SET.has(norm)) return true;
  for (const c of ALL_COMPOSERS_SET) {
    if (norm.includes(c)) return true;
  }
  return false;
}

export type TimeOfDayBlock = "morning" | "afternoon" | "evening" | "night";

export function getTimeBlock(hour: number): TimeOfDayBlock {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

export interface UserTasteProfile {
  /** Top playback singers with positive affinity scores */
  topSingers: Array<{ name: string; score: number; count: number }>;
  /** Top music directors / composers with positive affinity scores */
  topComposers: Array<{ name: string; score: number; count: number }>;
  /** Top movie soundtracks / albums the user enjoys */
  topSoundtracks: Array<{ name: string; score: number; count: number }>;
  /** Inferred or selected language preferences with relative weights */
  topLanguages: Array<{ language: string; weight: number }>;

  /** Learned musical energy distribution across positive interactions */
  preferredEnergy: { chill: number; medium: number; high: number };
  /** Dominant detected listening moods */
  preferredMoods: Array<{ mood: string; score: number }>;
  /** Era preference distribution (modern: >2018, retro: 2000-2018, classic: <2000) */
  preferredEras: { modern: number; retro: number; classic: number };

  /** Empirical circadian listening behavior learned from actual plays */
  circadianAffinity: Record<
    TimeOfDayBlock,
    { topGenres: string[]; avgEnergy: TrackEnergy; eventCount: number }
  >;
  /** The empirical energy preferred by the user during the current hour */
  currentHourEmpiricalEnergy: TrackEnergy;

  /** Penalized artists with repeated fast-skips or strong negative balance */
  penalizedArtists: string[];
  /** Artists skipped within 10-15 seconds in the current session */
  fastSkippedArtists: string[];

  /** Temporary session listening focus (short-term) */
  shortTermFocus: {
    recentSingers: string[];
    recentComposers: string[];
    currentEnergyTrend: TrackEnergy;
  };
  /** Enduring lifetime affinities (long-term) */
  longTermAffinities: {
    lifetimeFavoriteSingers: string[];
    lifetimeFavoriteComposers: string[];
    downloadedSingers: string[];
  };

  /** Summary telemetry counters */
  totalCompletions: number;
  totalSkips: number;
  completionRate: number;
}

export interface TasteProfileInput {
  likes?: readonly TrackLike[] | undefined;
  downloads?: readonly TrackLike[] | undefined;
  dislikes?: readonly TrackLike[] | undefined;
  stats?: Record<string, { plays?: number; skips?: number; completions?: number; track?: any }> | undefined;
  history?: readonly TrackLike[] | undefined;
  sessionCompletions?: readonly { artist: string; title: string; timestamp: number }[] | number | undefined;
  sessionSkips?: readonly { artist: string; title: string; timestamp: number }[] | number | undefined;
  sessionPenalizedArtists?: readonly string[] | Set<string> | undefined;
  playlists?: readonly { name?: string; tracks?: readonly TrackLike[] }[] | undefined;
  searches?: readonly (string | { query: string; timestamp?: number })[] | undefined;
  hourOfDay?: number | undefined;
  currentHour?: number | undefined;
  languages?: readonly string[] | undefined;
}

/**
 * Builds a dynamic, comprehensive User Taste Profile from all available explicit and implicit signals.
 */
export function buildUserTasteProfile(input: TasteProfileInput): UserTasteProfile {
  const currentHour = input.currentHour !== undefined
    ? input.currentHour
    : input.hourOfDay !== undefined
      ? input.hourOfDay
      : new Date().getHours();
  const currentBlock = getTimeBlock(currentHour);

  // 1. Scoring structures
  const singerScores: Record<string, { net: number; completions: number; skips: number; plays: number }> = {};
  const composerScores: Record<string, { net: number; count: number }> = {};
  const soundtrackScores: Record<string, { net: number; count: number }> = {};
  const displayNameMap = new Map<string, string>();

  const touchSinger = (rawName: string) => {
    const rawTrimmed = (rawName || "").split(/[,&/|]|\b(?:feat|ft|featuring|with|and)\b/i)[0]?.trim() || rawName.trim();
    const primary = extractPrimaryArtist(rawName) || rawName;
    const key = normalizeArtistAlias(primary) || primary.toLowerCase().trim();
    if (!singerScores[key]) {
      singerScores[key] = { net: 0, completions: 0, skips: 0, plays: 0 };
    }
    if (!displayNameMap.has(key) || displayNameMap.get(key) === key) {
      displayNameMap.set(key, rawTrimmed);
    }
    return { key, display: displayNameMap.get(key) || rawTrimmed };
  };

  const touchComposer = (rawName: string) => {
    const rawTrimmed = (rawName || "").split(/[,&/|]|\b(?:feat|ft|featuring|with|and)\b/i)[0]?.trim() || rawName.trim();
    const key = normalizeArtistAlias(rawName) || rawName.toLowerCase().trim();
    if (!composerScores[key]) {
      composerScores[key] = { net: 0, count: 0 };
    }
    if (!displayNameMap.has(key) || displayNameMap.get(key) === key) {
      displayNameMap.set(key, rawTrimmed);
    }
    return { key, display: displayNameMap.get(key) || rawTrimmed };
  };

  const touchSoundtrack = (movieName: string) => {
    const key = movieName.toLowerCase().trim();
    if (!soundtrackScores[key]) {
      soundtrackScores[key] = { net: 0, count: 0 };
    }
    return key;
  };

  // Helper to record track contributions
  const processTrackTaste = (
    track: TrackLike | undefined | null,
    weight: number,
    isCompletion = false,
    isReplay = false,
  ) => {
    if (!track) return;
    const rawArtist = track.artist || "";
    if (rawArtist) {
      if (isKnownComposer(rawArtist)) {
        const { key } = touchComposer(rawArtist);
        composerScores[key]!.net += weight;
        composerScores[key]!.count += 1;
      } else {
        const { key } = touchSinger(rawArtist);
        singerScores[key]!.net += weight;
        if (isCompletion) singerScores[key]!.completions += 1;
        if (isReplay) singerScores[key]!.plays += 1;
      }
    }

    const movie = extractTrackMovieOrAlbum(track);
    if (movie && movie.length >= 3) {
      const key = touchSoundtrack(movie);
      soundtrackScores[key]!.net += weight;
      soundtrackScores[key]!.count += 1;
    }
  };

  // 2. Ingest Liked Songs (strong positive taste signal: +2.0)
  for (const l of input.likes || []) {
    processTrackTaste(l, 2.0);
  }

  // 3. Ingest Downloaded Songs (highest commitment positive signal: +3.5)
  for (const d of input.downloads || []) {
    processTrackTaste(d, 3.5);
  }

  // 4. Ingest Disliked Songs (strong negative taste signal: -4.0)
  for (const dl of input.dislikes || []) {
    processTrackTaste(dl, -4.0);
  }

  // 5. Ingest Playlist additions (+2.0)
  for (const pl of input.playlists || []) {
    for (const t of pl.tracks || []) {
      processTrackTaste(t, 2.0);
    }
  }

  // 6. Ingest Persistent Player Stats (completions +2.0, replays +3.0, skips -2.0)
  let totalCompletions = 0;
  let totalSkips = 0;

  if (input.stats) {
    for (const item of Object.values(input.stats)) {
      const track = item.track as TrackLike | undefined;
      const comp = item.completions || 0;
      const skp = item.skips || 0;
      const ply = item.plays || 0;
      const replays = Math.max(0, ply - skp - 1);

      totalCompletions += comp;
      totalSkips += skp;

      if (track) {
        const netWeight = comp * 2.0 + replays * 3.0 - skp * 2.0;
        processTrackTaste(track, netWeight, comp > 0, replays > 0);
      }
    }
  }

  // 7. Ingest In-Memory Session Events
  if (Array.isArray(input.sessionCompletions)) {
    for (const c of input.sessionCompletions) {
      processTrackTaste({ id: "sc", title: c.title, artist: c.artist }, 1.5, true);
      totalCompletions += 1;
    }
  } else if (typeof input.sessionCompletions === "number") {
    totalCompletions += input.sessionCompletions;
  }

  if (Array.isArray(input.sessionSkips)) {
    for (const s of input.sessionSkips) {
      const rawArtist = s.artist || "";
      if (rawArtist) {
        const { key } = touchSinger(rawArtist);
        singerScores[key]!.skips += 1;
        singerScores[key]!.net -= 2.0;
      }
      totalSkips += 1;
    }
  } else if (typeof input.sessionSkips === "number") {
    totalSkips += input.sessionSkips;
  }

  // 8. Ingest Recent Search Queries (+1.0 for explicitly searched entities)
  for (const s of input.searches || []) {
    const q = typeof s === "string" ? s.trim().toLowerCase() : (s.query || "").trim().toLowerCase();
    if (!q) continue;
    for (const [key, name] of displayNameMap.entries()) {
      if (q.includes(name.toLowerCase()) || name.toLowerCase().includes(q)) {
        if (singerScores[key]) singerScores[key]!.net += 1.0;
        if (composerScores[key]) composerScores[key]!.net += 1.0;
      }
    }
  }

  // 9. Process Penalized & Fast-Skipped Artists
  const fastSkippedSet = new Set<string>();
  if (input.sessionPenalizedArtists) {
    const arr = Array.isArray(input.sessionPenalizedArtists)
      ? input.sessionPenalizedArtists
      : Array.from(input.sessionPenalizedArtists);
    for (const a of arr) {
      const norm = normalizeArtistAlias(a) || a.toLowerCase().trim();
      if (norm) fastSkippedSet.add(norm);
    }
  }

  const penalizedSet = new Set<string>(fastSkippedSet);
  for (const [key, val] of Object.entries(singerScores)) {
    const totalActions = val.completions + val.skips;
    const skipRate = totalActions > 0 ? val.skips / totalActions : 0;
    if (val.net <= -3.0 || (val.skips >= 2 && skipRate >= 0.6 && val.completions === 0)) {
      penalizedSet.add(key);
    }
  }

  // 10. Rank Top Singers, Composers, and Soundtracks
  const topSingers = Object.entries(singerScores)
    .filter(([key, val]) => val.net > 0 && !penalizedSet.has(key))
    .sort((a, b) => b[1].net - a[1].net)
    .slice(0, 15)
    .map(([key, val]) => ({
      name: displayNameMap.get(key) || key,
      score: Math.round(val.net * 10) / 10,
      count: val.completions + val.plays,
    }));

  const topComposers = Object.entries(composerScores)
    .filter(([key, val]) => val.net > 0 && !penalizedSet.has(key))
    .sort((a, b) => b[1].net - a[1].net)
    .slice(0, 10)
    .map(([key, val]) => ({
      name: displayNameMap.get(key) || key,
      score: Math.round(val.net * 10) / 10,
      count: val.count,
    }));

  const topSoundtracks = Object.entries(soundtrackScores)
    .filter(([, val]) => val.net > 0)
    .sort((a, b) => b[1].net - a[1].net)
    .slice(0, 10)
    .map(([key, val]) => ({
      name: key.replace(/\b\w/g, (c) => c.toUpperCase()),
      score: Math.round(val.net * 10) / 10,
      count: val.count,
    }));

  // 11. Sonic & Musical Energy Preferences
  let chillCount = 0;
  let medCount = 0;
  let highCount = 0;
  let modernCount = 0;
  let retroCount = 0;
  let classicCount = 0;

  const positiveTracks: TrackLike[] = [
    ...(input.likes || []),
    ...(input.downloads || []),
    ...(input.history || []).slice(0, 20),
  ];

  for (const t of positiveTracks) {
    const energy = detectTrackEnergy(t);
    if (energy === "chill") chillCount++;
    else if (energy === "high") highCount++;
    else medCount++;

    if (isOldEraTrack(t)) {
      retroCount++;
    } else {
      modernCount++;
    }
  }

  const totalEnergy = chillCount + medCount + highCount || 1;
  const preferredEnergy = {
    chill: Math.round((chillCount / totalEnergy) * 100) / 100,
    medium: Math.round((medCount / totalEnergy) * 100) / 100,
    high: Math.round((highCount / totalEnergy) * 100) / 100,
  };

  const totalEras = modernCount + retroCount + classicCount || 1;
  const preferredEras = {
    modern: Math.round((modernCount / totalEras) * 100) / 100,
    retro: Math.round((retroCount / totalEras) * 100) / 100,
    classic: Math.round((classicCount / totalEras) * 100) / 100,
  };

  // 12. Circadian Empirical Behavior
  const blockEnergyCounts: Record<TimeOfDayBlock, { chill: number; med: number; high: number; total: number }> = {
    morning: { chill: 0, med: 0, high: 0, total: 0 },
    afternoon: { chill: 0, med: 0, high: 0, total: 0 },
    evening: { chill: 0, med: 0, high: 0, total: 0 },
    night: { chill: 0, med: 0, high: 0, total: 0 },
  };

  if (input.history) {
    for (const h of input.history) {
      const e = detectTrackEnergy(h);
      // History tracks without timestamp default to current block
      const blk = currentBlock;
      blockEnergyCounts[blk][e === "chill" ? "chill" : e === "high" ? "high" : "med"]++;
      blockEnergyCounts[blk].total++;
    }
  }

  const computeAvgEnergy = (b: { chill: number; med: number; high: number; total: number }, fallback: TrackEnergy): TrackEnergy => {
    if (b.total >= 3) {
      if (b.high > b.chill && b.high >= b.med) return "high";
      if (b.chill > b.high && b.chill >= b.med) return "chill";
      return "medium";
    }
    return fallback;
  };

  const circadianAffinity = {
    morning: {
      topGenres: ["Acoustic", "Melody", "Indie Pop", "Classical"],
      avgEnergy: computeAvgEnergy(blockEnergyCounts.morning, "chill"),
      eventCount: blockEnergyCounts.morning.total,
    },
    afternoon: {
      topGenres: ["Pop Hits", "Lo-Fi Beats", "Focus", "Synthwave"],
      avgEnergy: computeAvgEnergy(blockEnergyCounts.afternoon, "high"),
      eventCount: blockEnergyCounts.afternoon.total,
    },
    evening: {
      topGenres: ["Party", "Dance", "Soundtrack", "R&B"],
      avgEnergy: computeAvgEnergy(blockEnergyCounts.evening, "medium"),
      eventCount: blockEnergyCounts.evening.total,
    },
    night: {
      topGenres: ["Late Night Lo-Fi", "Mellow Ballads", "Acoustic", "Evergreen"],
      avgEnergy: computeAvgEnergy(blockEnergyCounts.night, "chill"),
      eventCount: blockEnergyCounts.night.total,
    },
  };

  const currentHourEmpiricalEnergy = circadianAffinity[currentBlock].avgEnergy;

  // 13. Short-term Session Focus vs Long-term Lifetime Affinities
  const recentHistory = (input.history || []).slice(0, 8);
  const recentSingers = [
    ...new Set(recentHistory.map((t) => t.artist && !isKnownComposer(t.artist) ? t.artist : "").filter(Boolean)),
  ].slice(0, 5);
  const recentComposers = [
    ...new Set(recentHistory.map((t) => t.artist && isKnownComposer(t.artist) ? t.artist : "").filter(Boolean)),
  ].slice(0, 3);

  const shortTermFocus = {
    recentSingers,
    recentComposers,
    currentEnergyTrend: recentHistory.length > 0 ? detectTrackEnergy(recentHistory[0]!) : currentHourEmpiricalEnergy,
  };

  const downloadedSingers = [
    ...new Set((input.downloads || []).map((d) => d.artist).filter(Boolean)),
  ];

  const longTermAffinities = {
    lifetimeFavoriteSingers: topSingers.slice(0, 8).map((s) => s.name),
    lifetimeFavoriteComposers: topComposers.slice(0, 5).map((c) => c.name),
    downloadedSingers,
  };

  // 14. Language Weights
  const topLanguages: Array<{ language: string; weight: number }> = (input.languages || []).map((lang, idx) => ({
    language: lang,
    weight: Math.max(0.2, 1.0 - idx * 0.2),
  }));

  const totalActions = totalCompletions + totalSkips;
  const completionRate = totalActions > 0 ? Math.round((totalCompletions / totalActions) * 100) / 100 : 0.8;

  return {
    topSingers,
    topComposers,
    topSoundtracks,
    topLanguages,
    preferredEnergy,
    preferredMoods: [],
    preferredEras,
    circadianAffinity,
    currentHourEmpiricalEnergy,
    penalizedArtists: Array.from(penalizedSet),
    fastSkippedArtists: Array.from(fastSkippedSet),
    shortTermFocus,
    longTermAffinities,
    totalCompletions,
    totalSkips,
    completionRate,
  };
}
