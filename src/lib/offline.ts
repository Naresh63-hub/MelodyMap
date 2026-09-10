import type { Track } from "@/lib/library";

/**
 * Offline music storage. Downloads are saved as blobs in IndexedDB so
 * songs keep playing with no connection. The bytes come from our own
 * /api/stream/:videoId proxy because YouTube's stream URLs don't allow
 * cross-origin reads.
 */

const DB_NAME = "melodymap-offline";
const DB_VERSION = 1;
const STORE = "tracks";

type DownloadRecord = {
  id: string;
  track: Track;
  blob: Blob;
  imageBlob?: Blob | undefined;
  size: number;
  savedAt: number;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB unavailable"));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null; // allow retry
      reject(req.error);
    };
  });
  return dbPromise;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function saveDownload(track: Track, blob: Blob, imageBlob?: Blob): Promise<void> {
  let finalImageBlob = imageBlob;
  if (!finalImageBlob && track.thumbnail && track.thumbnail.startsWith("http")) {
    try {
      const imgRes = await fetch(track.thumbnail);
      if (imgRes.ok) finalImageBlob = await imgRes.blob();
    } catch {
      // image caching is best-effort
    }
  }

  // Check storage quota before saving
  if (typeof navigator !== "undefined" && "storage" in navigator && "estimate" in navigator.storage) {
    try {
      const est = await navigator.storage.estimate();
      const quota = est.quota ?? 0;
      const usage = est.usage ?? 0;
      if (quota > 0 && quota - usage < blob.size + 100 * 1024 * 1024) {
        console.warn("[MelodyMap] Storage running low:", formatBytes(quota - usage), "remaining");
      }
    } catch {
      // Quota check is best-effort
    }
  }
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put({
    id: track.id,
    track,
    blob,
    imageBlob: finalImageBlob,
    size: blob.size + (finalImageBlob?.size ?? 0),
    savedAt: Date.now(),
  } satisfies DownloadRecord);
  await txDone(tx);
}

export async function getBlob(id: string): Promise<Blob | null> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readonly");
    const rec = await request<DownloadRecord | undefined>(tx.objectStore(STORE).get(id));
    return rec?.blob ?? null;
  } catch (err) {
    console.warn("[MelodyMap] getBlob failed for", id, err);
    return null;
  }
}

export type DownloadInfo = {
  track: Track;
  size: number;
  savedAt: number;
};

export async function listDownloads(): Promise<DownloadInfo[]> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readonly");
    const all = await request<DownloadRecord[]>(tx.objectStore(STORE).getAll());
    return (all ?? [])
      .map(({ track, blob, imageBlob, size, savedAt }) => {
        let localThumb = track.thumbnail;
        if (imageBlob) {
          try {
            localThumb = URL.createObjectURL(imageBlob);
          } catch {}
        }
        return {
          track: { ...track, thumbnail: localThumb },
          size,
          savedAt,
        };
      })
      .sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export async function removeDownload(id: string): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    await txDone(tx);
  } catch (err) {
    console.warn("[MelodyMap] removeDownload failed for", id, err);
  }
}

export async function clearDownloads(): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    await txDone(tx);
  } catch (err) {
    console.warn("[MelodyMap] clearDownloads failed:", err);
  }
}

export async function totalDownloadSize(): Promise<number> {
  const list = await listDownloads();
  return list.reduce((acc, d) => acc + d.size, 0);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Fetches a song through our proxy and stores it offline, with progress. */
export async function downloadTrack(
  track: Track,
  onProgress?: (percent: number) => void,
): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5 min timeout

  try {
    const res = await fetch(`/api/stream/${encodeURIComponent(track.id)}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    const total = Number(res.headers.get("content-length")) || 0;

    if (!res.body) {
      const blob = await res.blob();
      await saveDownload(track, blob);
      return;
    }

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.byteLength;
        if (total > 0 && onProgress) onProgress(Math.round((received / total) * 100));
      }
    }

    const type = res.headers.get("content-type") ?? "audio/mp4";
    const merged = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    await saveDownload(track, new Blob([merged], { type }));
  } catch (err) {
    clearTimeout(timeoutId);
    if ((err as Error).name === "AbortError") {
      throw new Error("Download timed out");
    }
    throw err;
  }
}
