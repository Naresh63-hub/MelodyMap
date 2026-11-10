import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  cleanSemver,
  compareSemver,
  formatBytes,
  getCurrentAppVersion,
  fetchLatestApkRelease,
  checkForAppUpdate,
  dismissUpdate,
  startDownloadAndInstall,
  CURRENT_APP_VERSION,
} from "./app-update";
import { safeStorage } from "./safe-storage";

type WindowMock = {
  AndroidUpdate?: {
    getInstalledVersion?: () => string;
    canRequestPackageInstalls?: () => boolean;
    openInstallPermissionSettings?: () => void;
    downloadAndInstall?: (apkUrl: string, versionName: string) => void;
  };
  __melodymap_update_progress?: (progress: number, status?: string) => void;
  __melodymap_update_complete?: () => void;
  __melodymap_update_error?: (error: string) => void;
  __melodymap_update_permission_needed?: () => void;
};

let originalWindow: any;

function setGlobalWindow(mock: WindowMock | undefined): void {
  (globalThis as unknown as { window?: WindowMock | undefined }).window = mock;
}

describe("In-App Update Engine (app-update.ts)", () => {
  beforeEach(() => {
    if (originalWindow === undefined) {
      originalWindow = (globalThis as any).window;
    }
    safeStorage.clear();
    vi.restoreAllMocks();
    setGlobalWindow({});
  });

  afterEach(() => {
    safeStorage.clear();
    vi.restoreAllMocks();
    if (originalWindow !== undefined) {
      (globalThis as any).window = originalWindow;
    } else {
      delete (globalThis as any).window;
    }
  });

  describe("Semver parsing and comparison", () => {
    it("cleans diverse semver tag strings correctly", () => {
      expect(cleanSemver("v1.4.0")).toBe("1.4.0");
      expect(cleanSemver("1.3.8")).toBe("1.3.8");
      expect(cleanSemver("v1.5-beta")).toBe("1.5.0");
      expect(cleanSemver("2")).toBe("2.0.0");
      expect(cleanSemver("")).toBe("0.0.0");
    });

    it("compares versions accurately", () => {
      // Newer
      expect(compareSemver("1.4.0", "1.3.8")).toBe(1);
      expect(compareSemver("v1.3.9", "1.3.8")).toBe(1);
      expect(compareSemver("2.0.0", "1.9.9")).toBe(1);
      expect(compareSemver("1.3.10", "1.3.9")).toBe(1);

      // Older
      expect(compareSemver("1.3.7", "1.3.8")).toBe(-1);
      expect(compareSemver("1.2.9", "1.3.0")).toBe(-1);

      // Equal
      expect(compareSemver("1.3.8", "1.3.8")).toBe(0);
      expect(compareSemver("v1.3.8", "1.3.8")).toBe(0);
    });

    it("formats byte counts into human-readable MB strings", () => {
      expect(formatBytes(1024 * 1024 * 18.5)).toBe("18.5 MB");
      expect(formatBytes(0)).toBe("");
      expect(formatBytes(-100)).toBe("");
    });
  });

  describe("getCurrentAppVersion", () => {
    it("falls back to CURRENT_APP_VERSION when native bridges are absent", async () => {
      const ver = await getCurrentAppVersion();
      expect(ver).toBe(CURRENT_APP_VERSION);
    });

    it("prefers native AndroidUpdate bridge version if available", async () => {
      setGlobalWindow({
        AndroidUpdate: {
          getInstalledVersion: () => "1.3.9",
        },
      });

      const ver = await getCurrentAppVersion();
      expect(ver).toBe("1.3.9");
    });
  });

  describe("fetchLatestApkRelease", () => {
    it("ignores releases without an APK asset (strict check)", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            tag_name: "v1.4.0",
            name: "Release without APK",
            body: "Pushed changes only",
            published_at: "2026-11-09T10:00:00Z",
            draft: false,
            assets: [
              {
                name: "source-code.zip",
                size: 100000,
                browser_download_url: "https://github.com/test/source.zip",
              },
            ],
          },
        ],
      });

      const release = await fetchLatestApkRelease();
      expect(release).toBeNull();
    });

    it("ignores draft releases even if they contain APK assets", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            tag_name: "v1.5.0",
            name: "Draft Release",
            draft: true,
            assets: [
              {
                name: "MelodyMap-v1.5.0.apk",
                size: 20000000,
                browser_download_url: "https://github.com/test/draft.apk",
              },
            ],
          },
        ],
      });

      const release = await fetchLatestApkRelease();
      expect(release).toBeNull();
    });

    it("successfully selects the first published release containing a built APK asset", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            tag_name: "v1.4.1",
            name: "Web only release",
            draft: false,
            assets: [], // No APK
          },
          {
            tag_name: "v1.4.0",
            name: "MelodyMap v1.4.0",
            body: "- Lock screen Like button\n- Audio performance upgrade",
            published_at: "2026-11-09T12:00:00Z",
            draft: false,
            assets: [
              {
                name: "MelodyMap-v1.4.0.apk",
                size: 22500000,
                browser_download_url: "https://github.com/Naresh63-hub/MelodyMap/releases/download/v1.4.0/MelodyMap-v1.4.0.apk",
              },
            ],
          },
        ],
      });

      const release = await fetchLatestApkRelease();
      expect(release).not.toBeNull();
      expect(release?.version).toBe("1.4.0");
      expect(release?.tagName).toBe("v1.4.0");
      expect(release?.apkAsset.name).toBe("MelodyMap-v1.4.0.apk");
      expect(release?.apkAsset.downloadUrl).toContain("MelodyMap-v1.4.0.apk");
    });
  });

  describe("checkForAppUpdate", () => {
    it("reports update available when remote version > current version", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            tag_name: "v1.4.0",
            name: "MelodyMap v1.4.0",
            body: "Great new features!",
            published_at: "2026-11-09T12:00:00Z",
            draft: false,
            assets: [
              {
                name: "MelodyMap-v1.4.0.apk",
                size: 20000000,
                browser_download_url: "https://github.com/Naresh63-hub/MelodyMap/releases/download/v1.4.0/app.apk",
              },
            ],
          },
        ],
      });

      const result = await checkForAppUpdate({ force: true });
      expect(result.isUpdateAvailable).toBe(true);
      expect(result.latestRelease?.version).toBe("1.4.0");
      expect(result.currentVersion).toBe(CURRENT_APP_VERSION);
    });

    it("reports no update available when remote version <= current version", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            tag_name: "v1.3.10",
            name: "MelodyMap v1.3.10",
            published_at: "2026-10-06T12:00:00Z",
            draft: false,
            assets: [
              {
                name: "MelodyMap-v1.3.10.apk",
                size: 20000000,
                browser_download_url: "https://github.com/Naresh63-hub/MelodyMap/releases/download/v1.3.10/app.apk",
              },
            ],
          },
        ],
      });

      const result = await checkForAppUpdate({ force: true });
      expect(result.isUpdateAvailable).toBe(false);
      expect(result.latestRelease).toBeNull();
    });

    it("respects 24-hour dismissal unless force check is requested", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            tag_name: "v1.4.0",
            draft: false,
            assets: [
              {
                name: "app.apk",
                size: 20000000,
                browser_download_url: "https://test.apk",
              },
            ],
          },
        ],
      });

      // User dismissed 1.4.0
      dismissUpdate("1.4.0");

      // Background check (force: false) should suppress update
      const bgCheck = await checkForAppUpdate({ force: false });
      expect(bgCheck.isUpdateAvailable).toBe(false);

      // Manual check from settings (force: true) must show update
      const manualCheck = await checkForAppUpdate({ force: true });
      expect(manualCheck.isUpdateAvailable).toBe(true);
    });
  });

  describe("startDownloadAndInstall (Option B & Fallback)", () => {
    it("calls window.AndroidUpdate bridge when available (native Option B)", () => {
      const mockDownload = vi.fn();
      const winMock: WindowMock = {
        AndroidUpdate: {
          downloadAndInstall: mockDownload,
        },
      };
      setGlobalWindow(winMock);

      const onProgress = vi.fn();
      startDownloadAndInstall("https://test.apk", "1.4.0", { onProgress });

      expect(mockDownload).toHaveBeenCalledWith("https://test.apk", "1.4.0");
      expect(typeof winMock.__melodymap_update_progress).toBe("function");

      // Verify callback dispatch
      winMock.__melodymap_update_progress!(45, "Downloading (45%)...");
      expect(onProgress).toHaveBeenCalledWith(45, "Downloading (45%)...");
    });

    it("triggers browser download fallback when running outside native bridge", () => {
      const clickMock = vi.fn();
      const appendMock = vi.fn();
      const removeMock = vi.fn();

      const docMock = {
        createElement: vi.fn().mockReturnValue({
          click: clickMock,
          setAttribute: vi.fn(),
        }),
        body: {
          appendChild: appendMock,
          removeChild: removeMock,
        },
      };
      (globalThis as unknown as { document?: typeof docMock }).document = docMock;

      const onProgress = vi.fn();
      startDownloadAndInstall("https://test.apk", "1.4.0", { onProgress });

      expect(docMock.createElement).toHaveBeenCalledWith("a");
      expect(appendMock).toHaveBeenCalled();
      expect(clickMock).toHaveBeenCalled();
      expect(removeMock).toHaveBeenCalled();
      expect(onProgress).toHaveBeenCalledWith(50, "Downloading update...");

      (globalThis as unknown as { document?: unknown }).document = undefined;
    });
  });
});
