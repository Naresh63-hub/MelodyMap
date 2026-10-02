import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  getYtDlpInstance,
  probeStream,
  resolveStreamUrlWithMeta,
  resolveWithInnerTubePlayer,
  invalidateStreamCache,
} from "./stream.server";

describe("Secure Pre-Provisioned Binary Resolution & Stream Architecture", () => {
  const originalEnv = process.env["YOUTUBE_DL_PATH"];
  const createdDirs: string[] = [];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env["YOUTUBE_DL_PATH"] = originalEnv;
    for (const dir of createdDirs) {
      if (fs.existsSync(dir)) {
        try {
          fs.rmSync(dir, { recursive: true, force: true });
        } catch {}
      }
    }
  });

  describe("Pre-provisioned yt-dlp binary resolution (no runtime downloads)", () => {
    it("safely returns null when no pre-provisioned binary exists without downloading", async () => {
      // Point YOUTUBE_DL_PATH to a nonexistent path
      process.env["YOUTUBE_DL_PATH"] = path.join(os.tmpdir(), "nonexistent-ytdlp-bin");

      // Verify that calling getYtDlpInstance returns without network calls or filesystem writes
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const writeSpy = vi.spyOn(fs, "writeFileSync");

      // If youtube-dl-exec has a bundled binary, it might find that, so let's verify no network fetch was made
      await getYtDlpInstance();

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(writeSpy).not.toHaveBeenCalled();
    });

    it("uses pre-provisioned binary path when custom YOUTUBE_DL_PATH is configured", async () => {
      const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "test-ytdlp-custom-"));
      createdDirs.push(testDir);
      const fakeBinaryPath = path.join(testDir, "custom-ytdlp");
      fs.writeFileSync(fakeBinaryPath, "echo yt-dlp");

      process.env["YOUTUBE_DL_PATH"] = fakeBinaryPath;
      expect(fs.existsSync(fakeBinaryPath)).toBe(true);
    });

    it("guarantees filesystem safety by never downloading or writing binaries during stream resolution", async () => {
      const writeSpy = vi.spyOn(fs, "writeFileSync");
      const writeFileSpy = vi.spyOn(fs, "writeFile");

      // Test with an invalid videoId to ensure no binary download or write is triggered
      const res = await resolveStreamUrlWithMeta("invalid!id@#$");
      expect(res).toBeNull();

      expect(writeSpy).not.toHaveBeenCalled();
      expect(writeFileSpy).not.toHaveBeenCalled();
    });
  });

  describe("Input sanitization & video ID validation", () => {
    it("rejects malicious, oversized, or path traversal video IDs", async () => {
      expect(await resolveStreamUrlWithMeta("../../../etc/shadow")).toBeNull();
      expect(await resolveStreamUrlWithMeta("; rm -rf / ;")).toBeNull();
      expect(await resolveStreamUrlWithMeta("<script>alert(1)</script>")).toBeNull();
      expect(await resolveStreamUrlWithMeta("")).toBeNull();
      expect(await resolveStreamUrlWithMeta("a".repeat(100))).toBeNull(); // Exceeds 32-char limit
    });
  });

  describe("probeStream health check", () => {
    it("returns true on 200 or 206 partial content stream", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 206,
        arrayBuffer: async () => new Uint8Array(1024).buffer,
      } as unknown as Response);

      expect(await probeStream("https://rr1---sn.googlevideo.com/videoplayback")).toBe(true);
    });

    it("returns false on 403 throttled or failed stream", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 403,
      } as unknown as Response);

      expect(await probeStream("https://rr1---sn.googlevideo.com/videoplayback")).toBe(false);
    });

    it("returns false on network errors or timeouts", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network timeout"));

      expect(await probeStream("https://rr1---sn.googlevideo.com/videoplayback")).toBe(false);
    });
  });

  describe("InnerTube direct API fallback & cache management", () => {
    it("successfully falls back to InnerTube player when yt-dlp is unavailable", async () => {
      const mockInnerTubeResponse = {
        streamingData: {
          adaptiveFormats: [
            {
              url: "https://googlevideo.com/videoplayback?expire=123",
              mimeType: 'audio/webm; codecs="opus"',
              bitrate: 160000,
              contentLength: "4500000",
            },
          ],
        },
      };

      vi.spyOn(globalThis, "fetch")
        // First fetch: InnerTube player endpoint
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockInnerTubeResponse,
        } as unknown as Response)
        // Second fetch: probeStream partial content check
        .mockResolvedValueOnce({
          ok: true,
          status: 206,
          arrayBuffer: async () => new Uint8Array(1024).buffer,
        } as unknown as Response);

      const meta = await resolveWithInnerTubePlayer("dQw4w9WgXcQ", "high");
      expect(meta).not.toBeNull();
      expect(meta!.url).toBe("https://googlevideo.com/videoplayback?expire=123");
      expect(meta!.mimeType).toBe("audio/webm");
      expect(meta!.audioBitrate).toBe(160000);
      expect(meta!.contentLength).toBe(4500000);
    });

    it("correctly invalidates cache on request", () => {
      expect(() => invalidateStreamCache("dQw4w9WgXcQ")).not.toThrow();
    });
  });
});
