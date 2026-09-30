import { describe, expect, it } from "vitest";

import { resolveRestorablePlayback } from "./playback-restore";
import type { TrackLike } from "./track-dedup";

function track(overrides: Partial<TrackLike> & { id: string }): TrackLike {
  return {
    title: "Song",
    artist: "Artist",
    duration: "3:45", // 225s — playable music
    ...overrides,
  };
}

const UNPLAYABLE = "0:00"; // unknown/zero duration -> filtered out
const PODCAST = track({
  id: "pod-1",
  title: "The Daily Tech Podcast #12",
  duration: "45:10", // long-form -> podcast, exempt from the 600s cap
});

describe("resolveRestorablePlayback", () => {
  it("passes through an already-clean queue with its index intact", () => {
    const queue = [track({ id: "a" }), track({ id: "b" }), track({ id: "c" })];
    const res = resolveRestorablePlayback({ queue, index: 1, position: 0 });

    expect(res.empty).toBe(false);
    expect(res.queue.map((t) => t.id)).toEqual(["a", "b", "c"]);
    expect(res.index).toBe(1);
    expect(res.position).toBe(0);
  });

  it("relocates the interrupted track by ID when earlier tracks are filtered out", () => {
    // Regression: naive index clamping pointed at the WRONG song when unplayable
    // tracks preceded the current one ([unplayable, current, B] index 1 -> B).
    const queue = [track({ id: "bad", duration: UNPLAYABLE }), track({ id: "a" }), track({ id: "b" })];
    const res = resolveRestorablePlayback({ queue, index: 1, position: 0 });

    expect(res.queue.map((t) => t.id)).toEqual(["a", "b"]);
    expect(res.queue[res.index]?.id).toBe("a");
  });

  it("keeps the same song when unplayable tracks appear after the current one", () => {
    const queue = [track({ id: "a" }), track({ id: "bad", duration: UNPLAYABLE }), track({ id: "b" })];
    const res = resolveRestorablePlayback({ queue, index: 0, position: 0 });

    expect(res.queue.map((t) => t.id)).toEqual(["a", "b"]);
    expect(res.queue[res.index]?.id).toBe("a");
  });

  it("relocates correctly when the current track is last and earlier tracks drop", () => {
    const queue = [track({ id: "bad", duration: UNPLAYABLE }), track({ id: "b" }), track({ id: "a" })];
    const res = resolveRestorablePlayback({ queue, index: 2, position: 0 });

    expect(res.queue.map((t) => t.id)).toEqual(["b", "a"]);
    expect(res.queue[res.index]?.id).toBe("a");
  });

  it("falls back to the first restorable track when the saved current is unplayable", () => {
    const queue = [track({ id: "bad", duration: UNPLAYABLE }), track({ id: "a" })];
    const res = resolveRestorablePlayback({ queue, index: 0, position: 0 });

    expect(res.empty).toBe(false);
    expect(res.index).toBe(0);
    expect(res.queue[res.index]?.id).toBe("a");
  });

  it("keeps podcast tracks despite long durations", () => {
    const queue = [track({ id: "a" }), PODCAST];
    const res = resolveRestorablePlayback({ queue, index: 1, position: 613 });

    expect(res.queue.map((t) => t.id)).toEqual(["a", "pod-1"]);
    expect(res.index).toBe(1);
    expect(res.position).toBe(613);
  });

  it("reports empty when nothing in the saved queue is restorable", () => {
    const queue = [track({ id: "bad", duration: UNPLAYABLE }), track({ id: "worse", duration: "" })];
    const res = resolveRestorablePlayback({ queue, index: 0, position: 10 });

    expect(res.empty).toBe(true);
    expect(res.queue).toEqual([]);
    expect(res.index).toBe(0);
    expect(res.position).toBe(0);
  });

  it("drops malformed track entries and keeps the current song", () => {
    const queue = [null, track({ id: "a" }), { id: "", title: "x" } as unknown as TrackLike, track({ id: "b" })];
    const res = resolveRestorablePlayback({ queue: queue as Array<TrackLike | null | undefined>, index: 1, position: 0 });

    expect(res.queue.map((t) => t.id)).toEqual(["a", "b"]);
    expect(res.queue[res.index]?.id).toBe("a");
  });

  it("treats out-of-range saved indexes as no saved current track", () => {
    const queue = [track({ id: "a" }), track({ id: "b" })];
    const res = resolveRestorablePlayback({ queue, index: 99, position: 0 });
    expect(res.index).toBe(0);

    const resNeg = resolveRestorablePlayback({ queue, index: -3, position: 0 });
    expect(resNeg.index).toBe(0);
  });

  it("sanitizes missing or invalid indexes and positions", () => {
    const queue = [track({ id: "a" }), track({ id: "b" })];

    const noIndex = resolveRestorablePlayback({ queue, index: undefined, position: undefined });
    expect(noIndex.index).toBe(0);
    expect(noIndex.position).toBe(0);

    const nanIndex = resolveRestorablePlayback({ queue, index: Number.NaN, position: Number.NaN });
    expect(nanIndex.index).toBe(0);
    expect(nanIndex.position).toBe(0);

    const negPos = resolveRestorablePlayback({ queue, index: 1, position: -5 });
    expect(negPos.position).toBe(0);
  });

  it("treats a missing or non-array queue as empty", () => {
    expect(resolveRestorablePlayback({ queue: [], index: 0 }).empty).toBe(true);
    expect(
      resolveRestorablePlayback({ queue: undefined as unknown as Array<TrackLike | null | undefined>, index: 0 })
        .empty,
    ).toBe(true);
  });
});
