import { safeStorage } from "@/lib/safe-storage";

export interface StoryBookmark {
  id: string;
  chapterId: string;
  seriesId: string;
  seriesTitle: string;
  chapterTitle: string;
  chapterNumber: number;
  positionSeconds: number;
  timestamp: string; // Formatted "14:20"
  createdAt: number;
  note?: string | undefined;
}

export interface ChapterProgress {
  chapterId: string;
  seriesId: string;
  positionSeconds: number;
  durationSeconds: number;
  updatedAt: number;
}

const BOOKMARKS_STORAGE_KEY = "melodymap.story_bookmarks.v1";
const PROGRESS_STORAGE_KEY = "melodymap.story_progress.v1";

export function formatSecondsToTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const remainingS = s % 60;
  return `${m}:${remainingS.toString().padStart(2, "0")}`;
}

export function getStoryBookmarks(seriesId?: string): StoryBookmark[] {
  try {
    const raw = safeStorage.getItem(BOOKMARKS_STORAGE_KEY);
    if (!raw) return [];
    const list: StoryBookmark[] = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    if (seriesId) {
      return list.filter((b) => b.seriesId === seriesId);
    }
    return list;
  } catch {
    return [];
  }
}

export function saveStoryBookmark(
  bookmark: Omit<StoryBookmark, "id" | "createdAt" | "timestamp"> & {
    timestamp?: string | undefined;
  }
): StoryBookmark {
  const existing = getStoryBookmarks();
  const id = `bm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const timestamp = bookmark.timestamp || formatSecondsToTimestamp(bookmark.positionSeconds);

  const newBookmark: StoryBookmark = {
    ...bookmark,
    id,
    timestamp,
    createdAt: Date.now(),
  };

  // Keep max 50 bookmarks, most recent first
  const updated = [newBookmark, ...existing.filter((b) => b.id !== id)].slice(0, 50);
  safeStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(updated));
  return newBookmark;
}

export function deleteStoryBookmark(id: string): void {
  const existing = getStoryBookmarks();
  const updated = existing.filter((b) => b.id !== id);
  safeStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(updated));
}

export function getChapterProgress(chapterId: string): ChapterProgress | null {
  try {
    const raw = safeStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return null;
    const progressMap: Record<string, ChapterProgress> = JSON.parse(raw);
    return progressMap[chapterId] || null;
  } catch {
    return null;
  }
}

export function saveChapterProgress(progress: Omit<ChapterProgress, "updatedAt">): void {
  try {
    const raw = safeStorage.getItem(PROGRESS_STORAGE_KEY);
    const progressMap: Record<string, ChapterProgress> = raw ? JSON.parse(raw) : {};
    progressMap[progress.chapterId] = {
      ...progress,
      updatedAt: Date.now(),
    };
    safeStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progressMap));
  } catch {
    // Ignore storage errors
  }
}

export function getAllChapterProgress(seriesId?: string): Record<string, ChapterProgress> {
  try {
    const raw = safeStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return {};
    const progressMap: Record<string, ChapterProgress> = JSON.parse(raw);
    if (!seriesId) return progressMap;

    const filtered: Record<string, ChapterProgress> = {};
    for (const [key, prog] of Object.entries(progressMap)) {
      if (prog.seriesId === seriesId) {
        filtered[key] = prog;
      }
    }
    return filtered;
  } catch {
    return {};
  }
}
