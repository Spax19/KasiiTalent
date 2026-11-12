// Browser-side Firebase (Auth only). Import this from Client Components only.
// The server keeps using the Admin SDK in ./admin.ts; Firestore is never touched from the browser.
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

export function getFirebaseAuth(): Auth {
  // NEXT_PUBLIC_ values must be written out literally so Next.js can inline them at build time.
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

  if (!apiKey || !authDomain || !projectId || !appId) {
    throw new Error(
      "Firebase web settings are missing. Add the NEXT_PUBLIC_FIREBASE_* values to .env.local and restart the dev server.",
    );
  }

  const app = getApps().length ? getApp() : initializeApp({ apiKey, authDomain, projectId, appId });
  return getAuth(app);
}
