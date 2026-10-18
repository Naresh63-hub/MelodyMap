import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchSaavn } from "./providers/saavn";
import { getRadioTracks } from "./radio.server";
import * as saavnModule from "./providers/saavn";

describe("Deep Ocean Music Discovery & Pagination", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("searchSaavn pagination", () => {
    it("includes requested page &p parameter in the JioSaavn API URL", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        return new Response(JSON.stringify({ results: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      await searchSaavn("Arijit Singh", { limit: 10, page: 1 });
      expect(fetchSpy).toHaveBeenCalled();
      const firstUrl = fetchSpy.mock.calls[0]?.[0] as string;
      expect(firstUrl).toContain("&p=1");

      await searchSaavn("Arijit Singh", { limit: 10, page: 3 });
      const thirdUrl = fetchSpy.mock.calls[1]?.[0] as string;
      expect(thirdUrl).toContain("&p=3");

      await searchSaavn("Arijit Singh", { limit: 10, page: 5 });
      const fifthUrl = fetchSpy.mock.calls[2]?.[0] as string;
      expect(fifthUrl).toContain("&p=5");
    });
  });

  describe("radio.server query generation without shallow hit bias", () => {
    it("delves into deep catalog queries and forwards page parameter without 'top songs' bias", async () => {
      const searchSpy = vi.spyOn(saavnModule, "searchSaavn").mockImplementation(async () => []);

      // Page 1 query
      await getRadioTracks("test-seed", 15, undefined, {
        title: "Kesariya",
        artist: "Arijit Singh",
        album: "Brahmastra",
        languages: ["Hindi"],
        page: 1,
      });

      expect(searchSpy).toHaveBeenCalled();
      const calls = searchSpy.mock.calls;
      const queries = calls.map((c) => c[0].toLowerCase());
      const options = calls.map((c) => c[1]);

      // 1. None of the queries should contain shallow 'top songs', 'hit songs', or 'superhit songs'
      for (const q of queries) {
        expect(q).not.toContain("top songs");
        expect(q).not.toContain("hit songs");
        expect(q).not.toContain("superhit songs");
      }

      // 2. Should query natural discography and album facets
      expect(queries.some((q) => q.includes("arijit singh songs"))).toBe(true);
      expect(queries.some((q) => q.includes("brahmastra album"))).toBe(true);
      expect(queries.some((q) => q.includes("album songs"))).toBe(true);

      // 3. Page 1 option forwarded
      expect(options.some((o) => o?.page === 1)).toBe(true);
    });

    it("deepens facets and pagination when page >= 2", async () => {
      const searchSpy = vi.spyOn(saavnModule, "searchSaavn").mockImplementation(async () => []);

      await getRadioTracks("test-seed-2", 15, undefined, {
        title: "Tum Hi Ho",
        artist: "Arijit Singh",
        languages: ["Hindi"],
        page: 2,
      });

      const calls = searchSpy.mock.calls;
      const queries = calls.map((c) => c[0].toLowerCase());
      const options = calls.map((c) => c[1]);

      // Page 2 should include melodies facet and page 2 depth
      expect(queries.some((q) => q.includes("melodies"))).toBe(true);
      expect(options.some((o) => o?.page === 2)).toBe(true);
    });

    it("deepens to unplugged/acoustic textures when page >= 3", async () => {
      const searchSpy = vi.spyOn(saavnModule, "searchSaavn").mockImplementation(async () => []);

      await getRadioTracks("test-seed-3", 15, undefined, {
        title: "Channa Mereya",
        artist: "Arijit Singh",
        languages: ["Hindi"],
        page: 3,
      });

      const calls = searchSpy.mock.calls;
      const queries = calls.map((c) => c[0].toLowerCase());
      const options = calls.map((c) => c[1]);

      expect(queries.some((q) => q.includes("unplugged"))).toBe(true);
      expect(options.some((o) => o?.page === 3)).toBe(true);
    });
  });
});
