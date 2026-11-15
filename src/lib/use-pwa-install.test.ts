import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { usePwaInstall } from "./use-pwa-install";
import { getDirectApkRelease, CURRENT_APP_VERSION } from "./app-update";

describe("PWA and In-App APK Install Engine", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("usePwaInstall hook logic", () => {
    it("is exported as a function", () => {
      expect(typeof usePwaInstall).toBe("function");
    });
  });

  describe("getDirectApkRelease", () => {
    it("generates direct APK details matching the current app version", () => {
      const release = getDirectApkRelease();
      expect(release.version).toBe(CURRENT_APP_VERSION);
      expect(release.name).toContain(CURRENT_APP_VERSION);
      expect(release.apkAsset.name).toContain(".apk");
      expect(release.apkAsset.downloadUrl).toContain("/MelodyMap-latest.apk");
      expect(release.apkAsset.size).toBe(21171295);
    });

    it("includes rich changelog notes for in-app display", () => {
      const release = getDirectApkRelease();
      expect(release.notes).toContain("Zero song overlap");
      expect(release.notes).toContain("Daily Mix");
      expect(release.notes).toContain("Made For You");
    });
  });
});
