import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("ProfilePanel responsive layout & clean profile overview", () => {
  const profilePanelSource = readFileSync(
    resolve(__dirname, "./ProfilePanel.tsx"),
    "utf-8"
  );

  it("does not render Your Activity statistics section (songs played / listening time)", () => {
    expect(profilePanelSource).not.toContain("Your Activity");
    expect(profilePanelSource).not.toContain("Songs Played");
    expect(profilePanelSource).not.toContain("Listening Time");
    expect(profilePanelSource).not.toContain("songsPlayedCount");
    expect(profilePanelSource).not.toContain("listeningHours");
  });

  it("renders Edit Profile button in user hero section below account status", () => {
    expect(profilePanelSource).toContain("Edit Profile");
    expect(profilePanelSource).toContain("Free Plan");
    expect(profilePanelSource).toContain("Cloud Synced");
    expect(profilePanelSource).toContain("min-h-[38px]");
  });

  it("preserves all core menu items and interactive navigation", () => {
    expect(profilePanelSource).toContain("Playlists");
    expect(profilePanelSource).toContain("Downloads");
    expect(profilePanelSource).toContain("Liked Songs");
    expect(profilePanelSource).toContain("Settings");
    expect(profilePanelSource).toContain("Help & Support");
    expect(profilePanelSource).toContain("About MelodyMap");
  });

  it("does not render disconnected bottom wave banner", () => {
    expect(profilePanelSource).not.toContain('<MusicWaveBanner variant="bottom" />');
  });
});
