import { initializeApp, getApps, getApp } from "firebase/app";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const storage = getStorage(app);
// Signed into via signInWithCustomToken (see NotificationsProvider) — this
// app's real auth is NextAuth; this is only a bridge so the browser can
// prove its identity directly to Realtime Database.
const auth = getAuth(app);
// getDatabase() throws SYNCHRONOUSLY (at module load, not call time) if
// NEXT_PUBLIC_FIREBASE_DATABASE_URL isn't set — which, unguarded, would
// break this entire module including the `storage` export every existing
// upload flow already depends on. Degrade to null instead so the rest of
// this file's exports stay usable until the Realtime Database prerequisite
// is in place; NotificationsProvider checks for null before using it.
let database: Database | null = null;
try {
  database = getDatabase(app);
} catch (error) {
  console.warn(
    "Firebase Realtime Database not configured (NEXT_PUBLIC_FIREBASE_DATABASE_URL missing?) — live notification push is disabled.",
    error,
  );
}

export { storage, auth, database };
