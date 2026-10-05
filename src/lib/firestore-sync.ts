import {
  db,
  auth,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  deleteDoc,
  onSnapshot,
  type User,
} from "@/lib/firebase";
import type { Track, Playlist, RecSettings } from "@/lib/library";

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error:", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/** Sanitize track ID for Firestore doc ID, strictly matching ^[a-zA-Z0-9_\-]+$ and length <= 128 */
export function sanitizeTrackDocId(trackId: string): string {
  if (!trackId) return "track_" + Date.now();
  // Strictly allow only a-z, A-Z, 0-9, _, - to conform with firestore.rules
  const cleaned = trackId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
  return cleaned || "track_" + Date.now();
}

export async function syncUserProfile(user: User) {
  if (!user || !user.uid) return;
  const path = `users/${user.uid}`;
  try {
    const userRef = doc(db, "users", user.uid);
    await setDoc(
      userRef,
      {
        id: user.uid,
        email: user.email || null,
        displayName: (user.displayName || user.email?.split("@")[0] || "Listener").slice(0, 100),
        photoURL: user.photoURL ? user.photoURL.slice(0, 1000) : null,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    if (err instanceof Error && err.message.includes("permission-denied")) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
    console.warn("[Firestore] Failed to sync user profile:", err);
  }
}

/**
 * Fetch all liked songs for a user from Firestore.
 */
export async function fetchFirestoreLikes(uid: string): Promise<Track[]> {
  const path = `users/${uid}/likes`;
  try {
    const likesRef = collection(db, "users", uid, "likes");
    const snapshot = await getDocs(likesRef);
    const tracks: Track[] = [];
    snapshot.forEach((d) => {
      const data = d.data();
      if (data && data.id && data.title) {
        tracks.push({
          id: data.id,
          title: data.title,
          artist: data.artist || "Unknown Artist",
          thumbnail: data.thumbnail || "",
          duration: typeof data.duration === "number" ? data.duration : 0,
          previewUrl: data.previewUrl || undefined,
        });
      }
    });
    return tracks;
  } catch (err) {
    if (err instanceof Error && err.message.includes("permission-denied")) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
    console.warn("[Firestore] fetch likes error:", err);
    return [];
  }
}

/**
 * Persist a liked song to Firestore in the user's likes subcollection.
 */
export async function saveFirestoreLike(uid: string, track: Track): Promise<void> {
  if (!uid || !track || !track.id) return;
  const docId = sanitizeTrackDocId(track.id);
  const path = `users/${uid}/likes/${docId}`;
  try {
    const trackRef = doc(db, "users", uid, "likes", docId);
    await setDoc(trackRef, {
      id: track.id.slice(0, 128),
      userId: uid,
      title: (track.title || "Untitled").slice(0, 300),
      artist: (track.artist || "Unknown Artist").slice(0, 300),
      thumbnail: (track.thumbnail || "").slice(0, 500),
      duration: typeof track.duration === "number" ? track.duration : 0,
      previewUrl: track.previewUrl ? track.previewUrl.slice(0, 500) : null,
      addedAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("permission-denied")) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
    console.warn("[Firestore] save like error:", err);
  }
}

/**
 * Remove a liked song from Firestore.
 */
export async function removeFirestoreLike(uid: string, trackId: string): Promise<void> {
  if (!uid || !trackId) return;
  const docId = sanitizeTrackDocId(trackId);
  const path = `users/${uid}/likes/${docId}`;
  try {
    const trackRef = doc(db, "users", uid, "likes", docId);
    await deleteDoc(trackRef);
  } catch (err) {
    if (err instanceof Error && err.message.includes("permission-denied")) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
    console.warn("[Firestore] remove like error:", err);
  }
}

/**
 * Real-time listener for Liked Songs across devices.
 * Attaches an onSnapshot listener so that liking or unliking on one device
 * automatically updates all other devices in real-time.
 */
export function subscribeFirestoreLikes(
  uid: string,
  onUpdate: (tracks: Track[]) => void,
  onError?: (err: unknown) => void
): () => void {
  const path = `users/${uid}/likes`;
  const likesRef = collection(db, "users", uid, "likes");
  return onSnapshot(
    likesRef,
    (snapshot) => {
      const tracks: (Track & { addedAt?: string })[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (data && data.id && data.title) {
          tracks.push({
            id: data.id,
            title: data.title,
            artist: data.artist || "Unknown Artist",
            thumbnail: data.thumbnail || "",
            duration: typeof data.duration === "number" ? data.duration : 0,
            previewUrl: data.previewUrl || undefined,
            addedAt: data.addedAt,
          });
        }
      });
      tracks.sort((a, b) => {
        const timeA = a.addedAt ? new Date(a.addedAt).getTime() : 0;
        const timeB = b.addedAt ? new Date(b.addedAt).getTime() : 0;
        return timeB - timeA;
      });
      onUpdate(tracks);
    },
    (err) => {
      if (err instanceof Error && err.message.includes("permission-denied")) {
        handleFirestoreError(err, OperationType.LIST, path);
      }
      console.warn("[Firestore] subscribe likes error:", err);
      onError?.(err);
    }
  );
}

/**
 * Synchronize local liked tracks with Firestore:
 * - Fetches cloud likes
 * - Uploads any local likes missing in cloud to Firestore
 * - Returns the merged union
 */
export async function syncLikedSongsToFirestore(
  uid: string,
  localLikes: Track[]
): Promise<Track[]> {
  try {
    const cloudLikes = await fetchFirestoreLikes(uid);
    const cloudMap = new Map(cloudLikes.map((t) => [t.id, t]));

    // Upload local tracks that are not yet in the cloud
    const uploadPromises: Promise<void>[] = [];
    for (const localTrack of localLikes) {
      if (!cloudMap.has(localTrack.id)) {
        uploadPromises.push(saveFirestoreLike(uid, localTrack));
        cloudMap.set(localTrack.id, localTrack);
      }
    }
    if (uploadPromises.length > 0) {
      await Promise.allSettled(uploadPromises);
    }

    return Array.from(cloudMap.values());
  } catch (err) {
    console.warn("[Firestore] sync likes batch error:", err);
    return localLikes;
  }
}

export async function fetchFirestorePlaylists(uid: string): Promise<Playlist[]> {
  const path = `users/${uid}/playlists`;
  try {
    const playlistsRef = collection(db, "users", uid, "playlists");
    const snapshot = await getDocs(playlistsRef);
    const playlists: Playlist[] = [];
    snapshot.forEach((d) => {
      const data = d.data();
      if (data && data.id && data.name) {
        playlists.push({
          id: data.id,
          name: data.name,
          description: data.description || "",
          tracks: Array.isArray(data.tracks) ? data.tracks : [],
          createdAt: data.createdAt ? new Date(data.createdAt).getTime() : Date.now(),
        });
      }
    });
    return playlists;
  } catch (err) {
    if (err instanceof Error && err.message.includes("permission-denied")) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
    console.warn("[Firestore] fetch playlists error:", err);
    return [];
  }
}

export async function saveFirestorePlaylist(uid: string, playlist: Playlist) {
  const path = `users/${uid}/playlists/${playlist.id}`;
  try {
    const playlistRef = doc(db, "users", uid, "playlists", playlist.id);
    await setDoc(playlistRef, {
      id: playlist.id.slice(0, 128),
      userId: uid,
      name: playlist.name.slice(0, 100),
      description: playlist.description ? playlist.description.slice(0, 500) : "",
      tracks: playlist.tracks || [],
      updatedAt: new Date().toISOString(),
      createdAt: new Date(playlist.createdAt || Date.now()).toISOString(),
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("permission-denied")) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
    console.warn("[Firestore] save playlist error:", err);
  }
}

export async function deleteFirestorePlaylist(uid: string, playlistId: string) {
  const path = `users/${uid}/playlists/${playlistId}`;
  try {
    const playlistRef = doc(db, "users", uid, "playlists", playlistId);
    await deleteDoc(playlistRef);
  } catch (err) {
    if (err instanceof Error && err.message.includes("permission-denied")) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
    console.warn("[Firestore] delete playlist error:", err);
  }
}

export async function recordFirestoreHistory(uid: string, track: Track) {
  const historyId = `${Date.now()}_${track.id.slice(0, 16)}`;
  const path = `users/${uid}/history/${historyId}`;
  try {
    const histRef = doc(db, "users", uid, "history", historyId);
    await setDoc(histRef, {
      id: historyId,
      userId: uid,
      trackId: track.id.slice(0, 128),
      title: (track.title || "Untitled").slice(0, 300),
      artist: (track.artist || "Unknown Artist").slice(0, 300),
      thumbnail: (track.thumbnail || "").slice(0, 500),
      playedAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("permission-denied")) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
    console.warn("[Firestore] record history error:", err);
  }
}

export async function fetchFirestoreSettings(uid: string): Promise<Partial<RecSettings> | null> {
  const path = `users/${uid}/settings/preferences`;
  try {
    const settingsRef = doc(db, "users", uid, "settings", "preferences");
    const snap = await getDoc(settingsRef);
    if (snap.exists()) {
      return snap.data() as Partial<RecSettings>;
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("permission-denied")) {
      handleFirestoreError(err, OperationType.GET, path);
    }
    console.warn("[Firestore] fetch settings error:", err);
  }
  return null;
}

export async function saveFirestoreSettings(uid: string, settings: Partial<RecSettings>) {
  const path = `users/${uid}/settings/preferences`;
  try {
    const settingsRef = doc(db, "users", uid, "settings", "preferences");
    await setDoc(
      settingsRef,
      {
        userId: uid,
        ...settings,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    if (err instanceof Error && err.message.includes("permission-denied")) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
    console.warn("[Firestore] save settings error:", err);
  }
}
