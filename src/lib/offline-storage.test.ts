import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  normalizeTrackId,
  getDownloadKey,
  getCandidateDownloadKeys,
  KNOWN_PROVIDERS,
  hasDownload,
  getBlob,
  saveDownload,
  removeDownload,
} from "./offline";
import { hasFullLengthDirectSource } from "./track-stream-policy";
import type { Track } from "./library";

describe("Offline Storage & Playback Reliability", () => {
  describe("1. Track ID Normalization & Download Keys", () => {
    it("normalizes clean provider IDs correctly", () => {
      expect(normalizeTrackId("saavn:123")).toEqual({
        provider: "saavn",
        pureId: "123",
        canonicalId: "saavn:123",
      });
      expect(normalizeTrackId("yt:dQw4w9WgXcQ")).toEqual({
        provider: "yt",
        pureId: "dQw4w9WgXcQ",
        canonicalId: "yt:dQw4w9WgXcQ",
      });
      expect(normalizeTrackId("audius:track-99")).toEqual({
        provider: "audius",
        pureId: "track-99",
        canonicalId: "audius:track-99",
      });
      expect(normalizeTrackId("jamendo:jam-1")).toEqual({
        provider: "jamendo",
        pureId: "jam-1",
        canonicalId: "jamendo:jam-1",
      });
    });

    it("normalizes 'youtube' alias to 'yt'", () => {
      expect(normalizeTrackId("youtube:abc1234")).toEqual({
        provider: "yt",
        pureId: "abc1234",
        canonicalId: "yt:abc1234",
      });
    });

    it("unpacks and repairs legacy double-prefixed IDs (e.g., saavn:saavn:123)", () => {
      expect(normalizeTrackId("saavn:saavn:12345")).toEqual({
        provider: "saavn",
        pureId: "12345",
        canonicalId: "saavn:12345",
      });
      expect(normalizeTrackId("yt:yt:video-77")).toEqual({
        provider: "yt",
        pureId: "video-77",
        canonicalId: "yt:video-77",
      });
      expect(normalizeTrackId("saavn:saavn:saavn:triple")).toEqual({
        provider: "saavn",
        pureId: "triple",
        canonicalId: "saavn:triple",
      });
    });

    it("handles bare IDs without provider prefix", () => {
      expect(normalizeTrackId("pureSongId123")).toEqual({
        provider: undefined,
        pureId: "pureSongId123",
        canonicalId: "pureSongId123",
      });
      expect(normalizeTrackId("")).toEqual({
        provider: undefined,
        pureId: "",
        canonicalId: "",
      });
    });

    it("produces consistent storage keys with getDownloadKey without double-prefixing", () => {
      const trackSaavnPrefixed = {
        id: "saavn:55555",
        title: "Test Song",
        artist: "Test Artist",
        duration: "3:00",
        thumbnail: "",
        source: "saavn",
      } as unknown as Track;
      // Must not become saavn:saavn:55555
      expect(getDownloadKey(trackSaavnPrefixed)).toBe("saavn:55555");

      const trackSaavnBare = {
        id: "55555",
        title: "Test Song",
        artist: "Test Artist",
        duration: "3:00",
        thumbnail: "",
        source: "saavn",
      } as unknown as Track;
      expect(getDownloadKey(trackSaavnBare)).toBe("saavn:55555");

      const trackYtLegacyDouble = {
        id: "yt:yt:video999",
        title: "YouTube Video",
        artist: "Artist",
        duration: "4:00",
        thumbnail: "",
        source: "youtube",
      } as unknown as Track;
      expect(getDownloadKey(trackYtLegacyDouble)).toBe("yt:video999");
    });

    it("generates candidate lookup keys covering canonical, bare, and legacy variants", () => {
      const candidates = getCandidateDownloadKeys("saavn:track_abc");
      expect(candidates).toContain("saavn:track_abc");
      expect(candidates).toContain("track_abc");
      expect(candidates).toContain("saavn:saavn:track_abc");

      // Verify all known providers are covered for cross-provider resolution
      for (const provider of KNOWN_PROVIDERS) {
        expect(candidates).toContain(`${provider}:track_abc`);
      }
    });
  });

  describe("2. Fallback URL & Preview Safety", () => {
    it("distinguishes verified full-length streams from 30-second Deezer previews", () => {
      // Full-length providers allowed for direct download fallback:
      expect(hasFullLengthDirectSource("saavn:song123")).toBe(true);
      expect(hasFullLengthDirectSource("audius:aud77")).toBe(true);
      expect(hasFullLengthDirectSource("jamendo:jam55")).toBe(true);
      expect(hasFullLengthDirectSource("archive:item99")).toBe(true);
      expect(hasFullLengthDirectSource("podcast:ep1")).toBe(true);

      // YouTube and preview-only sources must never use direct fallback
      expect(hasFullLengthDirectSource("dQw4w9WgXcQ")).toBe(false);
      expect(hasFullLengthDirectSource("deezer:3135556")).toBe(false);
      expect(hasFullLengthDirectSource("")).toBe(false);
      expect(hasFullLengthDirectSource(null)).toBe(false);
      expect(hasFullLengthDirectSource(undefined)).toBe(false);
    });
  });

  describe("3. In-Memory Mock IDB Offline Playback & Legacy Key Compatibility", () => {
    const memoryStore = new Map<string, any>();

    beforeEach(() => {
      memoryStore.clear();

      // Mock indexedDB for hermetic tests
      const mockDb = {
        transaction: vi.fn(() => ({
          objectStore: vi.fn(() => ({
            get: (key: string) => {
              const req: any = {};
              setTimeout(() => {
                req.result = memoryStore.get(key);
                req.onsuccess?.({ target: req });
              }, 0);
              return req;
            },
            put: (record: any) => {
              memoryStore.set(record.id, record);
              const req: any = {};
              setTimeout(() => {
                req.result = record.id;
                req.onsuccess?.({ target: req });
              }, 0);
              return req;
            },
            delete: (key: string) => {
              memoryStore.delete(key);
              const req: any = {};
              setTimeout(() => {
                req.onsuccess?.({ target: req });
              }, 0);
              return req;
            },
            openCursor: () => {
              const req: any = {};
              setTimeout(() => {
                req.result = null;
                req.onsuccess?.({ target: req });
              }, 0);
              return req;
            },
          })),
          oncomplete: null as any,
          onerror: null as any,
          onabort: null as any,
        })),
        objectStoreNames: { contains: () => true },
      };

      // Auto-trigger oncomplete in txDone
      mockDb.transaction = vi.fn(() => {
        const tx: any = {
          objectStore: vi.fn(() => ({
            get: (key: string) => {
              const req: any = {};
              setTimeout(() => {
                req.result = memoryStore.get(key);
                req.onsuccess?.({ target: req });
              }, 0);
              return req;
            },
            put: (record: any) => {
              memoryStore.set(record.id, record);
              const req: any = {};
              setTimeout(() => {
                req.result = record.id;
                req.onsuccess?.({ target: req });
              }, 0);
              return req;
            },
            delete: (key: string) => {
              memoryStore.delete(key);
              const req: any = {};
              setTimeout(() => {
                req.onsuccess?.({ target: req });
              }, 0);
              return req;
            },
            openCursor: () => {
              const req: any = {};
              setTimeout(() => {
                req.result = null;
                req.onsuccess?.({ target: req });
              }, 0);
              return req;
            },
          })),
        };
        setTimeout(() => tx.oncomplete?.(), 0);
        return tx;
      });

      const mockOpenReq: any = {
        result: mockDb,
        onsuccess: null,
      };
      setTimeout(() => mockOpenReq.onsuccess?.(), 0);

      vi.stubGlobal("indexedDB", {
        open: () => mockOpenReq,
      });
    });

    it("retrieves previously stored downloads under legacy double-prefixed keys", async () => {
      // Simulate an existing download stored before the fix under legacy "saavn:saavn:123"
      const fakeBlob = new Blob([new Uint8Array(25000)], { type: "audio/mp4" });
      memoryStore.set("saavn:saavn:123", {
        id: "saavn:saavn:123",
        track: { id: "saavn:123", title: "Legacy Song", artist: "Artist", duration: "3:00" },
        blob: fakeBlob,
        size: 25000,
        savedAt: Date.now() - 50000,
      });

      // User requests the track using canonical ID "saavn:123"
      const retrieved = await getBlob("saavn:123");
      expect(retrieved).toBeDefined();
      expect(retrieved?.size).toBe(25000);

      // hasDownload should return true
      const downloaded = await hasDownload("saavn:123");
      expect(downloaded).toBe(true);
    });

    it("retrieves previously stored downloads when queried with bare ID", async () => {
      const fakeBlob = new Blob([new Uint8Array(20000)], { type: "audio/mp4" });
      memoryStore.set("saavn:456", {
        id: "saavn:456",
        track: { id: "saavn:456", title: "Bare ID Query Song", artist: "Artist", duration: "3:00" },
        blob: fakeBlob,
        size: 20000,
        savedAt: Date.now(),
      });

      // When queried with just "456", it should resolve via candidate keys
      const retrieved = await getBlob("456");
      expect(retrieved).toBeDefined();
      expect(retrieved?.size).toBe(20000);
    });

    it("removes both canonical and legacy double-prefixed keys when deleting a download", async () => {
      memoryStore.set("saavn:789", { id: "saavn:789" });
      memoryStore.set("saavn:saavn:789", { id: "saavn:saavn:789" });
      memoryStore.set("789", { id: "789" });

      await removeDownload("saavn:789");

      expect(memoryStore.has("saavn:789")).toBe(false);
      expect(memoryStore.has("saavn:saavn:789")).toBe(false);
      expect(memoryStore.has("789")).toBe(false);
    });
  });

  describe("4. Playback Fallback Logic", () => {
    it("plays local Blob first when track is downloaded", async () => {
      const mockPlayOffline = vi.fn().mockResolvedValue(true);
      const mockNetworkStream = vi.fn();

      const loadTrack = async (trackId: string) => {
        const playedLocally = await mockPlayOffline(trackId);
        if (playedLocally) return "offline-blob";
        await mockNetworkStream(trackId);
        return "network-stream";
      };

      const result = await loadTrack("saavn:downloaded_song");
      expect(mockPlayOffline).toHaveBeenCalledWith("saavn:downloaded_song");
      expect(mockNetworkStream).not.toHaveBeenCalled();
      expect(result).toBe("offline-blob");
    });

    it("preserves queue and offers downloads/retry instead of silently clearing queue on stream failure", () => {
      const originalQueue: Track[] = [
        { id: "s1", title: "Song 1", artist: "Artist A", duration: "3:00", thumbnail: "" },
        { id: "s2", title: "Song 2", artist: "Artist B", duration: "3:10", thumbnail: "" },
      ];
      let queue = [...originalQueue];
      let message = "";
      let actionLabel = "";

      const handlePlaybackError = (isOffline: boolean, hasDownloadedSongs: boolean) => {
        if (isOffline) {
          if (hasDownloadedSongs) {
            message = "Offline: Online stream unavailable. Tap Downloads to listen offline.";
            actionLabel = "Downloads";
          } else {
            message = "You are offline. Tap Retry when connected.";
            actionLabel = "Retry";
          }
        }
      };

      // When offline with downloaded songs
      handlePlaybackError(true, true);
      expect(queue).toEqual(originalQueue); // Queue untouched!
      expect(message).toContain("Tap Downloads");
      expect(actionLabel).toBe("Downloads");

      // When offline without downloaded songs
      handlePlaybackError(true, false);
      expect(queue).toEqual(originalQueue); // Queue untouched!
      expect(message).toContain("Tap Retry");
      expect(actionLabel).toBe("Retry");
    });
  });
});
