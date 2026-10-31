import { describe, it, expect } from "vitest";
import { calculateSwipeGesture } from "./use-gesture-controls";

describe("calculateSwipeGesture", () => {
  it("detects left swipe when horizontal travel exceeds threshold", () => {
    // Start at (100, 100), end at (40, 105) -> dx = -60, dy = 5
    const result = calculateSwipeGesture({ x: 100, y: 100 }, { x: 40, y: 105 }, 48);
    expect(result).toBe("left");
  });

  it("detects right swipe when horizontal travel exceeds threshold", () => {
    // Start at (50, 100), end at (120, 98) -> dx = +70, dy = -2
    const result = calculateSwipeGesture({ x: 50, y: 100 }, { x: 120, y: 98 }, 48);
    expect(result).toBe("right");
  });

  it("detects down swipe when vertical travel exceeds threshold", () => {
    // Start at (100, 50), end at (102, 130) -> dx = 2, dy = +80
    const result = calculateSwipeGesture({ x: 100, y: 50 }, { x: 102, y: 130 }, 64);
    expect(result).toBe("down");
  });

  it("detects up swipe when vertical travel exceeds threshold", () => {
    // Start at (100, 150), end at (102, 70) -> dx = 2, dy = -80
    const result = calculateSwipeGesture({ x: 100, y: 150 }, { x: 102, y: 70 }, 64);
    expect(result).toBe("up");
  });

  it("ignores sub-threshold movements to prevent accidental triggers", () => {
    // dx = -20, below threshold of 48
    const result = calculateSwipeGesture({ x: 100, y: 100 }, { x: 80, y: 100 }, 48);
    expect(result).toBeNull();
  });

  it("ignores ambiguous diagonal movements (requires 1.25x axis dominance)", () => {
    // dx = -50, dy = 45 -> diagonal drag, not clearly horizontal or vertical
    const result = calculateSwipeGesture({ x: 100, y: 100 }, { x: 50, y: 145 }, 48);
    expect(result).toBeNull();
  });
});
