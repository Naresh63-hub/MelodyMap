import { describe, expect, it, vi } from "vitest";

import { createNativeLikeGuard } from "./native-like";

/** A clock we can advance by hand so debounce windows are deterministic. */
function fakeClock(start = 1_000) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe("createNativeLikeGuard", () => {
  it("toggles the active track when native and the player agree", () => {
    const clock = fakeClock();
    const guard = createNativeLikeGuard({ now: clock.now });
    const toggle = vi.fn();

    expect(guard.request("saavn:trackid:111", "saavn:trackid:111", toggle)).toBe("toggled");
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it("ignores a tap when there is no identifiable track", () => {
    const guard = createNativeLikeGuard({ now: fakeClock().now });
    const toggle = vi.fn();

    expect(guard.request("", "", toggle)).toBe("ignored-no-track");
    expect(guard.request(undefined, undefined, toggle)).toBe("ignored-no-track");
    expect(guard.request("   ", undefined, toggle)).toBe("ignored-no-track");
    expect(toggle).not.toHaveBeenCalled();
  });

  it("rejects a tap for a track the player no longer has loaded", () => {
    const guard = createNativeLikeGuard({ now: fakeClock().now });
    const toggle = vi.fn();

    expect(guard.request("saavn:trackid:111", "saavn:trackid:222", toggle)).toBe(
      "ignored-stale-track",
    );
    expect(toggle).not.toHaveBeenCalled();
  });

  it("collapses repeated taps on the same track into one write", () => {
    const clock = fakeClock();
    const guard = createNativeLikeGuard({ now: clock.now, debounceMs: 600 });
    const toggle = vi.fn();

    expect(guard.request("a", "a", toggle)).toBe("toggled");
    expect(guard.request("a", "a", toggle)).toBe("ignored-debounce");
    clock.advance(300);
    expect(guard.request("a", "a", toggle)).toBe("ignored-debounce");
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it("accepts a later tap once the debounce window has elapsed", () => {
    const clock = fakeClock();
    const guard = createNativeLikeGuard({ now: clock.now, debounceMs: 600 });
    const toggle = vi.fn();

    guard.request("a", "a", toggle);
    clock.advance(600);
    expect(guard.request("a", "a", toggle)).toBe("toggled");
    expect(toggle).toHaveBeenCalledTimes(2);
  });

  it("does not make a new track wait out the previous track's debounce", () => {
    const clock = fakeClock();
    const guard = createNativeLikeGuard({ now: clock.now, debounceMs: 600 });
    const toggle = vi.fn();

    guard.request("a", "a", toggle);
    expect(guard.request("b", "b", toggle)).toBe("toggled");
    expect(toggle).toHaveBeenCalledTimes(2);
  });

  it("rolls the guard back when the write throws, so the user can retry", () => {
    const clock = fakeClock();
    const guard = createNativeLikeGuard({ now: clock.now, debounceMs: 600 });

    expect(
      guard.request("a", "a", () => {
        throw new Error("offline");
      }),
    ).toBe("failed");
    // Immediately retryable: a failed like must not lock the button out.
    expect(guard.request("a", "a", () => {})).toBe("toggled");
  });

  it("reset() clears debounce history", () => {
    const clock = fakeClock();
    const guard = createNativeLikeGuard({ now: clock.now, debounceMs: 600 });
    const toggle = vi.fn();

    guard.request("a", "a", toggle);
    guard.reset();
    expect(guard.request("a", "a", toggle)).toBe("toggled");
    expect(toggle).toHaveBeenCalledTimes(2);
  });
});
