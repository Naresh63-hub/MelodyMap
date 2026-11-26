import { describe, it, expect, beforeEach } from "vitest";
import {
  saveStoryBookmark,
  getStoryBookmarks,
  deleteStoryBookmark,
  saveChapterProgress,
  getChapterProgress,
  getAllChapterProgress,
  formatSecondsToTimestamp,
} from "./story-bookmarks";
import { safeStorage } from "@/lib/safe-storage";

describe("story-bookmarks", () => {
  beforeEach(() => {
    safeStorage.removeItem("melodymap.story_bookmarks.v1");
    safeStorage.removeItem("melodymap.story_progress.v1");
  });

  describe("formatSecondsToTimestamp", () => {
    it("formats seconds into mm:ss accurately", () => {
      expect(formatSecondsToTimestamp(0)).toBe("0:00");
      expect(formatSecondsToTimestamp(65)).toBe("1:05");
      expect(formatSecondsToTimestamp(600)).toBe("10:00");
      expect(formatSecondsToTimestamp(1450)).toBe("24:10");
    });
  });

  describe("story bookmarks storage", () => {
    it("saves and retrieves bookmarks", () => {
      expect(getStoryBookmarks()).toEqual([]);

      const bm = saveStoryBookmark({
        chapterId: "story:ch:mahabharata-1",
        seriesId: "story:series:mahabharata",
        seriesTitle: "The Stories of Mahabharata",
        chapterTitle: "Chapter 1: The Origin of Kurus",
        chapterNumber: 1,
        positionSeconds: 185,
        note: "Crucial battle strategy dialogue",
      });

      expect(bm.id).toBeTruthy();
      expect(bm.timestamp).toBe("3:05");
      expect(bm.note).toBe("Crucial battle strategy dialogue");

      const list = getStoryBookmarks();
      expect(list.length).toBe(1);
      expect(list[0]?.id).toBe(bm.id);

      const seriesList = getStoryBookmarks("story:series:mahabharata");
      expect(seriesList.length).toBe(1);

      const otherSeriesList = getStoryBookmarks("story:series:other");
      expect(otherSeriesList.length).toBe(0);
    });

    it("deletes a bookmark by ID", () => {
      const bm1 = saveStoryBookmark({
        chapterId: "ch1",
        seriesId: "s1",
        seriesTitle: "Series 1",
        chapterTitle: "Chapter 1",
        chapterNumber: 1,
        positionSeconds: 60,
      });

      const bm2 = saveStoryBookmark({
        chapterId: "ch2",
        seriesId: "s1",
        seriesTitle: "Series 1",
        chapterTitle: "Chapter 2",
        chapterNumber: 2,
        positionSeconds: 120,
      });

      expect(getStoryBookmarks().length).toBe(2);
      deleteStoryBookmark(bm1.id);
      const remaining = getStoryBookmarks();
      expect(remaining.length).toBe(1);
      expect(remaining[0]?.id).toBe(bm2.id);
    });
  });

  describe("chapter progress tracking", () => {
    it("tracks and retrieves playback progress per chapter", () => {
      expect(getChapterProgress("ch1")).toBeNull();

      saveChapterProgress({
        chapterId: "ch1",
        seriesId: "s1",
        positionSeconds: 420,
        durationSeconds: 1200,
      });

      const prog = getChapterProgress("ch1");
      expect(prog).not.toBeNull();
      expect(prog?.positionSeconds).toBe(420);
      expect(prog?.durationSeconds).toBe(1200);

      const all = getAllChapterProgress("s1");
      expect(all["ch1"]?.positionSeconds).toBe(420);
    });
  });
});
