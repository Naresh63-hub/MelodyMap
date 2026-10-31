import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRadioTracks } from "./radio.server";
import * as saavnProvider from "./providers/saavn";

vi.mock("./providers/saavn", () => ({
  searchSaavn: vi.fn(),
}));

describe("radio.server getRadioTracks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("excludes devotional tracks, limits artist clustering, and includes co-artists", async () => {
    const mockSearch = vi.mocked(saavnProvider.searchSaavn);

    mockSearch.mockImplementation(async (query: string): Promise<any> => {
      const q = query.toLowerCase();
      if (q.includes("mangli")) {
        return [
          {
            id: "m-seed",
            title: "Saranga Dariya",
            artist: "Mangli",
            album: "Love Story",
            duration: 210,
          },
          {
            id: "m-devo-1",
            title: "Mangli Renuka Yellamma",
            artist: "Mangli",
            album: "Bonalu Special",
            duration: 260,
          },
          {
            id: "m-devo-2",
            title: "Shivaratri Song 2019",
            artist: "Mangli",
            album: "Devotional Hits",
            duration: 310,
          },
          {
            id: "m-film-1",
            title: "Ramuloo Ramulaa",
            artist: "Mangli, Anurag Kulkarni",
            album: "Ala Vaikunthapurramuloo",
            duration: 250,
          },
          {
            id: "m-film-2",
            title: "Jwala Reddy",
            artist: "Mangli, Nakka Srikanth",
            album: "Seetimaarr",
            duration: 240,
          },
          {
            id: "m-film-3",
            title: "Bhoom Bhaddhal",
            artist: "Mangli, Simha",
            album: "Krack",
            duration: 220,
          },
        ];
      }
      if (q.includes("love story")) {
        return [
          {
            id: "ls-1",
            title: "Evo Evo Kalalu",
            artist: "Nakul Abhyankar",
            album: "Love Story",
            duration: 230,
          },
          {
            id: "ls-2",
            title: "Ay Pilla",
            artist: "Haricharan",
            album: "Love Story",
            duration: 245,
          },
        ];
      }
      // Co-artists query
      return [
        {
          id: "co-1",
          title: "Samajavaragamana",
          artist: "Sid Sriram",
          album: "Ala Vaikunthapurramuloo",
          duration: 220,
        },
        {
          id: "co-2",
          title: "Srivalli",
          artist: "Sid Sriram",
          album: "Pushpa",
          duration: 215,
        },
        {
          id: "co-3",
          title: "Sirivennela",
          artist: "Anurag Kulkarni",
          album: "Shyam Singha Roy",
          duration: 240,
        },
      ];
    });

    const result = await getRadioTracks("m-seed", 10, undefined, {
      title: "Saranga Dariya",
      artist: "Mangli",
      album: "Love Story",
      languages: ["Telugu"],
    });

    const titles = result.tracks.map((t) => t.title);
    const artists = result.tracks.map((t) => t.artist);

    // 1. Seed song itself must be excluded
    expect(titles).not.toContain("Saranga Dariya");

    // 2. Devotional/folk festival songs must be excluded
    expect(titles).not.toContain("Mangli Renuka Yellamma");
    expect(titles).not.toContain("Shivaratri Song 2019");

    // 3. Co-artists must be present
    expect(artists.some((a) => a.includes("Sid Sriram") || a.includes("Anurag Kulkarni") || a.includes("Nakul"))).toBe(true);

    // 4. Max 2 tracks per primary artist
    const mangliCount = result.tracks.filter((t) => t.artist.toLowerCase().includes("mangli")).length;
    expect(mangliCount).toBeLessThanOrEqual(2);

    // 5. Anti-clustering: no consecutive tracks by same primary artist
    for (let i = 0; i < result.tracks.length - 1; i++) {
      const a1 = result.tracks[i]?.artist.toLowerCase();
      const a2 = result.tracks[i + 1]?.artist.toLowerCase();
      if (a1 && a2 && a1.includes("mangli") && a2.includes("mangli")) {
        expect.unreachable("Found adjacent tracks by Mangli");
      }
    }
  });

  it("strictly filters out tracks in other languages and prioritizes movie soundtrack albums", async () => {
    const mockSearch = vi.mocked(saavnProvider.searchSaavn);

    mockSearch.mockImplementation(async (query: string): Promise<any> => {
      return [
        {
          id: "tel-movie-1",
          title: "Chuttamalle",
          artist: "Anirudh Ravichander, Shilpa Rao",
          album: "Devara Part 1",
          languageCode: "telugu",
          duration: 215,
        },
        {
          id: "tam-movie-1",
          title: "Hukum (Tamil)",
          artist: "Anirudh Ravichander",
          album: "Jailer",
          languageCode: "tamil",
          duration: 200,
        },
        {
          id: "hin-movie-1",
          title: "Chaleya (Hindi)",
          artist: "Anirudh Ravichander, Arijit Singh",
          album: "Jawan",
          languageCode: "hindi",
          duration: 210,
        },
        {
          id: "tel-nonmovie-1",
          title: "Independent Beat Track",
          artist: "Anirudh Ravichander",
          album: "Indie Single",
          languageCode: "telugu",
          duration: 180,
        },
      ];
    });

    const result = await getRadioTracks("seed-1", 10, undefined, {
      title: "Fear Song",
      artist: "Anirudh Ravichander",
      album: "Devara Part 1",
      languages: ["Telugu"],
    });

    const ids = result.tracks.map((t) => t.id);

    // Telugu tracks must be included
    expect(ids).toContain("tel-movie-1");

    // Other language tracks must be strictly excluded
    expect(ids).not.toContain("tam-movie-1");
    expect(ids).not.toContain("hin-movie-1");

    // Movie song must appear before non-movie single
    const movieIdx = result.tracks.findIndex((t) => t.id === "tel-movie-1");
    const nonMovieIdx = result.tracks.findIndex((t) => t.id === "tel-nonmovie-1");
    if (nonMovieIdx !== -1) {
      expect(movieIdx).toBeLessThan(nonMovieIdx);
    }
  });
});
