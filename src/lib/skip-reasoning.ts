// Simple skip reasoning based on playback patterns
// This provides feedback to users about why tracks might be skipped

type SkipReason = 
  | "too_similar"
  | "mood_mismatch"
  | "artist_fatigue"
  | "duration_too_long"
  | "low_energy"
  | null;

interface SkipContext {
  previousTrackId?: string;
  currentArtist?: string;
  recentArtists: string[];
  currentDuration?: number;
  skipPosition?: number; // position when skipped
  currentMood?: string;
}

export function analyzeSkipReason(context: SkipContext): SkipReason {
  const { previousTrackId, currentArtist, recentArtists, currentDuration, skipPosition, currentMood } = context;

  // Check if skipped very early (first 10 seconds)
  if (skipPosition !== undefined && skipPosition < 10) {
    return "low_energy";
  }

  // Check if duration is too long (>8 minutes)
  if (currentDuration && currentDuration > 480) {
    return "duration_too_long";
  }

  // Check artist fatigue (artist played recently)
  if (currentArtist && recentArtists.includes(currentArtist)) {
    return "artist_fatigue";
  }

  // Check if same artist as previous track
  if (previousTrackId && currentArtist) {
    // This would need more context to check artist of previous track
    // For now, skip this check
  }

  // Mood mismatch (would need mood detection - simplified here)
  if (currentMood && currentMood === "energetic" && skipPosition !== undefined && skipPosition < 30) {
    return "mood_mismatch";
  }

  return null;
}

export function getSkipReasonMessage(reason: SkipReason): string {
  switch (reason) {
    case "too_similar":
      return "Too similar to previous track";
    case "mood_mismatch":
      return "Mood doesn't match current time";
    case "artist_fatigue":
      return "Artist played too recently";
    case "duration_too_long":
      return "Duration too long for current context";
    case "low_energy":
      return "Track didn't grab attention";
    default:
      return "";
  }
}
