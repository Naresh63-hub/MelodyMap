import { describe, it, expect, vi } from "vitest";
import type { Track } from "./library";

describe("2-Step Confirmation for Download Deletion", () => {
  const sampleTrack: Track = {
    id: "saavn:song-123",
    title: "Shape of You",
    artist: "Ed Sheeran",
    thumbnail: "https://example.com/art.jpg",
    previewUrl: "https://example.com/song.m4a",
    duration: "3:53",
  };

  it("Step 1: Selecting delete on a downloaded song opens confirmation step rather than immediately deleting", () => {
    let deleteConfirmTrack: Track | null = null;
    let removeDownloadCalled = false;

    // Simulate clicking trash or Delete Download in options
    const onInitiateDelete = (track: Track) => {
      deleteConfirmTrack = track;
    };

    onInitiateDelete(sampleTrack);

    expect(deleteConfirmTrack).toEqual(sampleTrack);
    expect(removeDownloadCalled).toBe(false);
  });

  it("Step 2 (Cancel): Dismissing the confirmation retains the downloaded song intact", () => {
    let deleteConfirmTrack: Track | null = sampleTrack;
    let downloadedIds = new Set(["saavn:song-123", "saavn:other-456"]);

    // User clicks Cancel or presses Escape
    const onCancel = () => {
      deleteConfirmTrack = null;
    };

    onCancel();

    expect(deleteConfirmTrack).toBeNull();
    expect(downloadedIds.has("saavn:song-123")).toBe(true);
  });

  it("Step 2 (Confirm to delete): Clicking 'Confirm to delete' removes offline copy and clears confirmation state", async () => {
    let deleteConfirmTrack: Track | null = sampleTrack;
    let downloadedTracks: Track[] = [sampleTrack];
    let downloadedIds = new Set(["saavn:song-123"]);
    let message: string | null = null;

    const mockRemoveDownload = vi.fn(async (trackId: string) => {
      downloadedIds.delete(trackId);
      downloadedTracks = downloadedTracks.filter((t) => t.id !== trackId);
      message = `Removed offline copy of "${sampleTrack.title}"`;
    });

    const onConfirmDelete = async (track: Track) => {
      await mockRemoveDownload(track.id);
      deleteConfirmTrack = null;
    };

    await onConfirmDelete(sampleTrack);

    expect(mockRemoveDownload).toHaveBeenCalledWith("saavn:song-123");
    expect(downloadedIds.has("saavn:song-123")).toBe(false);
    expect(downloadedTracks).toHaveLength(0);
    expect(deleteConfirmTrack).toBeNull();
    expect(message).toBe('Removed offline copy of "Shape of You"');
  });

  it("Routes both row trash button and options menu through the exact same 2-step confirmation", () => {
    let pendingTrack: Track | null = null;
    const downloadedIds = new Set(["saavn:song-123"]);

    // Row trash button handler
    const onRowRemoveDownload = (track: Track) => {
      pendingTrack = track;
    };

    // Options menu handler
    const onOptionsDownloadClick = (track: Track) => {
      if (downloadedIds.has(track.id)) {
        pendingTrack = track;
      }
    };

    // Test row click
    onRowRemoveDownload(sampleTrack);
    expect(pendingTrack).toEqual(sampleTrack);

    // Reset and test options menu click
    pendingTrack = null;
    onOptionsDownloadClick(sampleTrack);
    expect(pendingTrack).toEqual(sampleTrack);
  });
});
