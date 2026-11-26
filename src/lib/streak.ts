import { safeStorage } from "./safe-storage";

const STREAK_KEY = "melodymap-listening-streak";
const LAST_LISTEN_DATE_KEY = "melodymap-last-listen-date";
const MIN_LISTENING_MINUTES = 15;
const MIN_TRACKS_PER_DAY = 3;

export interface StreakData {
  currentStreak: number;
  lastListenDate: string | null;
  longestStreak: number;
  totalDays: number;
  totalMinutes?: number;
  totalTracks?: number;
  storiesCompleted?: number;
  nightSessions?: number;
  usedEqualizer?: boolean;
  unlockedBadgeIds?: string[];
}

export interface ListenerBadge {
  id: string;
  title: string;
  description: string;
  iconName: "crown" | "flame" | "moon" | "book" | "headphones" | "zap" | "star" | "sparkles";
  tier: "bronze" | "silver" | "gold" | "platinum" | "legendary";
  gradient: string;
  category: "streak" | "listener" | "stories" | "audiophile" | "explorer";
  unlocked: boolean;
  progressPercent: number; // 0 to 100
  progressLabel: string;
}

export function recordListeningSession(
  minutes: number,
  tracksCount: number,
  options?: {
    isStory?: boolean;
    isNightSession?: boolean;
    usedEqualizer?: boolean;
  },
): void {
  const streakData = getStreakData();

  // Accumulate total listening stats regardless of minimum threshold
  streakData.totalMinutes = (streakData.totalMinutes || 0) + Math.max(0, minutes);
  streakData.totalTracks = (streakData.totalTracks || 0) + Math.max(0, tracksCount);

  if (options?.isStory) {
    streakData.storiesCompleted = (streakData.storiesCompleted || 0) + 1;
  }

  const hour = new Date().getHours();
  if (options?.isNightSession || hour >= 23 || hour < 4) {
    streakData.nightSessions = (streakData.nightSessions || 0) + 1;
  }

  if (options?.usedEqualizer) {
    streakData.usedEqualizer = true;
  }

  if (minutes >= MIN_LISTENING_MINUTES && tracksCount >= MIN_TRACKS_PER_DAY) {
    const today = new Date().toDateString();
    const lastDate = safeStorage.getItem(LAST_LISTEN_DATE_KEY);

    if (lastDate !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayString = yesterday.toDateString();

      if (lastDate === yesterdayString) {
        // Consecutive day, increment streak
        streakData.currentStreak += 1;
        streakData.totalDays += 1;
      } else {
        // Streak broken or first day
        streakData.currentStreak = 1;
        streakData.totalDays += 1;
      }

      if (streakData.currentStreak > streakData.longestStreak) {
        streakData.longestStreak = streakData.currentStreak;
      }

      safeStorage.setItem(LAST_LISTEN_DATE_KEY, today);
    }
  }

  // Evaluate badges
  const evaluatedBadges = evaluateUserBadges(streakData);
  streakData.unlockedBadgeIds = evaluatedBadges
    .filter((b) => b.unlocked)
    .map((b) => b.id);

  saveStreakData(streakData);
}

export function getStreakData(): StreakData {
  try {
    const streakStr = safeStorage.getItem(STREAK_KEY);
    if (streakStr) {
      const parsed = JSON.parse(streakStr);
      return {
        currentStreak: parsed.currentStreak || 0,
        lastListenDate: parsed.lastListenDate || safeStorage.getItem(LAST_LISTEN_DATE_KEY),
        longestStreak: parsed.longestStreak || 0,
        totalDays: parsed.totalDays || 0,
        totalMinutes: parsed.totalMinutes || 0,
        totalTracks: parsed.totalTracks || 0,
        storiesCompleted: parsed.storiesCompleted || 0,
        nightSessions: parsed.nightSessions || 0,
        usedEqualizer: parsed.usedEqualizer || false,
        unlockedBadgeIds: parsed.unlockedBadgeIds || [],
      };
    }
  } catch (e) {
    console.error("Error reading streak data:", e);
  }

  return {
    currentStreak: 0,
    lastListenDate: safeStorage.getItem(LAST_LISTEN_DATE_KEY),
    longestStreak: 0,
    totalDays: 0,
    totalMinutes: 0,
    totalTracks: 0,
    storiesCompleted: 0,
    nightSessions: 0,
    usedEqualizer: false,
    unlockedBadgeIds: [],
  };
}

function saveStreakData(data: StreakData): void {
  try {
    safeStorage.setItem(STREAK_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Error saving streak data:", e);
  }
}

/**
 * Calculates user's top listener percentile rank based on engagement.
 * e.g. 1 means "Top 1% Listener"
 */
export function getTopListenerPercentile(data: StreakData = getStreakData()): {
  percentile: number;
  label: string;
  badgeTitle: string;
} {
  const totalMins = data.totalMinutes || 0;
  const streak = data.currentStreak || 0;
  const totalDays = data.totalDays || 0;
  const tracks = data.totalTracks || 0;

  if (totalMins >= 180 || streak >= 5 || totalDays >= 7 || tracks >= 40) {
    return { percentile: 1, label: "Top 1% Listener", badgeTitle: "Elite Music Pioneer" };
  }
  if (totalMins >= 90 || streak >= 3 || totalDays >= 4 || tracks >= 20) {
    return { percentile: 5, label: "Top 5% Listener", badgeTitle: "Superfan Listener" };
  }
  if (totalMins >= 45 || streak >= 2 || totalDays >= 2 || tracks >= 10) {
    return { percentile: 10, label: "Top 10% Listener", badgeTitle: "Active Audiophile" };
  }
  if (totalMins >= 15 || streak >= 1 || tracks >= 3) {
    return { percentile: 25, label: "Top 25% Listener", badgeTitle: "Passionate Explorer" };
  }
  return { percentile: 50, label: "Top 50% Listener", badgeTitle: "Melody Enthusiast" };
}

/**
 * Evaluates all achievable badges against the current user's listening profile.
 */
export function evaluateUserBadges(data: StreakData = getStreakData()): ListenerBadge[] {
  const streak = data.currentStreak || 0;
  const totalMins = data.totalMinutes || 0;
  const totalTracks = data.totalTracks || 0;
  const stories = data.storiesCompleted || 0;
  const night = data.nightSessions || 0;
  const eq = !!data.usedEqualizer;

  const top1Percentile = getTopListenerPercentile(data).percentile === 1;

  const badges: ListenerBadge[] = [
    {
      id: "top-1-percent",
      title: "Top 1% Listener",
      description: "Ranked among the top 1% most engaged listeners on MelodyMap.",
      iconName: "crown",
      tier: "legendary",
      gradient: "from-amber-400 via-yellow-500 to-amber-600",
      category: "listener",
      unlocked: top1Percentile,
      progressPercent: Math.min(100, Math.round(((totalMins / 180) * 0.5 + (streak / 5) * 0.5) * 100)),
      progressLabel: top1Percentile ? "Unlocked" : `${Math.round(totalMins)}/180 mins or 5-day streak`,
    },
    {
      id: "streak-fire-7",
      title: "7-Day Fire Streak",
      description: "Kept your listening streak burning for 7 consecutive days.",
      iconName: "flame",
      tier: "bronze",
      gradient: "from-orange-500 to-red-600",
      category: "streak",
      unlocked: streak >= 7 || data.longestStreak >= 7,
      progressPercent: Math.min(100, Math.round((Math.max(streak, data.longestStreak) / 7) * 100)),
      progressLabel: streak >= 7 ? "Unlocked" : `${streak}/7 days`,
    },
    {
      id: "streak-gold-30",
      title: "30-Day Legend Streak",
      description: "A full month of continuous musical dedication and daily vibes.",
      iconName: "flame",
      tier: "gold",
      gradient: "from-amber-500 to-yellow-600",
      category: "streak",
      unlocked: streak >= 30 || data.longestStreak >= 30,
      progressPercent: Math.min(100, Math.round((Math.max(streak, data.longestStreak) / 30) * 100)),
      progressLabel: streak >= 30 ? "Unlocked" : `${streak}/30 days`,
    },
    {
      id: "story-connoisseur",
      title: "Kuku Story Connoisseur",
      description: "Explored 3 or more chapters of immersive audio dramas and stories.",
      iconName: "book",
      tier: "silver",
      gradient: "from-purple-500 to-indigo-600",
      category: "stories",
      unlocked: stories >= 3,
      progressPercent: Math.min(100, Math.round((stories / 3) * 100)),
      progressLabel: stories >= 3 ? "Unlocked" : `${stories}/3 chapters`,
    },
    {
      id: "midnight-dreamer",
      title: "Midnight Dreamer",
      description: "Listened past midnight to late night lo-fi, chill, or suspense.",
      iconName: "moon",
      tier: "silver",
      gradient: "from-blue-600 to-indigo-900",
      category: "explorer",
      unlocked: night >= 1,
      progressPercent: night >= 1 ? 100 : 0,
      progressLabel: night >= 1 ? "Unlocked" : "Listen between 11 PM & 4 AM",
    },
    {
      id: "studio-audiophile",
      title: "Studio Audiophile",
      description: "Enhanced your soundstage with the 10-band Web Audio Equalizer or 3D Spatial Audio.",
      iconName: "headphones",
      tier: "gold",
      gradient: "from-emerald-400 to-teal-600",
      category: "audiophile",
      unlocked: eq,
      progressPercent: eq ? 100 : 0,
      progressLabel: eq ? "Unlocked" : "Tune Equalizer or Spatial presets",
    },
    {
      id: "music-marathoner",
      title: "Music Marathoner",
      description: "Completed over 25 tracks across your listening journeys.",
      iconName: "zap",
      tier: "platinum",
      gradient: "from-cyan-400 to-blue-600",
      category: "listener",
      unlocked: totalTracks >= 25,
      progressPercent: Math.min(100, Math.round((totalTracks / 25) * 100)),
      progressLabel: totalTracks >= 25 ? "Unlocked" : `${totalTracks}/25 tracks`,
    },
    {
      id: "soulful-devotee",
      title: "Sacred & Soulful",
      description: "Immersed in sacred epics like Mahabharata or Sampoorna Ramayanam.",
      iconName: "sparkles",
      tier: "silver",
      gradient: "from-rose-400 to-pink-600",
      category: "stories",
      unlocked: stories >= 1,
      progressPercent: stories >= 1 ? 100 : 0,
      progressLabel: stories >= 1 ? "Unlocked" : "Play an Epic or Mythology story",
    },
  ];

  return badges;
}

export function getStreakBadge(): { badge: string; color: string; label: string } | null {
  const streak = getStreakData().currentStreak;

  if (streak === 0) return null;

  if (streak >= 365) return { badge: "Platinum", color: "#E5E4E2", label: "365d Platinum" };
  if (streak >= 100) return { badge: "Gold", color: "#FFD700", label: "100d Gold" };
  if (streak >= 30) return { badge: "Silver", color: "#C0C0C0", label: "30d Silver" };
  if (streak >= 7) return { badge: "Bronze", color: "#CD7F32", label: "7d Bronze" };

  return { badge: "Fire", color: "#FF6B35", label: `${streak}d Streak` };
}
