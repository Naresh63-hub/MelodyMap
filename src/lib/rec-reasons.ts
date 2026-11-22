import type { SessionContext } from "./bandit-policy";
import { getTrackLanguage } from "./language-artists";
import { detectTrackEnergy } from "./context-engine";
import { normalizeArtistName } from "./artist-recent";

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

  // 1. "Because you liked {artist}" — verified against likedTracks
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

  // 3. "Trending in {language}" — only if source is trending and language is identified
  if (source === "trending") {
    const lang = getTrackLanguage(track);
    if (lang) {
      return `Trending in ${lang}`;
    }
  }

  // 4. "Late night chill" — only if hour is 22-4 and energy is chill
  const hour = ctx?.hourOfDay !== undefined ? ctx.hourOfDay : new Date().getHours();
  const isLateNight = hour >= 22 || hour <= 4;
  if (isLateNight && detectTrackEnergy({ title: track.title, artist: track.artist || "" }) === "chill") {
    return "Late night chill";
  }

  return undefined;
}
