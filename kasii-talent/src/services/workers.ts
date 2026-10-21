// Path: src/services/workers.ts
// Transport-agnostic core: called by the web Server Action AND the WhatsApp webhook.
import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { geohashForLocation } from "geofire-common";
import { adminAuth, adminDb, COL } from "@/lib/firebase/admin";
import { hashPhone, normalizeSaPhone } from "@/lib/phone";
import { registerWorkerSchema, slugify, type RegisterWorkerInput } from "@/lib/schemas";

export class DomainError extends Error {
  constructor(public code: "INVALID_PHONE" | "INVALID_INPUT" | "FORBIDDEN", message: string) {
    super(message);
  }
}

export interface CreateWorkerResult {
  uid: string;
  created: boolean;
}

export async function createWorkerProfile(raw: RegisterWorkerInput): Promise<CreateWorkerResult> {
  const parsed = registerWorkerSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DomainError("INVALID_INPUT", parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input = parsed.data;

  const phone = normalizeSaPhone(input.phone);
  if (!phone) throw new DomainError("INVALID_PHONE", "Please enter a valid South African mobile number.");
  const phoneHash = hashPhone(phone);

  const db = adminDb();
  const auth = adminAuth();

  // Idempotency: one account per phone number.
  const existing = await db
    .collection(COL.userPrivate)
    .where("phoneHash", "==", phoneHash)
    .limit(1)
    .get();
  if (!existing.empty) return { uid: existing.docs[0].id, created: false };

  // Create the Auth identity server-side (no SMS sent).
  const authUser = await auth
    .getUserByPhoneNumber(phone)
    .catch(async (err: { code?: string }) => {
      if (err.code === "auth/user-not-found") {
        return auth.createUser({ phoneNumber: phone, displayName: input.displayName });
      }
      throw err;
    });
  const uid = authUser.uid;
  await auth.setCustomUserClaims(uid, { role: "worker" });

  const township = input.township;
  const townshipSlug = slugify(township);
  const location =
    input.lat != null && input.lng != null
      ? { lat: input.lat, lng: input.lng, geohash: geohashForLocation([input.lat, input.lng]) }
      : null;

  const now = FieldValue.serverTimestamp();
  const batch = db.batch();

  // Visibility is private unless the worker explicitly consented to profile sharing.
  batch.set(db.collection(COL.users).doc(uid), {
    role: "worker",
    displayName: input.displayName,
    township,
    townshipSlug,
    city: input.city,
    province: input.province,
    location,
    bio: input.bio,
    languages: input.languages,
    ratingAvg: 0,
    ratingCount: 0,
    endorsementCount: 0,
    verifiedSkillCount: 0,
    mediaCount: 0,
    visibility: input.consents.profileSharing ? "visible" : "private",
    onboardingChannel: input.channel,
    createdAt: now,
    updatedAt: now,
    lastActiveAt: now,
  });

  // Phone number is stored ONLY here (denied to all clients by security rules).
  batch.set(db.collection(COL.userPrivate).doc(uid), { phoneE164: phone, phoneHash });

  for (const s of input.skills) {
    const slug = slugify(s.label);
    batch.set(db.collection(COL.skills).doc(`${uid}_${slug}`), {
      uid,
      skillSlug: slug,
      label: s.label,
      category: s.category,
      townshipSlug,
      yearsExperience: s.yearsExperience,
      verificationStatus: "pending",
      vouchCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Append-only consent audit trail.
  const consentBase = {
    uid,
    policyVersion: input.consents.policyVersion,
    channel: input.channel,
    sourceMessageId: input.sourceMessageId ?? null,
    createdAt: now,
  };
  const consentRows: Array<[string, boolean]> = [
    ["terms", true],
    ["age_18_plus", true],
    ["profile_sharing", input.consents.profileSharing],
  ];
  for (const [type, granted] of consentRows) {
    batch.set(db.collection(COL.consents).doc(), { ...consentBase, type, granted });
  }

  await batch.commit();
  return { uid, created: true };
}
