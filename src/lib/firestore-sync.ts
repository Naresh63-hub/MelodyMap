import {
  db,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  deleteDoc,
  type User,
} from "@/lib/firebase";
import type { Track, Playlist, RecSettings } from "@/lib/library";

export async function syncUserProfile(user: User) {
  if (!user || !user.uid) return;
  try {
    const userRef = doc(db, "users", user.uid);
    await setDoc(
      userRef,
      {
        id: user.uid,
        email: user.email || null,
        displayName: user.displayName || user.email?.split("@")[0] || "Listener",
        photoURL: user.photoURL || null,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn("[Firestore] Failed to sync user profile:", err);
  }
}

export async function fetchFirestoreLikes(uid: string): Promise<Track[]> {
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
          duration: data.duration || 0,
          previewUrl: data.previewUrl || undefined,
        });
      }
    });
    return tracks;
  } catch (err) {
    console.warn("[Firestore] fetch likes error:", err);
    return [];
  }
}

export async function saveFirestoreLike(uid: string, track: Track) {
  try {
    const trackRef = doc(db, "users", uid, "likes", track.id);
    await setDoc(trackRef, {
      id: track.id,
      userId: uid,
      title: track.title,
      artist: track.artist,
      thumbnail: track.thumbnail || "",
      duration: track.duration || 0,
      previewUrl: track.previewUrl || null,
      addedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[Firestore] save like error:", err);
  }
}

export async function removeFirestoreLike(uid: string, trackId: string) {
  try {
    const trackRef = doc(db, "users", uid, "likes", trackId);
    await deleteDoc(trackRef);
  } catch (err) {
    console.warn("[Firestore] remove like error:", err);
  }
}

export async function fetchFirestorePlaylists(uid: string): Promise<Playlist[]> {
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
    console.warn("[Firestore] fetch playlists error:", err);
    return [];
  }
}

export async function saveFirestorePlaylist(uid: string, playlist: Playlist) {
  try {
    const playlistRef = doc(db, "users", uid, "playlists", playlist.id);
    await setDoc(playlistRef, {
      id: playlist.id,
      userId: uid,
      name: playlist.name,
      description: playlist.description || "",
      tracks: playlist.tracks || [],
      updatedAt: new Date().toISOString(),
      createdAt: new Date(playlist.createdAt || Date.now()).toISOString(),
    });
  } catch (err) {
    console.warn("[Firestore] save playlist error:", err);
  }
}

export async function deleteFirestorePlaylist(uid: string, playlistId: string) {
  try {
    const playlistRef = doc(db, "users", uid, "playlists", playlistId);
    await deleteDoc(playlistRef);
  } catch (err) {
    console.warn("[Firestore] delete playlist error:", err);
  }
}

export async function recordFirestoreHistory(uid: string, track: Track) {
  try {
    const historyId = `${Date.now()}_${track.id.slice(0, 16)}`;
    const histRef = doc(db, "users", uid, "history", historyId);
    await setDoc(histRef, {
      id: historyId,
      userId: uid,
      trackId: track.id,
      title: track.title,
      artist: track.artist,
      thumbnail: track.thumbnail || "",
      playedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[Firestore] record history error:", err);
  }
}

export async function fetchFirestoreSettings(uid: string): Promise<Partial<RecSettings> | null> {
  try {
    const settingsRef = doc(db, "users", uid, "settings", "preferences");
    const snap = await getDoc(settingsRef);
    if (snap.exists()) {
      return snap.data() as Partial<RecSettings>;
    }
  } catch (err) {
    console.warn("[Firestore] fetch settings error:", err);
  }
  return null;
}

export async function saveFirestoreSettings(uid: string, settings: Partial<RecSettings>) {
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
    console.warn("[Firestore] save settings error:", err);
  }
}
