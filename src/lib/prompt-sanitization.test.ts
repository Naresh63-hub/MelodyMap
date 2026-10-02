import { describe, it, expect } from "vitest";
import { sanitizePromptInput } from "./music.functions";

describe("sanitizePromptInput normalization", () => {
  it("preserves legitimate song titles, artist names, and symbols", () => {
    expect(sanitizePromptInput("AC/DC")).toBe("AC/DC");
    expect(sanitizePromptInput("Guns N' Roses")).toBe("Guns N' Roses");
    expect(sanitizePromptInput("Rock & Roll")).toBe("Rock & Roll");
    expect(sanitizePromptInput("Song #1 (Remix)")).toBe("Song #1 (Remix)");
    expect(sanitizePromptInput("100% Pure Love")).toBe("100% Pure Love");
    expect(sanitizePromptInput("What's My Name?")).toBe("What's My Name?");
    expect(sanitizePromptInput("Artist - Song Title")).toBe("Artist - Song Title");
  });

  it("disarms markdown fences and code blocks without incomplete multi-character bypasses", () => {
    expect(sanitizePromptInput("```malicious instructions```")).toBe("malicious instructions");
    expect(sanitizePromptInput("````nested````")).toBe("nested");
    expect(sanitizePromptInput("`code`")).toBe("code");
  });

  it("disarms HTML comment tags cleanly", () => {
    expect(sanitizePromptInput("<!-- comment -->")).toBe("comment");
    expect(sanitizePromptInput("<!<!--nested-->--!>")).toBe("! nested --!");
  });

  it("disarms template interpolation delimiters", () => {
    expect(sanitizePromptInput("${process.env.SECRET}")).toBe("process.env.SECRET");
    expect(sanitizePromptInput("{ injection } [brackets]")).toBe("injection brackets");
  });

  it("strips ASCII control characters", () => {
    expect(sanitizePromptInput("Song\x00Title\x1F\x7F")).toBe("SongTitle");
  });

  it("caps length to 150 characters and collapses whitespace", () => {
    const longInput = "a ".repeat(100);
    const result = sanitizePromptInput(longInput);
    expect(result.length).toBeLessThanOrEqual(150);
    expect(result).not.toContain("  ");
  });

  it("handles empty and undefined inputs safely", () => {
    expect(sanitizePromptInput(undefined)).toBe("");
    expect(sanitizePromptInput("")).toBe("");
    expect(sanitizePromptInput("   ")).toBe("");
  });
});
