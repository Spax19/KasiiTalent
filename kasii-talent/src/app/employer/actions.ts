"use server";

import { FieldValue } from "firebase-admin/firestore";
import { adminDb, COL } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth";
import { notifyContactRequest } from "@/services/contact";

export async function requestWorkerContact(workerUid: string, serviceTitle: string, details: string): Promise<void> {
  const user = await getSessionUser();
  if (!user || user.role !== "employer") throw new Error("Sign in with a business account to request contact.");
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(workerUid)) throw new Error("Invalid worker profile.");

  const title = serviceTitle.trim();
  const description = details.trim();
  if (title.length < 2 || title.length > 80) throw new Error("Enter the service you need.");
  if (description.length > 500) throw new Error("Keep the service details under 500 characters.");

  const db = adminDb();
  const worker = await db.collection(COL.users).doc(workerUid).get();
  if (!worker.exists || worker.get("role") !== "worker" || worker.get("visibility") !== "visible") {
    throw new Error("This worker is not available for contact requests.");
  }

  const sentRequests = await db
    .collection(COL.contactRequests)
    .where("employerUid", "==", user.uid)
    .where("workerUid", "==", workerUid)
    .where("status", "==", "sent")
    .get();
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const activeRequest = sentRequests.docs.find((doc) => (doc.get("createdAt")?.toMillis?.() ?? Date.now()) > cutoff);
  if (activeRequest) throw new Error("You already have a request waiting for this worker.");
  await Promise.all(sentRequests.docs.map((doc) => doc.ref.update({ status: "expired" })));

  const request = await db.collection(COL.contactRequests).add({
    employerUid: user.uid,
    workerUid,
    requestType: "service",
    serviceTitle: title,
    details: description,
    status: "sent",
    createdAt: FieldValue.serverTimestamp(),
  });

  await notifyContactRequest(request.id);
}