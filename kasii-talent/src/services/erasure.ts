// Path: src/services/erasure.ts
// POPIA: right to deletion. Triggered by WhatsApp "DELETE" or the web settings page.
import "server-only";
import { v2 as cloudinary } from "cloudinary";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb, COL } from "@/lib/firebase/admin";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/** Delete every document in `collection` where `field == uid`, in batches of 400. */
async function deleteWhere(collection: string, field: string, uid: string) {
  const db = adminDb();
  for (;;) {
    const snap = await db.collection(collection).where(field, "==", uid).limit(400).get();
    if (snap.empty) return;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

export async function deleteWorkerAccount(uid: string): Promise<void> {
  const db = adminDb();

  // 0. Audit record first (contains no personal data beyond the opaque uid).
  const requestRef = db.collection(COL.deletionRequests).doc();
  await requestRef.set({ uid, requestedAt: FieldValue.serverTimestamp(), completedAt: null });

  // 1. Hide immediately so employers stop seeing the profile.
  await db.collection(COL.users).doc(uid).set({ visibility: "paused" }, { merge: true });

  // 2. Cloudinary assets (images + videos) under the worker's folder.
  const prefix = `kasitalent/workers/${uid}`;
  await Promise.all([
    cloudinary.api.delete_resources_by_prefix(prefix, { resource_type: "image" }),
    cloudinary.api.delete_resources_by_prefix(prefix, { resource_type: "video" }),
  ]);
  await cloudinary.api.delete_folder(prefix).catch(() => undefined); // empty-folder cleanup

  // 3. Firestore data owned by the worker.
  const phoneHash = (await db.collection(COL.userPrivate).doc(uid).get()).get("phoneHash") as string | undefined;
  await Promise.all([
    deleteWhere("vouch_codes", "uid", uid),
    deleteWhere(COL.media, "uid", uid),
    deleteWhere(COL.skills, "uid", uid),
    deleteWhere(COL.consents, "uid", uid),
    deleteWhere(COL.contactRequests, "workerUid", uid),
    // Endorsements about the worker contain third-party personal data (the voucher's name).
    deleteWhere(COL.endorsements, "workerUid", uid),
  ]);
  await Promise.all([
    db.collection(COL.userPrivate).doc(uid).delete(), // phone number goes here
    phoneHash ? db.collection("wa_sessions").doc(phoneHash).delete() : Promise.resolve(),
    db.collection(COL.users).doc(uid).delete(),
  ]);

  // 4. Auth identity last, so a failed run can be retried.
  await adminAuth().deleteUser(uid).catch((e: { code?: string }) => {
    if (e.code !== "auth/user-not-found") throw e;
  });

  await requestRef.update({ completedAt: FieldValue.serverTimestamp() });
}
