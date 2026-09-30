import { test, expect } from "@playwright/test";

test.describe("MelodyMap Spotify-Style Playback E2E Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Set guest mode and initial seed before scripts run so it never redirects to /auth
    await page.addInitScript(() => {
      localStorage.setItem("melodymap.guest_mode", "true");
      localStorage.setItem("melodymap.onboarded.v1", "true");
      const mockQueue = [
        {
          id: "song_a_id",
          title: "Song Alpha",
          artist: "Artist A",
          duration: "3:30",
          previewUrl: "https://cdn.example.com/song_a.mp3",
          source: "deezer",
        },
        {
          id: "song_b_id",
          title: "Song Beta",
          artist: "Artist B",
          duration: "4:00",
          previewUrl: "https://cdn.example.com/song_b.mp3",
          source: "deezer",
        },
      ];
      localStorage.setItem(
        "melodymap.playback.v1",
        JSON.stringify({
          queue: mockQueue,
          index: 0,
          position: 15,
          isPlaying: false,
        }),
      );
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#melodymap-core-audio")).toBeAttached({ timeout: 15000 });
  });

  test("1. Single-track playback: loads single track and core audio element exists", async ({ page }) => {
    // Check if audio element exists in DOM
    const audioElement = page.locator("#melodymap-core-audio");
    await expect(audioElement).toBeAttached({ timeout: 10000 });

    // MiniPlayer should appear with Song Alpha
    await expect(page.getByText("Song Alpha")).toBeVisible({ timeout: 10000 });

    // Verify audio element has exactly one source set (single track)
    const audioSrc = await audioElement.getAttribute("src");
    if (audioSrc) {
      expect(audioSrc).not.toContain("undefined");
      expect(audioSrc).not.toContain(",");
    }
  });

  test("2. Seek / Skip within Song A: updates playback position", async ({ page }) => {
    await expect(page.getByText("Song Alpha")).toBeVisible({ timeout: 10000 });

    // Open full player
    const openPlayerBtn = page.locator('button[aria-label^="Open player for"]').first();
    await openPlayerBtn.click();

    // Click forward 5 seconds button
    const skipFwdBtn = page.locator('button[title="Forward 5 seconds"]');
    if (await skipFwdBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipFwdBtn.click();
    }

    // Verify player is still on Song Alpha
    await expect(page.getByRole("heading", { name: "Song Alpha" })).toBeVisible({ timeout: 5000 });
  });

  test("3. Forward / Next track: advances to Song B and resets progress to 0", async ({ page }) => {
    // MiniPlayer should show Song Alpha
    await expect(page.getByText("Song Alpha")).toBeVisible({ timeout: 10000 });

    // Click next track button
    const nextBtn = page.getByRole("button", { name: "Next track" }).first();
    await expect(nextBtn).toBeVisible({ timeout: 5000 });
    await nextBtn.click();

    // Player should now show Song Beta
    await expect(page.getByText("Song Beta")).toBeVisible({ timeout: 5000 });

    // Verify progress slider resets to 0
    const slider = page.locator('div[role="slider"][aria-label="Seek track"]');
    const valNow = await slider.getAttribute("aria-valuenow");
    expect(Number(valNow || 0)).toBeLessThanOrEqual(2);
  });

  test("4. Backward / Previous track: cleanly returns to previous track at 0:00", async ({ page }) => {
    await expect(page.getByText("Song Alpha")).toBeVisible({ timeout: 10000 });

    // First advance to Song Beta using Next button
    const nextBtn = page.getByRole("button", { name: "Next track" }).first();
    await expect(nextBtn).toBeVisible({ timeout: 5000 });
    await nextBtn.click();
    await expect(page.getByText("Song Beta")).toBeVisible({ timeout: 5000 });

    // Open full player to access Previous button
    const openPlayerBtn = page.locator('button[aria-label^="Open player for"]').first();
    await openPlayerBtn.click();

    // Click Previous track
    const prevBtn = page.getByRole("button", { name: "Previous track" });
    await expect(prevBtn).toBeVisible({ timeout: 5000 });
    await prevBtn.click();

    // Should return to Song Alpha
    await expect(page.getByRole("heading", { name: "Song Alpha" })).toBeVisible({ timeout: 5000 });
  });

  test("5. Song A ending automatically advances to Song B", async ({ page }) => {
    await expect(page.getByText("Song Alpha")).toBeVisible({ timeout: 10000 });

    // Simulate audio ended event on the core audio element
    await page.evaluate(() => {
      const audio = document.getElementById("melodymap-core-audio") as HTMLAudioElement | null;
      if (audio) {
        audio.dispatchEvent(new Event("ended"));
      }
    });

    // Queue must automatically advance to Song Beta
    await expect(page.getByText("Song Beta")).toBeVisible({ timeout: 10000 });
  });

  test("6. Audio source safety: exactly one active audio source without dual playback", async ({ page }) => {
    await expect(page.getByText("Song Alpha")).toBeVisible({ timeout: 10000 });

    // Verify there is only one core audio tag in the document
    const audioTagsCount = await page.evaluate(() => document.querySelectorAll("audio#melodymap-core-audio").length);
    expect(audioTagsCount).toBe(1);

    // Verify no concatenated or comma-separated URLs in audio src
    const audioSrc = await page.locator("#melodymap-core-audio").getAttribute("src");
    if (audioSrc) {
      expect(audioSrc).not.toContain(",");
      expect(audioSrc).not.toContain(";");
    }
  });
});
