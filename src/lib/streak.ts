const STREAK_KEY = 'melodymap-listening-streak';
const LAST_LISTEN_DATE_KEY = 'melodymap-last-listen-date';
const MIN_LISTENING_MINUTES = 15;
const MIN_TRACKS_PER_DAY = 3;

export interface StreakData {
  currentStreak: number;
  lastListenDate: string | null;
  longestStreak: number;
  totalDays: number;
}

export function recordListeningSession(minutes: number, tracksCount: number): void {
  if (minutes < MIN_LISTENING_MINUTES || tracksCount < MIN_TRACKS_PER_DAY) {
    return; // Not enough to count as a session
  }

  if (typeof localStorage === 'undefined') return;

  const today = new Date().toDateString();
  const lastDate = localStorage.getItem(LAST_LISTEN_DATE_KEY);
  
  const streakData = getStreakData();
  
  if (lastDate === today) {
    // Already recorded today, no change
    return;
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayString = yesterday.toDateString();

  if (lastDate === yesterdayString) {
    // Consecutive day, increment streak
    streakData.currentStreak += 1;
    streakData.totalDays += 1;
  } else if (lastDate === null || lastDate !== today) {
    // Streak broken or first time
    streakData.currentStreak = 1;
    streakData.totalDays += 1;
  }

  // Update longest streak
  if (streakData.currentStreak > streakData.longestStreak) {
    streakData.longestStreak = streakData.currentStreak;
  }

  saveStreakData(streakData);
  localStorage.setItem(LAST_LISTEN_DATE_KEY, today);
}

export function getStreakData(): StreakData {
  if (typeof localStorage === 'undefined') {
    return {
      currentStreak: 0,
      lastListenDate: null,
      longestStreak: 0,
      totalDays: 0,
    };
  }
  
  try {
    const streakStr = localStorage.getItem(STREAK_KEY);
    if (streakStr) {
      return JSON.parse(streakStr);
    }
  } catch (e) {
    console.error('Error reading streak data:', e);
  }
  
  return {
    currentStreak: 0,
    lastListenDate: typeof localStorage !== 'undefined' ? localStorage.getItem(LAST_LISTEN_DATE_KEY) : null,
    longestStreak: 0,
    totalDays: 0,
  };
}

function saveStreakData(data: StreakData): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Error saving streak data:', e);
  }
}

export function getStreakBadge(): { badge: string; color: string } | null {
  const streak = getStreakData().currentStreak;
  
  if (streak === 0) return null;
  
  if (streak >= 365) return { badge: 'Platinum', color: '#E5E4E2' };
  if (streak >= 100) return { badge: 'Gold', color: '#FFD700' };
  if (streak >= 30) return { badge: 'Silver', color: '#C0C0C0' };
  if (streak >= 7) return { badge: 'Bronze', color: '#CD7F32' };
  
  return { badge: 'Fire', color: '#FF6B35' };
}
