import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

// Cached across the process (mirrors the pattern in lib/mongodb.ts) —
// initializeApp() throws if called twice in the same process, which
// Next.js dev's hot-reload would otherwise trigger repeatedly.
//
// IMPORTANT: only import firebase-admin/app and firebase-admin/database
// from this file, never firebase-admin/auth. The auth submodule pulls in
// jwks-rsa -> jose (an ESM-only package), which broke every route that
// merely imported this file in production — Next's bundler couldn't
// require() it (ERR_REQUIRE_ESM), even for routes that only ever wanted
// getAdminDb() and never touched auth. getAdminAuth() lives in
// lib/firebaseAdminAuth.ts instead, so only the one route that actually
// mints custom tokens is exposed to that dependency chain.
export function getAdminApp(): App {
  const existing = getApps();
  if (existing.length > 0) {
    return existing[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Env vars can't hold real newlines — the downloaded service account
  // JSON's private_key has them escaped as literal "\n" sequences.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin SDK is not configured — set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.",
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  });
}

// Throws synchronously if the Admin SDK isn't configured — callers
// (lib/notifications.ts) are responsible for catching that so a
// missing/misconfigured Firebase setup never breaks the Mongo-backed
// functionality it's layered on top of.
export function getAdminDb() {
  return getDatabase(getAdminApp());
}
