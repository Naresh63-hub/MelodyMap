import { describe, it, expect } from "vitest";
import {
  MASTER_STORIES_CATALOG,
  getStoriesCatalog,
  getStorySeriesById,
  getStoryLanguageCounts,
} from "./stories-catalog";
import { chapterToTrack } from "./story.types";

describe("stories engine", () => {
  describe("MASTER_STORIES_CATALOG integrity", () => {
    it("contains curated series covering Epics, Thrillers, Audiobooks, Warriors, Biographies, and Kids", () => {
      expect(MASTER_STORIES_CATALOG.length).toBeGreaterThanOrEqual(12);

      const categories = new Set(MASTER_STORIES_CATALOG.map((s) => s.category));
      expect(categories.has("epics")).toBe(true);
      expect(categories.has("thriller")).toBe(true);
      expect(categories.has("audiobooks")).toBe(true);
      expect(categories.has("warriors")).toBe(true);
      expect(categories.has("kids")).toBe(true);
      expect(categories.has("biographies")).toBe(true);
    });

    it("ensures every series has valid metadata and sequential chapter numbering with zero duplicates", () => {
      for (const series of MASTER_STORIES_CATALOG) {
        expect(series.id).toBeTruthy();
        expect(series.title).toBeTruthy();
        expect(series.narrator).toBeTruthy();
        expect(series.language).toMatch(/^(Telugu|Hindi|English)$/);
        expect(series.coverUrl).toBeTruthy();
        expect(series.rating).toBeGreaterThanOrEqual(4.0);
        expect(series.chapters.length).toBeGreaterThan(0);
        expect(series.totalChapters).toBe(series.chapters.length);

        // Verify chapter sequential order and lack of duplicates
        const chapterIds = new Set<string>();
        series.chapters.forEach((ch, idx) => {
          expect(ch.chapterNumber).toBe(idx + 1);
          expect(ch.id).toBeTruthy();
          expect(chapterIds.has(ch.id)).toBe(false);
          chapterIds.add(ch.id);

          expect(ch.title).toBeTruthy();
          expect(ch.duration).toMatch(/^\d{2}:\d{2}$/);
          expect(ch.durationSeconds).toBeGreaterThan(0);
          expect(ch.streamUrl).toBeTruthy();
          expect(ch.seriesId).toBe(series.id);
        });
      }
    });

    it("calculates accurate language counts for Telugu, Hindi, and English", () => {
      const counts = getStoryLanguageCounts();
      expect(counts.All).toBe(MASTER_STORIES_CATALOG.length);
      expect(counts.Telugu).toBeGreaterThanOrEqual(4);
      expect(counts.Hindi).toBeGreaterThanOrEqual(4);
      expect(counts.English).toBeGreaterThanOrEqual(2);
      expect(counts.Telugu + counts.Hindi + counts.English).toBe(counts.All);
    });
  });

  describe("getStoriesCatalog filtering", () => {
    it("filters series strictly by category including thriller and audiobooks", () => {
      const thrillers = getStoriesCatalog({ category: "thriller" });
      expect(thrillers.length).toBeGreaterThan(0);
      expect(thrillers.every((s) => s.category === "thriller")).toBe(true);

      const audiobooks = getStoriesCatalog({ category: "audiobooks" });
      expect(audiobooks.length).toBeGreaterThan(0);
      expect(audiobooks.every((s) => s.category === "audiobooks")).toBe(true);

      const epics = getStoriesCatalog({ category: "epics" });
      expect(epics.length).toBeGreaterThan(0);
      expect(epics.every((s) => s.category === "epics")).toBe(true);

      const kids = getStoriesCatalog({ category: "kids" });
      expect(kids.length).toBeGreaterThan(0);
      expect(kids.every((s) => s.category === "kids")).toBe(true);
    });

    it("filters series strictly by language", () => {
      const teluguStories = getStoriesCatalog({ language: "Telugu" });
      expect(teluguStories.length).toBeGreaterThanOrEqual(6);
      expect(teluguStories.every((s) => s.language === "Telugu")).toBe(true);

      const hindiStories = getStoriesCatalog({ language: "Hindi" });
      expect(hindiStories.length).toBeGreaterThanOrEqual(6);
      expect(hindiStories.every((s) => s.language === "Hindi")).toBe(true);

      const englishStories = getStoriesCatalog({ language: "English" });
      expect(englishStories.length).toBeGreaterThanOrEqual(2);
      expect(englishStories.every((s) => s.language === "English")).toBe(true);
    });

    it("searches series by query string across title, narrator, and tags", () => {
      const yandamuri = getStoriesCatalog({ query: "Yandamuri" });
      expect(yandamuri.length).toBeGreaterThanOrEqual(1);
      expect(yandamuri[0]?.title).toContain("చీకట్లో సూర్యుడు");

      const horror = getStoriesCatalog({ query: "Horror" });
      expect(horror.length).toBeGreaterThanOrEqual(1);
      expect(horror[0]?.title).toContain("हॉरर");

      const shivaji = getStoriesCatalog({ query: "Shivaji" });
      expect(shivaji.length).toBeGreaterThanOrEqual(1);
      expect(shivaji[0]?.title).toContain("शिवाजी");

      const chaganti = getStoriesCatalog({ query: "చాగంటి" });
      expect(chaganti.length).toBeGreaterThanOrEqual(1);
      expect(chaganti[0]?.narrator).toContain("చాగంటి");

      const kalam = getStoriesCatalog({ query: "Kalam" });
      expect(kalam.length).toBeGreaterThanOrEqual(1);
      expect(kalam[0]?.title).toContain("Kalam");
    });

    it("retrieves a single series by its unique ID", () => {
      const series = getStorySeriesById("story:mahabharata-drama-en");
      expect(series).toBeDefined();
      expect(series?.title).toBe("The Stories of Mahabharata");
      expect(series?.narrator).toBe("Sudipta Bhawmik");

      const nonExistent = getStorySeriesById("story:non-existent");
      expect(nonExistent).toBeUndefined();
    });
  });

  describe("chapterToTrack mapping", () => {
    it("converts a StoryChapter into a compatible Track object for the audio player", () => {
      const series = MASTER_STORIES_CATALOG[0]!;
      const chapter = series.chapters[0]!;

      const track = chapterToTrack(chapter, series);

      expect(track.id).toBe(chapter.id);
      expect(track.title).toBe(chapter.title);
      expect(track.artist).toBe(series.narrator);
      expect(track.album).toBe(series.title);
      expect(track.duration).toBe(chapter.duration);
      expect(track.durationSeconds).toBe(chapter.durationSeconds);
      expect(track.previewUrl).toBe(chapter.streamUrl);
      expect(track.thumbnail).toBe(series.coverUrl);
      expect(track.source).toBe("podcast");
      expect(track.playable).toBe(true);
      expect(track.podcastId).toBe(series.id);
      expect(track.languageCode).toBe(series.language.toLowerCase());
    });
  });
});
