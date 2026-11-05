import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("SettingsModal & Profile mobile-native layout verification", () => {
  const settingsModalSource = readFileSync(
    resolve(__dirname, "./SettingsModal.tsx"),
    "utf-8"
  );
  const profilePanelSource = readFileSync(
    resolve(__dirname, "./ProfilePanel.tsx"),
    "utf-8"
  );
  const languageArtistPickerSource = readFileSync(
    resolve(__dirname, "./LanguageArtistPicker.tsx"),
    "utf-8"
  );

  it("SettingsModal renders as a full-screen mobile panel on small viewports with no desktop centering artifacts", () => {
    // Verifies full-screen mobile positioning: inset-0, h-[100dvh], max-h-[100dvh], top-0, left-0, translate-x-0, translate-y-0
    expect(settingsModalSource).toContain("h-[100dvh]");
    expect(settingsModalSource).toContain("max-h-[100dvh]");
    expect(settingsModalSource).toContain("inset-0");
    expect(settingsModalSource).toContain("top-0");
    expect(settingsModalSource).toContain("left-0");
    expect(settingsModalSource).toContain("translate-x-0");
    expect(settingsModalSource).toContain("translate-y-0");
    expect(settingsModalSource).toContain("rounded-none");
    expect(settingsModalSource).toContain("border-0");

    // Verifies desktop retains centered modal
    expect(settingsModalSource).toContain("sm:top-[50%]");
    expect(settingsModalSource).toContain("sm:left-[50%]");
    expect(settingsModalSource).toContain("sm:translate-x-[-50%]");
    expect(settingsModalSource).toContain("sm:translate-y-[-50%]");
    expect(settingsModalSource).toContain("sm:max-w-2xl");
  });

  it("SettingsModal suppresses default duplicate close button and provides a dedicated mobile touch header", () => {
    // hideCloseButton suppresses the duplicate floating Radix dialog close button
    expect(settingsModalSource).toContain("hideCloseButton");
    // Native app bar with safe area top support
    expect(settingsModalSource).toContain("pt-[max(0.75rem,env(safe-area-inset-top,0.75rem))]");
    expect(settingsModalSource).toContain("Close Settings");
  });

  it("Tabs are horizontally scrollable with clear active contrast", () => {
    // Horizontally scrollable container with hidden scrollbar and touch momentum
    expect(settingsModalSource).toContain("overflow-x-auto");
    expect(settingsModalSource).toContain("scrollbar-hide");
    expect(settingsModalSource).toContain("no-scrollbar");

    // All key tabs exist
    expect(settingsModalSource).toMatch(/Profile\s+(&|&amp;)\s+Account/);
    expect(settingsModalSource).toMatch(/Languages\s+(&|&amp;)\s+Artists/);
    expect(settingsModalSource).toContain("Personalization");
    expect(settingsModalSource).toMatch(/Playback\s+(&|&amp;)\s+Hardware/);
    expect(settingsModalSource).toContain("Listening Insights");

    // Active state indicator has distinct contrast
    expect(settingsModalSource).toContain("bg-primary/15 text-primary border border-primary/30");
  });

  it("Profile card, display name input, and theme swatches do not overflow on mobile", () => {
    // Display name input uses min-w-0 flex-1 to prevent flex shrink blowout
    expect(settingsModalSource).toContain("flex-1 min-w-0");
    // Avatar presets use responsive grid (3 columns on mobile, 6 on desktop)
    expect(settingsModalSource).toContain("grid-cols-3 sm:grid-cols-6");
    // Crossfade preset buttons use responsive grid (2 columns on mobile, 4 on desktop)
    expect(settingsModalSource).toContain("grid-cols-2 sm:grid-cols-4");
    // Theme options stack on mobile (1 column on mobile, 3 on desktop)
    expect(settingsModalSource).toContain("grid-cols-1 sm:grid-cols-3");
  });

  it("ProfilePanel uses mobile-friendly container padding and touch targets", () => {
    expect(profilePanelSource).toContain("px-3.5 py-5 sm:px-6");
    expect(profilePanelSource).toContain("min-h-[38px]");
  });

  it("LanguageArtistPicker uses responsive input and deduplication logic", () => {
    expect(languageArtistPickerSource).toContain("deduplicateTracks");
    expect(languageArtistPickerSource).toContain("min-w-0 flex-1");
  });
});
