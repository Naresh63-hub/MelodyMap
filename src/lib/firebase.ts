import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile as firebaseUpdateProfile,
  type User,
  type Auth,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  collection,
  getDocs,
  deleteDoc,
  type Firestore,
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase App
const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth
export const auth: Auth = getAuth(app);

// Initialize Firestore with specific provisioned database ID
export const db: Firestore = getFirestore(
  app,
  firebaseConfig.firestoreDatabaseId || "(default)"
);

// Google Auth Provider setup
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// Health check connection test to Firestore
export async function testFirestoreConnection(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    await getDocFromServer(doc(db, "test", "connection"));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.warn("[Firebase] Client is offline or database initializing.");
    }
    return false;
  }
}

// Trigger connection test once on client startup
if (typeof window !== "undefined") {
  testFirestoreConnection().catch(() => {});
}

export {
  app,
  signInWithPopup,
  signInWithRedirect,
  firebaseSignOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  firebaseUpdateProfile,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  deleteDoc,
  type User,
};
