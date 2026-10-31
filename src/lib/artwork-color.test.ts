import { describe, it, expect } from "vitest";
import {
  DEEP_VIOLET_RGB,
  getRelativeLuminance,
  clampReadableLuminance,
  blendWithDeepViolet,
  buildArtworkColorTheme,
  estimateArtworkColor,
  extractArtworkColor,
} from "./artwork-color";

describe("Dynamic Artwork Color Theming", () => {
  it("calculates relative luminance correctly", () => {
    // Pure black has 0 luminance
    expect(getRelativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
    // Pure white has 1 luminance
    expect(getRelativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 2);
    // Deep Violet has comfortable midtone luminance
    const violetLum = getRelativeLuminance(DEEP_VIOLET_RGB);
    expect(violetLum).toBeGreaterThan(0.1);
    expect(violetLum).toBeLessThan(0.4);
  });

  it("clamps dark colors to maintain readability on dark backgrounds", () => {
    const ultraDark = { r: 5, g: 5, b: 5 };
    const clamped = clampReadableLuminance(ultraDark);
    const lum = getRelativeLuminance(clamped);
    expect(lum).toBeGreaterThanOrEqual(0.2);
  });

  it("blends arbitrary hues with Deep Violet to maintain brand identity", () => {
    // Pure green
    const green = { r: 0, g: 255, b: 0 };
    const blended = blendWithDeepViolet(green, 0.5);
    // Green component is tempered and violet/blue component is boosted
    expect(blended.b).toBeGreaterThan(100);
    expect(blended.r).toBeGreaterThan(50);
  });

  it("builds a complete artwork color theme with ambient glow", () => {
    const theme = buildArtworkColorTheme({ r: 220, g: 60, b: 120 });
    expect(theme.accent).toContain("rgb(");
    expect(theme.primary).toContain("rgba(");
    expect(theme.borderAccent).toContain("rgba(");
    expect(theme.ambientGlow).toContain("radial-gradient");
    expect(theme.ambientGlow).toContain("rgba(139, 92, 246"); // Deep Violet anchor
  });

  it("deterministically estimates color theme from string seeds", () => {
    const theme1 = estimateArtworkColor("kesariya-track-1");
    const theme2 = estimateArtworkColor("kesariya-track-1");
    expect(theme1.accent).toBe(theme2.accent);
    expect(theme1.primary).toBe(theme2.primary);

    const themeOther = estimateArtworkColor("completely-different-seed-xyz");
    expect(themeOther.ambientGlow).toBeDefined();
  });

  it("extractArtworkColor falls back safely to seed estimate in non-DOM/node environments", async () => {
    const theme = await extractArtworkColor("https://example.com/art.jpg", "fallback-seed");
    expect(theme).toBeDefined();
    expect(theme.rgb).toBeDefined();
    expect(theme.ambientGlow).toContain("radial-gradient");
  });

  it("extractArtworkColor handles null or empty imageUrl gracefully", async () => {
    const theme = await extractArtworkColor(null, "empty-test");
    expect(theme).toBeDefined();
    expect(theme.rgb.r).toBeGreaterThan(0);
  });
});
