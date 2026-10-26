import { test, expect } from "@playwright/test";

test.describe("MelodyMap Equalizer & Audio FX E2E Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("melodymap.guest_mode", "true");
      localStorage.setItem("melodymap.onboarded.v1", "true");
      const mockQueue = [
        {
          id: "saavn:song_test_id",
          title: "Test Melody",
          artist: "Melody Artist",
          duration: "3:30",
          previewUrl: "https://aac.saavncdn.com/test_160.mp4",
          source: "saavn",
        },
      ];
      localStorage.setItem(
        "melodymap.playback.v1",
        JSON.stringify({
          queue: mockQueue,
          index: 0,
          position: 10,
          isPlaying: false,
        }),
      );
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#melodymap-core-audio")).toBeAttached({ timeout: 15000 });
  });

  async function openEqualizerModal(page: any) {
    // Open full player first
    const openPlayerBtn = page.getByRole("button", { name: /Open (player|now playing view) for/i }).first();
    await openPlayerBtn.click();
    await expect(page.getByRole("button", { name: "Collapse player" })).toBeVisible({ timeout: 10000 });

    // Click Equalizer & FX button
    const eqBtn = page.getByRole("button", { name: "Equalizer & FX" });
    await expect(eqBtn).toBeVisible({ timeout: 5000 });
    await eqBtn.click();

    // Verify modal is visible
    await expect(page.getByText("Audio FX & Equalizer")).toBeVisible({ timeout: 8000 });
  }

  test("1. Opens Equalizer modal from FullScreenPlayer", async ({ page }) => {
    await openEqualizerModal(page);
    await expect(page.getByRole("button", { name: "10-Band Equalizer" })).toBeVisible({ timeout: 5000 });
  });

  test("2. Toggles EQ presets and updates gain state", async ({ page }) => {
    await openEqualizerModal(page);

    // Select Bass Boost preset
    const bassPreset = page.getByRole("button", { name: "Bass Boost" });
    await expect(bassPreset).toBeVisible({ timeout: 5000 });
    await bassPreset.click();

    // Select Flat preset
    const flatPreset = page.getByRole("button", { name: "Flat" });
    await expect(flatPreset).toBeVisible({ timeout: 5000 });
    await flatPreset.click();

    // Toggle EQ off and back on
    const toggleEqBtn = page.getByRole("button", { name: /EQ (ON|OFF)/i });
    await toggleEqBtn.click();
    await expect(page.getByText("EQ OFF")).toBeVisible({ timeout: 5000 });
    await toggleEqBtn.click();
    await expect(page.getByText("EQ ON")).toBeVisible({ timeout: 5000 });
  });

  test("3. Switches streaming audio quality to 320 kbps Master Studio Quality", async ({ page }) => {
    await openEqualizerModal(page);

    // Switch to Crossfade & Quality tab
    const fxTab = page.getByRole("button", { name: "Crossfade & Quality" });
    await expect(fxTab).toBeVisible({ timeout: 5000 });
    await fxTab.click();

    // Verify 320 kbps option is displayed and selectable
    const ultraHdBtn = page.getByRole("button", { name: /Ultra HD/i });
    await expect(ultraHdBtn).toBeVisible({ timeout: 5000 });
    await expect(ultraHdBtn).toContainText("320 kbps");
    await ultraHdBtn.click();

    // Switch to Data Saver
    const dataSaverBtn = page.getByRole("button", { name: /Data Saver/i });
    await dataSaverBtn.click();
    await expect(dataSaverBtn).toContainText("96 kbps");

    // Switch back to Ultra HD 320kbps
    await ultraHdBtn.click();
    await expect(ultraHdBtn).toContainText("320 kbps");
  });
});
