import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchYouTubeRadioGraph,
  clearYouTubeRadioCache,
  type YouTubeRadioCandidate,
} from "./youtube-radio.server";

describe("youtube-radio.server", () => {
  beforeEach(() => {
    clearYouTubeRadioCache();
    vi.restoreAllMocks();
  });

  it("extracts and normalizes clean track candidates from YouTube playlist panel", async () => {
    const mockQueueResponse = {
      contents: {
        singleColumnMusicWatchNextResultsRenderer: {
          tabbedRenderer: {
            watchNextTabbedResultsRenderer: {
              tabs: [
                {
                  tabRenderer: {
                    content: {
                      musicQueueRenderer: {
                        content: {
                          playlistPanelRenderer: {
                            contents: [
                              {
                                playlistPanelVideoRenderer: {
                                  videoId: "vid_1234567",
                                  title: { runs: [{ text: "Chaleya" }] },
                                  longBylineText: {
                                    runs: [
                                      { text: "Arijit Singh, Shilpa Rao" },
                                      { text: " • " },
                                      { text: "Jawan" },
                                      { text: " • 2023" },
                                    ],
                                  },
                                  lengthText: { runs: [{ text: "3:20" }] },
                                },
                              },
                              {
                                // Non-original remix track — should be filtered out!
                                playlistPanelVideoRenderer: {
                                  videoId: "vid_remix99",
                                  title: { runs: [{ text: "Chaleya (Club Remix)" }] },
                                  longBylineText: {
                                    runs: [{ text: "DJ Snake Mix" }],
                                  },
                                  lengthText: { runs: [{ text: "4:00" }] },
                                },
                              },
                              {
                                playlistPanelVideoRenderer: {
                                  videoId: "vid_7654321",
                                  title: { runs: [{ text: "O Soniye" }] },
                                  longBylineText: {
                                    runs: [
                                      { text: "Arijit Singh" },
                                      { text: " • " },
                                      { text: "Titoo MBA" },
                                    ],
                                  },
                                  lengthText: { runs: [{ text: "4:15" }] },
                                },
                              },
                            ],
                          },
                        },
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      },
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockQueueResponse,
    } as any);

    const candidates = await fetchYouTubeRadioGraph({
      videoId: "dQw4w9WgXcQ",
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(candidates.length).toBe(2);

    expect(candidates[0]?.title).toBe("Chaleya");
    expect(candidates[0]?.artist).toBe("Arijit Singh, Shilpa Rao");
    expect(candidates[0]?.album).toBe("Jawan");
    expect(candidates[0]?.duration).toBe("3:20");

    // Remix was filtered out
    expect(candidates.some((c) => c.title.includes("Remix"))).toBe(false);

    expect(candidates[1]?.title).toBe("O Soniye");
  });

  it("uses the LRU cache to avoid duplicate network queries for the same seed", async () => {
    const mockQueueResponse = {
      contents: {
        singleColumnMusicWatchNextResultsRenderer: {
          tabbedRenderer: {
            watchNextTabbedResultsRenderer: {
              tabs: [
                {
                  tabRenderer: {
                    content: {
                      musicQueueRenderer: {
                        content: {
                          playlistPanelRenderer: {
                            contents: [
                              {
                                playlistPanelVideoRenderer: {
                                  videoId: "v1111111111",
                                  title: { runs: [{ text: "Song A" }] },
                                  longBylineText: { runs: [{ text: "Artist A" }] },
                                },
                              },
                            ],
                          },
                        },
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      },
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockQueueResponse,
    } as any);

    const res1 = await fetchYouTubeRadioGraph({ videoId: "12345678901" });
    const res2 = await fetchYouTubeRadioGraph({ videoId: "12345678901" });

    // Should hit network only ONCE due to cache
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(res1).toEqual(res2);
    expect(res1.length).toBe(1);
    expect(res1[0]?.title).toBe("Song A");
  });

  it("handles YouTube 429 rate limit or network error gracefully by returning empty array", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
    } as any);

    const candidates = await fetchYouTubeRadioGraph({
      videoId: "12345678901",
    });

    // Does not throw — returns empty list so fallback immediately activates
    expect(candidates).toEqual([]);
  });

  it("resolves YouTube videoId via search when only title and artist are passed", async () => {
    const mockSearchResponse = {
      contents: {
        tabbedSearchResultsRenderer: {
          tabs: [
            {
              tabRenderer: {
                content: {
                  sectionListRenderer: {
                    contents: [
                      {
                        musicCardShelfRenderer: {
                          title: {
                            runs: [
                              {
                                navigationEndpoint: {
                                  watchEndpoint: {
                                    videoId: "resolved123",
                                  },
                                },
                              },
                            ],
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    };

    const mockNextResponse = {
      contents: {
        singleColumnMusicWatchNextResultsRenderer: {
          tabbedRenderer: {
            watchNextTabbedResultsRenderer: {
              tabs: [
                {
                  tabRenderer: {
                    content: {
                      musicQueueRenderer: {
                        content: {
                          playlistPanelRenderer: {
                            contents: [
                              {
                                playlistPanelVideoRenderer: {
                                  videoId: "next_001122",
                                  title: { runs: [{ text: "Next Song" }] },
                                  longBylineText: { runs: [{ text: "Next Artist" }] },
                                },
                              },
                            ],
                          },
                        },
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      },
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSearchResponse,
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockNextResponse,
      } as any);

    const candidates = await fetchYouTubeRadioGraph({
      title: "Chuttamalle",
      artist: "Anirudh",
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(candidates.length).toBe(1);
    expect(candidates[0]?.title).toBe("Next Song");
  });
});
