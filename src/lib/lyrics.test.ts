import { describe, expect, it } from "vitest";
import {
  cleanForLyrics,
  formatSaavnLyrics,
  getPrimaryArtist,
  parseLrcLyrics,
} from "./lyrics.server";

describe("lyrics.server: parseLrcLyrics", () => {
  it("returns empty array for empty or whitespace string", () => {
    expect(parseLrcLyrics("")).toEqual([]);
    expect(parseLrcLyrics("   \n\n  ")).toEqual([]);
  });

  it("parses standard [mm:ss.xx] timestamped lines", () => {
    const lrc = `
      [00:12.50] First line of song
      [01:05.00] Chorus arrives here
      [02:30.25] Outro fading out
    `;
    const result = parseLrcLyrics(lrc);
    expect(result).toEqual([
      { time: 12.5, text: "First line of song" },
      { time: 65, text: "Chorus arrives here" },
      { time: 150.25, text: "Outro fading out" },
    ]);
  });

  it("handles multiple timestamps on a single line and sorts chronologically", () => {
    const lrc = `
      [00:30.00][00:10.00] Repeated chorus hook
      [00:05.00] Intro verse
    `;
    const result = parseLrcLyrics(lrc);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ time: 5, text: "Intro verse" });
    expect(result[1]).toEqual({ time: 10, text: "Repeated chorus hook" });
    expect(result[2]).toEqual({ time: 30, text: "Repeated chorus hook" });
  });

  it("ignores non-timestamp metadata headers like [ti:Title] and [ar:Artist]", () => {
    const lrc = `
      [ti:Kesariya]
      [ar:Arijit Singh]
      [al:Brahmastra]
      [00:15.00] Mujhko itna bataye koi
    `;
    const result = parseLrcLyrics(lrc);
    expect(result).toEqual([
      { time: 15, text: "Mujhko itna bataye koi" },
    ]);
  });

  it("handles 3-digit millisecond timestamps", () => {
    const lrc = `[00:03.456] High precision timing`;
    const result = parseLrcLyrics(lrc);
    expect(result).toEqual([
      { time: 3.46, text: "High precision timing" },
    ]);
  });
});

describe("lyrics.server: cleanForLyrics", () => {
  it("strips parenthetical and bracketed video/movie metadata", () => {
    expect(cleanForLyrics("Chaleya (From \"Jawan\")")).toBe("Chaleya");
    expect(cleanForLyrics("Kesariya [Official Video]")).toBe("Kesariya");
    expect(cleanForLyrics("Naatu Naatu (4K Ultra HD)")).toBe("Naatu Naatu");
  });

  it("strips noise keywords like feat., lyrical, mv, ost", () => {
    expect(cleanForLyrics("Shape of You Feat. Stormzy Official Music Video")).toBe("Shape of You Stormzy");
    expect(cleanForLyrics("Illuminati Lyrical Video MV")).toBe("Illuminati");
  });

  it("decodes HTML entities in titles", () => {
    expect(cleanForLyrics("Rock &amp; Roll")).toBe("Rock & Roll");
    expect(cleanForLyrics("Don&#039;t Stop")).toBe("Dont Stop");
  });

  it("handles empty or falsy strings gracefully", () => {
    expect(cleanForLyrics("")).toBe("");
  });
});

describe("lyrics.server: getPrimaryArtist", () => {
  it("extracts primary artist from comma separated lists", () => {
    expect(getPrimaryArtist("Pritam, Arijit Singh, Amitabh Bhattacharya")).toBe("Pritam");
  });

  it("extracts primary artist from ampersand and slash separators", () => {
    expect(getPrimaryArtist("Anirudh Ravichander & Arijit Singh")).toBe("Anirudh Ravichander");
    expect(getPrimaryArtist("A.R. Rahman / Shreya Ghoshal")).toBe("A.R. Rahman");
    expect(getPrimaryArtist("Badshah | Diljit Dosanjh")).toBe("Badshah");
  });

  it("preserves single artist names unchanged", () => {
    expect(getPrimaryArtist("Ed Sheeran")).toBe("Ed Sheeran");
  });

  it("handles empty input", () => {
    expect(getPrimaryArtist("")).toBe("");
  });
});

describe("lyrics.server: formatSaavnLyrics", () => {
  it("converts HTML <br> tags into line breaks", () => {
    const raw = "Pehla pehla pyaar hai<br>Pehli pehli baar hai<br/>Sach hai ya khumaar hai";
    expect(formatSaavnLyrics(raw)).toBe(
      "Pehla pehla pyaar hai\nPehli pehli baar hai\nSach hai ya khumaar hai"
    );
  });

  it("decodes HTML entities and strips wrapper HTML tags", () => {
    const raw = "<p>It&#039;s a beautiful day &amp; you know it</p><p>Second stanza</p>";
    const formatted = formatSaavnLyrics(raw);
    expect(formatted).toContain("It's a beautiful day & you know it");
    expect(formatted).toContain("Second stanza");
    expect(formatted).not.toContain("<p>");
    expect(formatted).not.toContain("</p>");
  });

  it("collapses multiple consecutive empty lines", () => {
    const raw = "Line 1<br><br><br><br><br>Line 2";
    expect(formatSaavnLyrics(raw)).toBe("Line 1\n\nLine 2");
  });

  it("handles empty input gracefully", () => {
    expect(formatSaavnLyrics("")).toBe("");
  });
});
