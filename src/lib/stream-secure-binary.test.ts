import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { downloadVerifiedYtDlpBinary, isTrustedDownloadUrl } from "./stream.server";

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

  describe("isTrustedDownloadUrl", () => {
    it("accepts valid yt-dlp GitHub release download URLs", () => {
      expect(
        isTrustedDownloadUrl("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp")
      ).toBe(true);
      expect(
        isTrustedDownloadUrl("https://github.com/yt-dlp/yt-dlp/releases/download/2025.01.01/yt-dlp.exe")
      ).toBe(true);
    });

    it("rejects untrusted domains, HTTP protocol, and path traversal attempts", () => {
      expect(isTrustedDownloadUrl("http://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp")).toBe(false);
      expect(isTrustedDownloadUrl("https://evil-github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp")).toBe(false);
      expect(isTrustedDownloadUrl("https://github.com/attacker/yt-dlp/releases/latest/download/yt-dlp")).toBe(false);
      expect(isTrustedDownloadUrl("https://github.com/yt-dlp/other-repo/releases/latest/download/yt-dlp")).toBe(false);
      expect(isTrustedDownloadUrl("not-a-url")).toBe(false);
      expect(isTrustedDownloadUrl("javascript:alert(1)")).toBe(false);
    });
  });

  describe("downloadVerifiedYtDlpBinary security validations", () => {
    it("fails closed on unwhitelisted binary names or path traversal", async () => {
      const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "test-ytdlp-whitelist-"));
      createdDirs.push(testDir);

      expect(await downloadVerifiedYtDlpBinary(testDir, "../evil-bin", false)).toBeNull();
      expect(await downloadVerifiedYtDlpBinary(testDir, "yt-dlp.sh", false)).toBeNull();
      expect(await downloadVerifiedYtDlpBinary(testDir, "malicious.exe", false)).toBeNull();
      expect(await downloadVerifiedYtDlpBinary(testDir, "/etc/shadow", false)).toBeNull();
    });

    it("fails closed when fetch response fails (404 / 500)", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          headers: new Headers(),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          headers: new Headers(),
        } as unknown as Response);

      const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "test-ytdlp-fail-"));
      createdDirs.push(testDir);

      const res = await downloadVerifiedYtDlpBinary(testDir, "yt-dlp", false);
      expect(res).toBeNull();
    });

    it("fails closed when binary Content-Length header exceeds limit", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ "content-length": String(105 * 1024 * 1024) }), // 105 MB
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ "content-length": "100" }),
        } as unknown as Response);

      const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "test-ytdlp-oversized-header-"));
      createdDirs.push(testDir);

      const res = await downloadVerifiedYtDlpBinary(testDir, "yt-dlp", false);
      expect(res).toBeNull();
    });

    it("fails closed when binary buffer exceeds 100MB", async () => {
      // Mock arrayBuffer returning oversized payload without content-length header
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers(),
          arrayBuffer: async () => new Uint8Array(101 * 1024 * 1024).buffer,
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers(),
          text: async () => "",
        } as unknown as Response);

      const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "test-ytdlp-oversized-buf-"));
      createdDirs.push(testDir);

      const res = await downloadVerifiedYtDlpBinary(testDir, "yt-dlp", false);
      expect(res).toBeNull();
    });

    it("fails closed when binary is empty (0 bytes)", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers(),
          arrayBuffer: async () => new Uint8Array(0).buffer,
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers(),
          text: async () => "dummy",
        } as unknown as Response);

      const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "test-ytdlp-empty-"));
      createdDirs.push(testDir);

      const res = await downloadVerifiedYtDlpBinary(testDir, "yt-dlp", false);
      expect(res).toBeNull();
    });

    it("fails closed when SHA-256 format is invalid or missing", async () => {
      const fakeBinaryContent = Buffer.from("safe content");
      // Malformed SHA (not 64 hex chars)
      const fakeSums = "invalid-sha-hash  yt-dlp\n";

      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers(),
          arrayBuffer: async () => fakeBinaryContent.buffer,
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers(),
          text: async () => fakeSums,
        } as unknown as Response);

      const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "test-ytdlp-badsha-"));
      createdDirs.push(testDir);

      const res = await downloadVerifiedYtDlpBinary(testDir, "yt-dlp", false);
      expect(res).toBeNull();
      expect(fs.existsSync(path.join(testDir, "yt-dlp"))).toBe(false);
    });

    it("fails closed when SHA-256 checksum does not match expected release checksum", async () => {
      const fakeBinaryContent = Buffer.from("malicious binary content");
      const fakeSums = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  yt-dlp\n";

      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers(),
          arrayBuffer: async () => fakeBinaryContent.buffer,
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers(),
          text: async () => fakeSums,
        } as unknown as Response);

      const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "test-ytdlp-checksum-"));
      createdDirs.push(testDir);

      const res = await downloadVerifiedYtDlpBinary(testDir, "yt-dlp", false);
      expect(res).toBeNull();
      expect(fs.existsSync(path.join(testDir, "yt-dlp"))).toBe(false);
    });

    it("successfully writes binary and returns target path when SHA-256 matches exactly", async () => {
      const validContent = Buffer.from("valid yt-dlp binary executable placeholder");
      const sha256 = crypto.createHash("sha256").update(validContent).digest("hex");
      const validSums = `${sha256}  yt-dlp\n`;

      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers(),
          arrayBuffer: async () => Uint8Array.from(validContent).buffer,
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers(),
          text: async () => validSums,
        } as unknown as Response);

      const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "test-ytdlp-success-"));
      createdDirs.push(testDir);

      const res = await downloadVerifiedYtDlpBinary(testDir, "yt-dlp", true);
      expect(res).toBe(path.join(testDir, "yt-dlp"));
      expect(fs.existsSync(res!)).toBe(true);
      expect(fs.readFileSync(res!)).toEqual(validContent);
    });
  });
});
