import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { downloadVerifiedYtDlpBinary } from "./stream.server";

describe("Secure yt-dlp binary download and verification", () => {
  const createdDirs: string[] = [];

  afterEach(() => {
    for (const dir of createdDirs) {
      if (fs.existsSync(dir)) {
        try {
          fs.rmSync(dir, { recursive: true, force: true });
        } catch {}
      }
    }
    vi.restoreAllMocks();
  });

  it("fails closed when fetch response fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as any);

    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "test-ytdlp-fail-"));
    createdDirs.push(testDir);

    const res = await downloadVerifiedYtDlpBinary(testDir, "yt-dlp", false);
    expect(res).toBeNull();
  });

  it("fails closed when SHA-256 checksum does not match expected release checksum", async () => {
    const fakeBinaryContent = Buffer.from("malicious binary content");
    // Expected checksum does not match sha256 of fakeBinaryContent
    const fakeSums = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  yt-dlp\n";

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => fakeBinaryContent.buffer,
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        text: async () => fakeSums,
      } as any);

    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "test-ytdlp-checksum-"));
    createdDirs.push(testDir);

    const res = await downloadVerifiedYtDlpBinary(testDir, "yt-dlp", false);
    expect(res).toBeNull();
    // Verify file was never written
    expect(fs.existsSync(path.join(testDir, "yt-dlp"))).toBe(false);
  });
});
