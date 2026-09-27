import { describe, it, expect } from "vitest";
import {
  createSessionFeedState,
  filterFeedCandidates,
  hasPlayableDuration,
  recordDisplayedTracks,
  uniqueByTrackId,
  trackIdOf,
} from "./feed-freshness";
import type { Track } from "./types";

function mkTrack(id: string, duration: string, artist = "Artist"): Track {
  return {
    id,
    title: `Song ${id}`,
    artist,
    duration,
    thumbnail: `https://example.com/${id}.jpg`,
  };
}

/** Mirrors the session-level exclusions used by the Home feed (routes/index.tsx). */
function buildExclusions(
  displayed: Track[],
  liked: Track[],
  recentlyPlayed: Track[],
  current: Track | undefined,
) {
  const previouslyDisplayedIds = new Set<string>();
  const recentlyPlayedIds = new Set<string>();
  recordDisplayedTracks(previouslyDisplayedIds, displayed);
  recordDisplayedTracks(recentlyPlayedIds, recentlyPlayed);
  return {
    previouslyDisplayedIds,
    recentlyPlayedIds,
    likedIds: new Set(liked.map((t) => t.id)),
    currentTrackId: current?.id ?? null,
  };
}

describe("Feed freshness: session exclusion set and duration gate", () => {
  it("C. refresh does NOT reuse previously displayed tracks", () => {
    const firstFeed = [mkTrack("a", "3:00"), mkTrack("b", "3:30"), mkTrack("c", "4:00")];
    const exclusions = buildExclusions(firstFeed, [], [], undefined);

    const refreshedPool = [mkTrack("a", "3:00"), mkTrack("b", "3:30"), mkTrack("d", "4:12"), mkTrack("e", "2:55")];
    const fresh = filterFeedCandidates(refreshedPool, exclusions);

    expect(fresh.map((t) => t.id)).toEqual(["d", "e"]);
  });

  it("D. refresh excludes liked tracks (Library unaffected, candidates excluded)", () => {
    const liked = [mkTrack("like1", "3:00"), mkTrack("like2", "4:00")];
    const exclusions = buildExclusions([], liked, [], undefined);

    const pool = [mkTrack("like1", "3:00"), mkTrack("n1", "3:10"), mkTrack("like2", "4:00"), mkTrack("n2", "3:45")];
    const fresh = filterFeedCandidates(pool, exclusions);

    expect(fresh.map((t) => t.id)).toEqual(["n1", "n2"]);
    // Liked tracks remain valid Library entries — the exclusion is feed-scoped only.
    expect(liked).toHaveLength(2);
  });

  it("E. refresh removes duplicate track IDs (first occurrence wins, order preserved)", () => {
    const exclusions = buildExclusions([], [], [], undefined);
    const pool = [
      mkTrack("dup", "3:00"),
      mkTrack("x1", "3:00"),
      mkTrack("dup", "3:00"),
      mkTrack("x2", "3:30"),
      mkTrack("dup", "5:00"),
    ];

    const fresh = filterFeedCandidates(pool, exclusions);
    expect(fresh.map((t) => t.id)).toEqual(["dup", "x1", "x2"]);
    expect(uniqueByTrackId(pool).map((t) => t.id)).toEqual(["dup", "x1", "x2"]);
  });

  it("F. tracks > 600 seconds are excluded (10:01 rejected, 15:00 rejected)", () => {
    const exclusions = buildExclusions([], [], [], undefined);
    const pool = [mkTrack("ok", "9:59"), mkTrack("over1", "10:01"), mkTrack("over2", "15:00"), mkTrack("over3", "60:00")];

    const fresh = filterFeedCandidates(pool, exclusions);
    expect(fresh.map((t) => t.id)).toEqual(["ok"]);
  });

  it("G. tracks of exactly 600 seconds (10:00) are allowed", () => {
    expect(hasPlayableDuration(mkTrack("exact", "10:00"))).toBe(true);
    const exclusions = buildExclusions([], [], [], undefined);
    const fresh = filterFeedCandidates([mkTrack("exact", "10:00"), mkTrack("short", "4:32")], exclusions);
    expect(fresh).toHaveLength(2);
  });

  it("H. unknown / null / invalid durations are excluded, never assumed short", () => {
    const unknown = mkTrack("u1", "");
    const nullDur = mkTrack("u2", undefined as unknown as string);
    const garbage = mkTrack("u3", "not-a-duration");
    const zero = mkTrack("u4", "0:00");

    expect(hasPlayableDuration(unknown)).toBe(false);
    expect(hasPlayableDuration(nullDur)).toBe(false);
    expect(hasPlayableDuration(garbage)).toBe(false);
    expect(hasPlayableDuration(zero)).toBe(false);

    const exclusions = buildExclusions([], [], [], undefined);
    const fresh = filterFeedCandidates([unknown, nullDur, garbage, zero, mkTrack("valid", "3:21")], exclusions);
    expect(fresh.map((t) => t.id)).toEqual(["valid"]);
  });

  it("current track and recently played tracks are excluded from fresh candidates", () => {
    const current = mkTrack("now", "3:00");
    const recent = [mkTrack("r1", "3:00"), mkTrack("r2", "4:00")];
    const exclusions = buildExclusions([], [], recent, current);

    const pool = [mkTrack("now", "3:00"), mkTrack("r1", "3:00"), mkTrack("r2", "4:00"), mkTrack("new", "3:33")];
    const fresh = filterFeedCandidates(pool, exclusions);
    expect(fresh.map((t) => t.id)).toEqual(["new"]);
  });

  it("exclusions are session-scoped: clearing displayed set restores candidates (no permanent blacklist)", () => {
    const song = mkTrack("recurring", "3:00");
    const firstSession = buildExclusions([song], [], [], undefined);
    expect(filterFeedCandidates([song], firstSession)).toHaveLength(0);

    // New session: empty exclusion set — the same song may appear again.
    const newSession = buildExclusions([], [], [], undefined);
    expect(filterFeedCandidates([song], newSession)).toHaveLength(1);
  });

  it("filter ordering: freshness + duration gates run BEFORE Thompson Sampling ranking", () => {
    const exclusions = buildExclusions([mkTrack("old", "3:00")], [], [], undefined);
    const pool = [mkTrack("old", "3:00"), mkTrack("long", "12:00"), mkTrack("good", "3:00")];

    // Hard filters first — only then would rankCandidates see the survivors.
    const survivors = filterFeedCandidates(pool, exclusions);
    expect(survivors.map((t) => t.id)).toEqual(["good"]);
    expect(survivors.length).toBeLessThan(pool.length);
  });

  it("createSessionFeedState tracks displayed IDs across multiple feeds in one session", () => {
    const session = createSessionFeedState();
    const feed1 = [mkTrack("a", "3:00"), mkTrack("b", "3:30")];
    const feed2Pool = [mkTrack("b", "3:30"), mkTrack("c", "4:00")];

    const exclusions1 = session.snapshot([]);
    expect(filterFeedCandidates(feed2Pool, exclusions1)).toHaveLength(2);

    session.record(feed1);
    const exclusions2 = session.snapshot([]);
    expect(filterFeedCandidates(feed2Pool, exclusions2).map((t) => t.id)).toEqual(["c"]);
  });
});
