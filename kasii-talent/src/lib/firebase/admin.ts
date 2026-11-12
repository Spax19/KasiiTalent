// Path: src/lib/firebase/admin.ts
import "server-only";
import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function getAdminApp(): App {
  if (getApps().length) return getApp();
  return initializeApp({
    credential: cert({
      projectId: requireEnv("FIREBASE_PROJECT_ID"),
      clientEmail: requireEnv("FIREBASE_CLIENT_EMAIL"),
      // Vercel stores newlines as literal "\n"
      privateKey: requireEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    }),
  });
}

export const adminAuth = () => getAuth(getAdminApp());
export const adminDb = () => {
  const db = getFirestore(getAdminApp());
  return db;
};

/** Collection names in one place to avoid typos. */
export const COL = {
  users: "users",
  userPrivate: "user_private",
  consents: "consents",
  skills: "skills",
  endorsements: "endorsements",
  media: "portfolio_media",
  jobs: "job_postings",
  contactRequests: "contact_requests",
  deletionRequests: "deletion_requests",
} as const;
