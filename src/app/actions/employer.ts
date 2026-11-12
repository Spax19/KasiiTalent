"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { adminDb, COL } from "@/lib/firebase/admin";
import { employerProfileSchema, saveCandidateSchema, slugify } from "@/lib/schemas";
import { notifyContactRequest } from "@/services/contact";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function setSavedCandidate(workerUid: unknown, saved: unknown): Promise<ActionResult> {
  const parsed = saveCandidateSchema.safeParse({ workerUid, saved });
  if (!parsed.success) return { ok: false, error: "Invalid candidate." };

  const employer = await requireUser("employer");
  const db = adminDb();
  const candidateRef = db.collection(COL.users).doc(parsed.data.workerUid);
  const savedRef = db.collection(COL.savedCandidates).doc(`${employer.uid}_${parsed.data.workerUid}`);

  try {
    await db.runTransaction(async (transaction) => {
      const savedSnapshot = await transaction.get(savedRef);
      if (parsed.data.saved) {
        const candidate = await transaction.get(candidateRef);
        if (!candidate.exists || candidate.get("role") !== "worker" || candidate.get("visibility") !== "visible") {
          throw new Error("CANDIDATE_UNAVAILABLE");
        }
        if (!savedSnapshot.exists) {
          transaction.create(savedRef, {
            employerUid: employer.uid,
            workerUid: parsed.data.workerUid,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
      } else if (savedSnapshot.exists) {
        if (savedSnapshot.get("employerUid") !== employer.uid) throw new Error("FORBIDDEN_SAVED_CANDIDATE");
        transaction.delete(savedRef);
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "CANDIDATE_UNAVAILABLE") {
      return { ok: false, error: "This worker is no longer visible to employers." };
    }
    if (error instanceof Error && error.message === "FORBIDDEN_SAVED_CANDIDATE") {
      return { ok: false, error: "You cannot change this saved candidate." };
    }
    console.error("setSavedCandidate failed", { name: (error as Error).name });
    return { ok: false, error: "Could not update saved candidates. Please try again." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/saved");
  return { ok: true };
}

export async function requestContact(workerUid: unknown): Promise<void> {
  if (typeof workerUid !== "string" || workerUid.length < 1 || workerUid.length > 128) {
    throw new Error("Invalid worker.");
  }
  const employer = await requireUser("employer");
  const db = adminDb();
  const worker = await db.collection(COL.users).doc(workerUid).get();
  if (!worker.exists || worker.get("role") !== "worker" || worker.get("visibility") !== "visible") {
    throw new Error("This worker is no longer visible to employers.");
  }

  const request = await db.collection(COL.contactRequests).add({
    employerUid: employer.uid,
    workerUid,
    status: "sent",
    createdAt: FieldValue.serverTimestamp(),
  });
  await notifyContactRequest(request.id);
  revalidatePath("/dashboard");
  revalidatePath("/saved");
}

export async function updateEmployerProfile(payload: unknown): Promise<ActionResult> {
  const parsed = employerProfileSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your business details." };

  const employer = await requireUser("employer");
  const db = adminDb();
  const profileRef = db.collection(COL.users).doc(employer.uid);

  try {
    const profile = await profileRef.get();
    if (!profile.exists || profile.get("role") !== "employer") {
      return { ok: false, error: "Employer profile not found." };
    }
    await profileRef.update({
      businessName: parsed.data.businessName,
      businessType: parsed.data.businessType,
      township: parsed.data.township,
      townshipSlug: slugify(parsed.data.township),
      city: parsed.data.city,
      province: parsed.data.province,
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("updateEmployerProfile failed", { name: (error as Error).name });
    return { ok: false, error: "Your business settings could not be saved. Please try again." };
  }

  try {
    const jobs = await db.collection(COL.jobs).where("employerUid", "==", employer.uid).get();
    for (let offset = 0; offset < jobs.docs.length; offset += 400) {
      const batch = db.batch();
      jobs.docs.slice(offset, offset + 400).forEach((job) => {
        batch.update(job.ref, { employerName: parsed.data.businessName });
      });
      await batch.commit();
    }
  } catch (error) {
    console.error("updateEmployerJobNames failed", { name: (error as Error).name });
    return { ok: false, error: "Your profile was saved, but existing job listings could not be updated. Please try again." };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/jobs");
  revalidatePath("/messages");
  return { ok: true };
}
