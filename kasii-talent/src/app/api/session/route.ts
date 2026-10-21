// Path: src/app/api/session/route.ts
// Exchanges a fresh Firebase ID token for an httpOnly session cookie ("__session").
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb, COL } from "../../../lib/firebase/admin";

export const runtime = "nodejs";

const EXPIRES_MS = 5 * 24 * 60 * 60 * 1000; // 5 days
const RECENT_SIGN_IN_SECONDS = 5 * 60;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { idToken?: string; role?: "employer" };
  if (typeof body.idToken !== "string") return NextResponse.json({ error: "Missing token" }, { status: 400 });

  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(body.idToken, true);
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Only mint cookies for recent sign-ins (limits damage from a stolen old token).
  if (Date.now() / 1000 - decoded.auth_time > RECENT_SIGN_IN_SECONDS) {
    return NextResponse.json({ error: "Please sign in again" }, { status: 401 });
  }

  // First-time employer: verified email required, then we grant the role claim.
  if (!decoded.role) {
    if (body.role === "employer" && decoded.email && decoded.email_verified) {
      const db = adminDb();
      const userRef = db.collection(COL.users).doc(decoded.uid);
      let userSnapshot;
      try {
        userSnapshot = await userRef.get();
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === 5
        ) {
          return NextResponse.json(
            {
              error:
                "Cloud Firestore is not available for this project. Create its (default) Firestore database in Firebase Console, then try again.",
            },
            { status: 503 },
          );
        }
        throw error;
      }

      if (!userSnapshot.exists) {
        const now = FieldValue.serverTimestamp();
        await userRef.set({
          role: "employer",
          displayName: decoded.name ?? decoded.email.split("@")[0],
          // Email signups set their business name as the Firebase display name; Google users get their own name.
          businessName: decoded.name ?? "",
          township: "",
          townshipSlug: "",
          city: "",
          province: "",
          location: null,
          bio: "",
          languages: [],
          ratingAvg: 0,
          ratingCount: 0,
          endorsementCount: 0,
          verifiedSkillCount: 0,
          mediaCount: 0,
          visibility: "private",
          onboardingChannel: "web",
          createdAt: now,
          updatedAt: now,
          lastActiveAt: now,
        });
        await db.collection(COL.userPrivate).doc(decoded.uid).set({ email: decoded.email });
      }
      await adminAuth().setCustomUserClaims(decoded.uid, { role: "employer" });
      // Claims only appear in NEW tokens: the client must call getIdToken(true) and POST again.
      return NextResponse.json({ refresh: true });
    }
    return NextResponse.json({ error: "No role assigned" }, { status: 403 });
  }

  const cookie = await adminAuth().createSessionCookie(body.idToken, { expiresIn: EXPIRES_MS });
  const res = NextResponse.json({ ok: true });
  res.cookies.set("__session", cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: EXPIRES_MS / 1000,
    path: "/",
  });
  return res;
}

/** Logout. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("__session", "", { httpOnly: true, maxAge: 0, path: "/" });
  return res;
}
