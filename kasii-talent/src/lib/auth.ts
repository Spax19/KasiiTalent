// Path: src/lib/auth.ts
import "server-only";
import { cookies } from "next/headers";
import { adminAuth } from "../lib/firebase/admin";

export interface SessionUser {
  uid: string;
  role?: "worker" | "employer";
}

/**
 * Reads the Firebase session cookie ("__session") and verifies it.
 * Create the cookie in a /api/session route with adminAuth().createSessionCookie(idToken, ...).
 * Roles are stored as custom claims so they cannot be edited by the client.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookie = (await cookies()).get("__session")?.value;
  if (!cookie) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(cookie, true);
    return { uid: decoded.uid, role: decoded.role as SessionUser["role"] };
  } catch {
    return null;
  }
}

export async function requireUser(role?: "worker" | "employer"): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  if (role && user.role !== role) throw new Error("FORBIDDEN");
  return user;
}
