import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile as firebaseUpdateProfile,
  updatePassword as firebaseUpdatePassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signInWithCredential,
  type User,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  getDocFromServer,
  query,
  limit,
  orderBy,
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";
import { isNativeApp } from "@/lib/auth-deep-link";
import {
  getGoogleWebClientId,
  isNativeGoogleAuthSupported,
  signInWithNativeGoogleFirebase,
} from "@/lib/native-google-auth";
import type { Track } from "@/lib/library";

// ─── Initialize Firebase App ────────────────────────────────────────────────
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// ─── Initialize Services ───────────────────────────────────────────────────
export const auth = getAuth(app);

export let analytics: Analytics | null = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported && firebaseConfig.measurementId) {
      analytics = getAnalytics(app);
    }
  }).catch(() => {});
}

// Use provisioned firestore database ID or default
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// ─── Connection Validation Probe ───────────────────────────────────────────
async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.warn("[Firebase] Offline connection check. Verify Firebase network status.");
    }
  }
}

if (typeof window !== "undefined") {
  testConnection().catch(() => {});
}

// ─── User Profile Synchronization ──────────────────────────────────────────
export async function syncUserProfile(
  user: User,
  customName?: string,
  customAvatar?: string,
): Promise<{ displayName: string; avatarUrl: string }> {
  const now = new Date().toISOString();
  const fallbackName =
    customName ||
    user.displayName ||
    user.email?.split("@")[0] ||
    "Listener";
  const fallbackAvatar =
    customAvatar !== undefined
      ? customAvatar
      : user.photoURL || "";

  try {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      await setDoc(userRef, {
        id: user.uid,
        displayName: fallbackName,
        email: user.email || "",
        avatarUrl: fallbackAvatar,
        createdAt: now,
        updatedAt: now,
      });
      return { displayName: fallbackName, avatarUrl: fallbackAvatar };
    } else {
      const data = snap.data();
      const finalName = customName || (data["displayName"] as string) || fallbackName;
      const finalAvatar =
        customAvatar !== undefined ? customAvatar : (data["avatarUrl"] as string) || fallbackAvatar;

      await setDoc(
        userRef,
        {
          displayName: finalName,
          email: user.email || (data["email"] as string) || "",
          avatarUrl: finalAvatar,
          updatedAt: now,
        },
        { merge: true },
      );
      return { displayName: finalName, avatarUrl: finalAvatar };
    }
  } catch (err) {
    console.warn("[Firebase] syncUserProfile notice:", err);
    return { displayName: fallbackName, avatarUrl: fallbackAvatar };
  }
}

// ─── Google Authentication ─────────────────────────────────────────────────
export async function signInWithGoogle(): Promise<{
  success: boolean;
  user?: User;
  error?: string;
}> {
  // If running inside native Android app, prioritize native 1-tap Google Play Services picker
  if (isNativeApp() && isNativeGoogleAuthSupported()) {
    const clientId = getGoogleWebClientId() || firebaseConfig.oAuthClientId;
    if (clientId) {
      try {
        const res = await signInWithNativeGoogleFirebase(
          auth,
          GoogleAuthProvider,
          signInWithCredential,
          syncUserProfile,
          clientId,
        );
        if (res.success) {
          return { success: true, user: res.user };
        }
      } catch (nativeErr) {
        console.warn("[Firebase] Native Google Sign-In attempt failed:", nativeErr);
      }
    }
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    const result = await signInWithPopup(auth, provider);
    await syncUserProfile(result.user);
    return { success: true, user: result.user };
  } catch (err: any) {
    // Popup might be blocked inside certain iframe/sandboxed environments
    if (
      err.code === "auth/popup-blocked" ||
      err.code === "auth/popup-closed-by-user" ||
      err.code === "auth/cancelled-popup-request"
    ) {
      try {
        await signInWithRedirect(auth, provider);
        return { success: true };
      } catch (redirectErr: any) {
        return { success: false, error: redirectErr?.message || "Google Sign-in was cancelled." };
      }
    }
    return { success: false, error: err?.message || "Google Sign-in failed." };
  }
}

// Handle possible redirect results on mount
if (typeof window !== "undefined") {
  getRedirectResult(auth)
    .then((result) => {
      if (result?.user) {
        void syncUserProfile(result.user);
      }
    })
    .catch((err) => {
      console.warn("[Firebase] Redirect auth check notice:", err);
    });
}

// ─── Firestore Data Persistence Helpers ────────────────────────────────────

/** Save a favorited track to Cloud Firestore */
export async function saveTrackLikeToFirestore(userId: string, track: Track): Promise<void> {
  if (!userId || !track?.id) return;
  try {
    const likeRef = doc(db, "users", userId, "likes", String(track.id));
    await setDoc(likeRef, {
      trackId: String(track.id),
      title: track.title || "Untitled",
      artist: track.artist || "Unknown Artist",
      thumbnail: track.thumbnail || "",
      album: track.album || "",
      duration: typeof track.duration === "number" ? track.duration : 0,
      likedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[Firebase] saveTrackLikeToFirestore error:", err);
  }
}

/** Remove a favorited track from Cloud Firestore */
export async function removeTrackLikeFromFirestore(userId: string, trackId: string): Promise<void> {
  if (!userId || !trackId) return;
  try {
    const likeRef = doc(db, "users", userId, "likes", String(trackId));
    await deleteDoc(likeRef);
  } catch (err) {
    console.warn("[Firebase] removeTrackLikeFromFirestore error:", err);
  }
}

/** Fetch all user liked tracks from Cloud Firestore */
export async function fetchTrackLikesFromFirestore(userId: string): Promise<Track[]> {
  if (!userId) return [];
  try {
    const likesRef = collection(db, "users", userId, "likes");
    const q = query(likesRef, orderBy("likedAt", "desc"), limit(200));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: (data["trackId"] as string) || d.id,
        title: (data["title"] as string) || "Untitled",
        artist: (data["artist"] as string) || "Unknown",
        thumbnail: (data["thumbnail"] as string) || "",
        album: data["album"] as string | undefined,
        duration: data["duration"] as number | string | undefined,
      } as Track;
    });
  } catch (err) {
    console.warn("[Firebase] fetchTrackLikesFromFirestore error:", err);
    return [];
  }
}

/** Save a played track into Cloud Firestore listening history */
export async function saveHistoryToFirestore(userId: string, track: Track): Promise<void> {
  if (!userId || !track?.id) return;
  try {
    const historyDocId = `${Date.now()}_${track.id}`;
    const historyRef = doc(db, "users", userId, "history", historyDocId);
    await setDoc(historyRef, {
      trackId: String(track.id),
      title: track.title || "Untitled",
      artist: track.artist || "Unknown",
      thumbnail: track.thumbnail || "",
      playedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[Firebase] saveHistoryToFirestore error:", err);
  }
}

/** Fetch recent listening history from Cloud Firestore */
export async function fetchHistoryFromFirestore(userId: string): Promise<Track[]> {
  if (!userId) return [];
  try {
    const historyRef = collection(db, "users", userId, "history");
    const q = query(historyRef, orderBy("playedAt", "desc"), limit(50));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: (data["trackId"] as string) || d.id,
        title: (data["title"] as string) || "Untitled",
        artist: (data["artist"] as string) || "Unknown",
        thumbnail: (data["thumbnail"] as string) || "",
      } as Track;
    });
  } catch (err) {
    console.warn("[Firebase] fetchHistoryFromFirestore error:", err);
    return [];
  }
}
