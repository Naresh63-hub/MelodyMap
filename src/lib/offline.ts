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

/**
 * When free storage can't fit `neededBytes`, delete the oldest downloads
 * (never the one being saved) until there is enough headroom. Best-effort.
 */
async function evictOldestDownloadsIfNeeded(
  db: IDBDatabase,
  neededBytes: number,
  keepKey: string,
): Promise<void> {
  if (
    typeof navigator === "undefined" ||
    !("storage" in navigator) ||
    !("estimate" in navigator.storage)
  ) {
    return;
  }
  try {
    const est = await navigator.storage.estimate();
    const quota = est.quota ?? 0;
    const usage = est.usage ?? 0;
    const free = quota - usage;
    if (quota <= 0 || free >= neededBytes) return;

    // Gather download metadata only (skip deserializing audio blobs)
    const readTx = db.transaction(STORE, "readonly");
    const readStore = readTx.objectStore(STORE);
    const metas: Array<{ id: string; size: number; savedAt: number }> = [];
    await new Promise<void>((resolve, reject) => {
      const req = readStore.openCursor();
      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const val = cursor.value as DownloadRecord;
          metas.push({ id: val.id, size: val.size, savedAt: val.savedAt });
          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror = () => reject(req.error);
    });

    metas.sort((a, b) => a.savedAt - b.savedAt);
    let toFree = neededBytes - free;
    const deleteTx = db.transaction(STORE, "readwrite");
    const deleteStore = deleteTx.objectStore(STORE);
    for (const meta of metas) {
      if (toFree <= 0) break;
      if (meta.id === keepKey) continue;
      deleteStore.delete(meta.id);
      toFree -= meta.size;
    }
    await txDone(deleteTx);
    console.warn(
      "[MelodyMap] Storage low — evicted oldest offline downloads to make room for the new one",
    );
  } catch {
    // Eviction is best-effort; the save is still attempted afterwards
  }
}

function getDownloadKey(trackOrId: Track | string, source?: string): string {
  if (typeof trackOrId === "string") {
    return trackOrId;
  }
  const s = trackOrId.source || source || "yt";
  return `${s}:${trackOrId.id}`;
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

  const db = await openDb();

  // Keep storage headroom: if the free quota can't fit this download (plus
  // headroom), evict the oldest downloads first instead of failing mid-save.
  const needed = blob.size + (finalImageBlob?.size ?? 0) + 50 * 1024 * 1024;
  await evictOldestDownloadsIfNeeded(db, needed, getDownloadKey(track));

  const tx = db.transaction(STORE, "readwrite");
  const key = getDownloadKey(track);
  tx.objectStore(STORE).put({
    id: key,
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
    const store = tx.objectStore(STORE);
    // Try exact id, then source prefixed keys
    let rec = await request<DownloadRecord | undefined>(store.get(id));
    if (!rec && !id.includes(":")) {
      rec = (await request<DownloadRecord | undefined>(store.get(`yt:${id}`))) ||
            (await request<DownloadRecord | undefined>(store.get(`deezer:${id}`)));
    }
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

/**
 * List downloads using a lightweight cursor to avoid deserializing
 * all audio blobs into RAM at once.
 */
export async function listDownloads(): Promise<DownloadInfo[]> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const results: DownloadInfo[] = [];

    await new Promise<void>((resolve, reject) => {
      const req = store.openCursor();
      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const val = cursor.value as DownloadRecord;
          let localThumb = val.track.thumbnail;
          if (val.imageBlob) {
            try {
              localThumb = URL.createObjectURL(val.imageBlob);
            } catch {}
          }
          results.push({
            track: { ...val.track, thumbnail: localThumb },
            size: val.size,
            savedAt: val.savedAt,
          });
          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror = () => reject(req.error);
    });

    return results.sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export async function removeDownload(id: string): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    store.delete(id);
    if (!id.includes(":")) {
      store.delete(`yt:${id}`);
      store.delete(`deezer:${id}`);
    }
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
