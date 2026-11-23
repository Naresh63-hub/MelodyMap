import type { SessionContext } from "./bandit-policy";
import { getTrackLanguage } from "./language-artists";
import { detectTrackEnergy, calculateMoodCompatibility } from "./context-engine";
import { normalizeArtistName } from "./artist-recent";
import { isKnownComposer } from "./taste-profile";
import { extractTrackMovieOrAlbum } from "./track-dedup";

export interface ReasonTrackLike {
  id?: string | undefined;
  title?: string | undefined;
  artist?: string | undefined;
  album?: string | undefined;
  languageCode?: string | undefined;
  language?: string | undefined;
  recommendationReason?: string | undefined;
}

/**
 * Returns an explanatory reason for why a track was recommended ONLY when
 * grounded in truthful, verified evidence. Never invents an ungrounded reason.
 */
export function explainPick(
  track?: ReasonTrackLike | null,
  ctx?: SessionContext | null,
  source?: string | null,
): string | undefined {
  if (!track || !track.title) return undefined;

  const trackArtistNorm = normalizeArtistName(track.artist);
  const trackMovie = extractTrackMovieOrAlbum(track);

  // 1. "Because you liked {artist}" — verified against liked playback singers/artists
  if (trackArtistNorm && ctx?.likedTracks && ctx.likedTracks.length > 0) {
    const matchedLiked = ctx.likedTracks.find(
      (lt) => lt.artist && normalizeArtistName(lt.artist) === trackArtistNorm,
    );
    if (matchedLiked?.artist) {
      const displayArtist = track.artist?.split(/[,&/]/)[0]?.trim() || matchedLiked.artist;
      return `Because you liked ${displayArtist}`;
    }
  }

  // 2. "From your downloaded artist {artist}" — verified against downloadedTracks
  if (trackArtistNorm && ctx?.downloadedTracks && ctx.downloadedTracks.length > 0) {
    const matchedDownload = ctx.downloadedTracks.find(
      (dt) => dt.artist && normalizeArtistName(dt.artist) === trackArtistNorm,
    );
    if (matchedDownload?.artist) {
      const displayArtist = track.artist?.split(/[,&/]/)[0]?.trim() || matchedDownload.artist;
      return `From your downloaded artist ${displayArtist}`;
    }
  }

  // 3. "Similar to your downloaded songs" — soundtrack match with user's offline downloads
  if (trackMovie && ctx?.downloadedTracks && ctx.downloadedTracks.length > 0) {
    const downloadMovieMatch = ctx.downloadedTracks.some(
      (dt) => extractTrackMovieOrAlbum(dt) === trackMovie,
    );
    if (downloadMovieMatch) {
      return "Similar to your downloaded songs";
    }
  }

  // 4. "From a composer you enjoy" — verified against known composers in taste profile or liked catalog
  if (track.artist && isKnownComposer(track.artist)) {
    const compKey = trackArtistNorm;
    const composerInLikes = ctx?.likedTracks?.some(
      (lt) => lt.artist && normalizeArtistName(lt.artist) === compKey,
    );
    const composerInTop = ctx?.tasteProfile?.topComposers?.some(
      (tc) => normalizeArtistName(tc.name) === compKey,
    );
    if (composerInLikes || composerInTop) {
      return "From a composer you enjoy";
    }
  }

  // 5. "From your favorite soundtrack" — verified against top soundtracks in taste profile
  if (trackMovie && ctx?.tasteProfile?.topSoundtracks) {
    const isTopSoundtrack = ctx.tasteProfile.topSoundtracks.some(
      (st) => st.name.toLowerCase().trim() === trackMovie,
    );
    if (isTopSoundtrack) {
      return "From your favorite soundtrack";
    }
  }

  // 6. "Discover a new singer" — when explicitly exploring new artists or discover source
  if (source === "discover" || source === "new-singer") {
    return "Discover a new singer";
  }

  // 6. "Based on your listening mood" — only when user selected an active mood and track matches
  if (ctx?.activeMood) {
    const energy = detectTrackEnergy({ title: track.title, artist: track.artist || "" });
    const candidateText = `${track.title || ""} ${track.artist || ""}`;
    let moodScore = calculateMoodCompatibility(ctx.activeMood, energy, candidateText);
    if (moodScore < 0.7) {
      // Check individual mood tokens (e.g. "Late Night Chill" -> "chill", "late night")
      const lower = ctx.activeMood.toLowerCase().trim();
      const candidates = [lower, ...lower.split(/\s+/)];
      for (const cand of candidates) {
        if (cand.length >= 3) {
          const score = calculateMoodCompatibility(cand, energy, candidateText);
          if (score >= 0.7) {
            moodScore = score;
            break;
          }
        }
      }
    }
    if (moodScore >= 0.7) {
      return "Based on your listening mood";
    }
  }

  // 7. "Trending in {language}" — only if source is trending and language is identified
  if (source === "trending") {
    const lang = getTrackLanguage(track);
    if (lang) {
      return `Trending in ${lang}`;
    }
  }

  // 8. "Late night chill" — only if hour is 22-4 and energy is chill
  const hour = ctx?.hourOfDay !== undefined ? ctx.hourOfDay : new Date().getHours();
  const isLateNight = hour >= 22 || hour <= 4;
  if (isLateNight && detectTrackEnergy({ title: track.title, artist: track.artist || "" }) === "chill") {
    return "Late night chill";
  }

  return undefined;
}
