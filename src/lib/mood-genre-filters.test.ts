import { describe, it, expect } from "vitest";
import {
  QUICK_FILTERS,
  countQuickFilterMatches,
  filterTracksByQuickFilters,
  findQuickFilter,
  matchesQuickFilter,
  quickFilterRadioQueries,
  quickFiltersByKind,
  toggleQuickFilter,
} from "./mood-genre-filters";
import type { Track } from "./library";

const track = (over: Partial<Track> & { id: string }): Track => ({
  title: "Untitled",
  artist: "Unknown",
  duration: "3:00",
  thumbnail: "",
  ...over,
});

const lofiBeat = track({ id: "a", title: "Rainy Day Lofi Beats", artist: "Chilled Cow" });
const bhajan = track({ id: "b", title: "Shiva Bhajan", artist: "Traditional" });
const gymTrack = track({ id: "c", title: "Gym Motivation Anthem", artist: "Pump Crew" });
const bollywood = track({ id: "d", title: "Kesariya", artist: "Arijit Singh", album: "Brahmastra" });
const hindiByCode = track({ id: "e", title: "Naatu Naatu", artist: "Rahul Sipligunj", languageCode: "te" });
const irrelevant = track({ id: "f", title: "Quarterly Report", artist: "Office Sounds" });

describe("genre & mood quick filters", () => {
  it("exposes a genre and a mood chip for every taxonomy entry", () => {
    expect(quickFiltersByKind("genre").length).toBeGreaterThanOrEqual(10);
    expect(quickFiltersByKind("mood").length).toBe(10);
    expect(QUICK_FILTERS.every((f) => f.id.startsWith(f.kind === "genre" ? "genre:" : "mood:"))).toBe(true);
    expect(new Set(QUICK_FILTERS.map((f) => f.id)).size).toBe(QUICK_FILTERS.length);
  });

  it("matches a genre by its keyword in the track metadata", () => {
    const lofi = findQuickFilter("genre:lo-fi");
    expect(lofi).toBeDefined();
    expect(matchesQuickFilter(lofiBeat, lofi!)).toBe(true);
    expect(matchesQuickFilter(irrelevant, lofi!)).toBe(false);
  });

  it("matches a mood by its keyword", () => {
    const devotional = findQuickFilter("mood:devotional");
    const workout = findQuickFilter("mood:upbeat-workout");
    expect(matchesQuickFilter(bhajan, devotional!)).toBe(true);
    expect(matchesQuickFilter(gymTrack, workout!)).toBe(true);
    expect(matchesQuickFilter(gymTrack, devotional!)).toBe(false);
  });

  it("matches Desi / Bollywood by keyword and by language code", () => {
    const desi = findQuickFilter("genre:desi-bollywood");
    expect(matchesQuickFilter(bollywood, desi!)).toBe(true);
    expect(matchesQuickFilter(hindiByCode, desi!)).toBe(true);
    expect(matchesQuickFilter(irrelevant, desi!)).toBe(false);
  });

  it("never matches inside a longer word (pop vs popular)", () => {
    const pop = findQuickFilter("genre:pop");
    expect(matchesQuickFilter(track({ id: "g", title: "Popular Mechanics Weekly" }), pop!)).toBe(false);
    expect(matchesQuickFilter(track({ id: "h", title: "Pop Anthem" }), pop!)).toBe(true);
  });

  it("returns the feed untouched when no filter is active", () => {
    const feed = [lofiBeat, bhajan, irrelevant];
    const result = filterTracksByQuickFilters(feed, []);
    expect(result).toBe(feed);
    expect(result).toHaveLength(3);
  });

  it("keeps tracks matching any active filter (union)", () => {
    const feed = [lofiBeat, bhajan, gymTrack, irrelevant];
    const result = filterTracksByQuickFilters(feed, ["genre:lo-fi", "mood:devotional"]);
    expect(result.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("counts instant matches per filter for the chip labels", () => {
    const feed = [lofiBeat, bhajan, gymTrack, irrelevant];
    expect(countQuickFilterMatches(feed, findQuickFilter("genre:lo-fi")!)).toBe(1);
    expect(countQuickFilterMatches(feed, findQuickFilter("mood:devotional")!)).toBe(1);
    expect(countQuickFilterMatches(feed, findQuickFilter("genre:metal")!)).toBe(0);
  });

  it("toggles chips on and off without mutating the input", () => {
    const active = ["mood:chill"];
    const added = toggleQuickFilter(active, "genre:lo-fi");
    expect(added).toEqual(["mood:chill", "genre:lo-fi"]);
    expect(active).toEqual(["mood:chill"]);
    expect(toggleQuickFilter(added, "mood:chill")).toEqual(["genre:lo-fi"]);
  });

  it("maps active filters to deduplicated radio queries and ignores unknown ids", () => {
    expect(quickFilterRadioQueries(["genre:lofi", "not-a-real-filter"])).toEqual([]);
    const queries = quickFilterRadioQueries(["genre:lo-fi", "mood:chill"]);
    expect(queries).toHaveLength(2);
    expect(new Set(queries).size).toBe(2);
  });
});
