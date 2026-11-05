import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("ProfilePanel layout & removal of YOUR STATS section", () => {
  const profilePanelSource = readFileSync(
    resolve(__dirname, "./ProfilePanel.tsx"),
    "utf-8"
  );

  it("does not render YOUR STATS section, songs count or listening duration", () => {
    // Should NOT contain any "Your Stats" section or labels
    expect(profilePanelSource.toLowerCase()).not.toContain("your stats");
    expect(profilePanelSource).not.toContain("Listening");
    expect(profilePanelSource).not.toContain("songsPlayedCount");
    expect(profilePanelSource).not.toContain("listeningHours");
    expect(profilePanelSource).not.toContain("divide-x divide-border");
  });

  it("renders Edit Profile button in user hero section below account status", () => {
    expect(profilePanelSource).toContain("Edit Profile");
    expect(profilePanelSource).toContain("Free Plan");
    expect(profilePanelSource).toContain("Cloud Synced");
    expect(profilePanelSource).toContain("min-h-[38px]");
  });

  it("preserves all core menu items and navigation functionality", () => {
    expect(profilePanelSource).toContain("Playlists");
    expect(profilePanelSource).toContain("Downloads");
    expect(profilePanelSource).toContain("Liked Songs");
    expect(profilePanelSource).toContain("Settings");
    expect(profilePanelSource).toContain("Help & Support");
    expect(profilePanelSource).toContain("About MelodyMap");
  });
});
