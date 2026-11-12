// Path: src/services/contact.ts
// Consent-gated contact flow: employer requests -> worker replies 1/2 on WhatsApp -> number revealed only on "1".
import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, COL } from "@/lib/firebase/admin";
import { sendText } from "@/lib/whatsapp";
import { en as T } from "@/lib/bot-messages";

const REQUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Queues a worker notification for delivery by the persistent Baileys gateway.
 */
export async function notifyContactRequest(requestId: string): Promise<void> {
  const db = adminDb();
  const reqSnap = await db.collection(COL.contactRequests).doc(requestId).get();
  if (!reqSnap.exists) return;
  const { employerUid, workerUid, serviceTitle, details } = reqSnap.data() as {
    employerUid: string;
    workerUid: string;
    serviceTitle?: string;
    details?: string;
  };

  const [employer, priv] = await Promise.all([
    db.collection(COL.users).doc(employerUid).get(),
    db.collection(COL.userPrivate).doc(workerUid).get(),
  ]);
  const phone = priv.get("phoneE164") as string | undefined;
  if (!phone) return;
  const business = (employer.get("businessName") || employer.get("displayName") || "A local business") as string;

  await sendText(phone, T.contactRequest(business, serviceTitle, details));
}

/** Worker replied 1 or 2. Applies to their most recent open, unexpired request. */
export async function respondToContactRequest(workerUid: string, accept: boolean): Promise<{ found: boolean }> {
  const db = adminDb();
  const snap = await db
    .collection(COL.contactRequests)
    .where("workerUid", "==", workerUid)
    .where("status", "==", "sent")
    .limit(10)
    .get();

  const open = snap.docs
    .filter((d) => (d.get("createdAt")?.toMillis() ?? 0) > Date.now() - REQUEST_TTL_MS)
    .sort((a, b) => b.get("createdAt").toMillis() - a.get("createdAt").toMillis())[0];
  if (!open) return { found: false };

  await open.ref.update({
    status: accept ? "accepted" : "declined",
    respondedAt: FieldValue.serverTimestamp(),
  });
  return { found: true };
}

/**
 * The ONLY place a worker's number is released to an employer: request must belong to
 * the employer AND be accepted. Call from a Server Component/Action, never expose in bulk.
 */
export async function getSharedContact(requestId: string, employerUid: string): Promise<string | null> {
  const db = adminDb();
  const reqSnap = await db.collection(COL.contactRequests).doc(requestId).get();
  if (!reqSnap.exists || reqSnap.get("employerUid") !== employerUid || reqSnap.get("status") !== "accepted") {
    return null;
  }
  const priv = await db.collection(COL.userPrivate).doc(reqSnap.get("workerUid")).get();
  return (priv.get("phoneE164") as string | undefined) ?? null;
}
