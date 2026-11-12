"use server";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { adminDb, COL } from "@/lib/firebase/admin";
import {
  applicationStatusSchema,
  applyToJobSchema,
  createJobPostingSchema,
  jobStatusSchema,
  slugify,
} from "@/lib/schemas";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function createJobPosting(payload: unknown): Promise<ActionResult> {
  const parsed = createJobPostingSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the job details." };

  const employer = await requireUser("employer");
  const input = parsed.data;
  const db = adminDb();
  const startDate = input.startDate ? new Date(`${input.startDate}T00:00:00.000Z`) : null;
  const skillSlugs = [...new Set(input.skills.split(",").map((skill) => slugify(skill)).filter(Boolean))].slice(0, 10);
  try {
    const profile = await db.collection(COL.users).doc(employer.uid).get();
    await db.collection(COL.jobs).add({
      employerUid: employer.uid,
      employerName: profile.get("businessName") || profile.get("displayName") || "Local employer",
      title: input.title,
      description: input.description,
      skillSlugs,
      paymentType: input.paymentType,
      payAmountZar: input.payAmountZar,
      township: input.township,
      townshipSlug: slugify(input.township),
      location: null,
      radiusKm: input.radiusKm,
      status: "open",
      startDate: startDate ? Timestamp.fromDate(startDate) : null,
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
      applicantCount: 0,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("createJobPosting failed", { name: (error as Error).name });
    return { ok: false, error: "Your job could not be published. Please try again." };
  }

  revalidatePath("/jobs");
  revalidatePath("/worker/jobs");
  revalidatePath("/messages");
  return { ok: true };
}

export async function updateJobPosting(jobId: string, payload: unknown): Promise<ActionResult> {
  const parsed = createJobPostingSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the job details." };
  if (!jobId || jobId.length > 150) return { ok: false, error: "Invalid job." };

  const employer = await requireUser("employer");
  const input = parsed.data;
  const db = adminDb();
  const jobRef = db.collection(COL.jobs).doc(jobId);
  const startDate = input.startDate ? new Date(`${input.startDate}T00:00:00.000Z`) : null;
  const skillSlugs = [...new Set(input.skills.split(",").map((skill) => slugify(skill)).filter(Boolean))].slice(0, 10);

  try {
    const job = await jobRef.get();
    if (!job.exists || job.get("employerUid") !== employer.uid) {
      return { ok: false, error: "Job not found." };
    }
    await jobRef.update({
      title: input.title,
      description: input.description,
      skillSlugs,
      paymentType: input.paymentType,
      payAmountZar: input.payAmountZar,
      township: input.township,
      townshipSlug: slugify(input.township),
      radiusKm: input.radiusKm,
      startDate: startDate ? Timestamp.fromDate(startDate) : null,
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("updateJobPosting failed", { name: (error as Error).name });
    return { ok: false, error: "Your job could not be updated. Please try again." };
  }

  revalidatePath("/jobs");
  revalidatePath("/worker/jobs");
  revalidatePath("/messages");
  return { ok: true };
}

export async function applyToJob(payload: unknown): Promise<ActionResult> {
  const parsed = applyToJobSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your application." };

  const worker = await requireUser("worker");
  const db = adminDb();
  const profileRef = db.collection(COL.users).doc(worker.uid);
  const jobRef = db.collection(COL.jobs).doc(parsed.data.jobId);
  const applicationRef = db.collection(COL.jobApplications).doc(`${parsed.data.jobId}_${worker.uid}`);
  let profile;
  let job;
  try {
    [profile, job] = await Promise.all([profileRef.get(), jobRef.get()]);
  } catch (error) {
    console.error("applyToJob lookup failed", { name: (error as Error).name });
    return { ok: false, error: "We could not load this job. Please try again." };
  }
  if (!profile.exists || profile.get("role") !== "worker") {
    return { ok: false, error: "Complete your worker profile before applying." };
  }
  if (!job.exists || job.get("status") !== "open") {
    return { ok: false, error: "This job is no longer accepting applications." };
  }
  const expiresAt = job.get("expiresAt") as Timestamp | undefined;
  if (expiresAt && expiresAt.toMillis() <= Date.now()) {
    return { ok: false, error: "This job is no longer accepting applications." };
  }

  try {
    await db.runTransaction(async (transaction) => {
      const currentJob = await transaction.get(jobRef);
      const existingApplication = await transaction.get(applicationRef);
      if (existingApplication.exists) throw new Error("ALREADY_APPLIED");
      if (!currentJob.exists || currentJob.get("status") !== "open") throw new Error("JOB_CLOSED");
      const currentExpiry = currentJob.get("expiresAt") as Timestamp | undefined;
      if (currentExpiry && currentExpiry.toMillis() <= Date.now()) throw new Error("JOB_CLOSED");

      transaction.create(applicationRef, {
        jobId: jobRef.id,
        employerUid: currentJob.get("employerUid"),
        workerUid: worker.uid,
        jobTitle: currentJob.get("title"),
        township: currentJob.get("township"),
        workerName: profile.get("displayName") || "Worker",
        workerTownship: profile.get("township") || "",
        message: parsed.data.message,
        status: "pending",
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.update(jobRef, { applicantCount: FieldValue.increment(1) });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_APPLIED") {
      return { ok: false, error: "You have already applied for this job." };
    }
    if (error instanceof Error && error.message === "JOB_CLOSED") {
      return { ok: false, error: "This job is no longer accepting applications." };
    }
    console.error("applyToJob failed", { name: (error as Error).name });
    return { ok: false, error: "Your application could not be submitted. Please try again." };
  }

  revalidatePath("/worker/jobs");
  revalidatePath("/jobs");
  revalidatePath("/messages");
  return { ok: true };
}

export async function updateJobStatus(jobId: string, status: unknown): Promise<ActionResult> {
  const parsedStatus = jobStatusSchema.safeParse(status);
  if (!parsedStatus.success || !jobId || jobId.length > 150) {
    return { ok: false, error: "Invalid job status." };
  }

  const employer = await requireUser("employer");
  const jobRef = adminDb().collection(COL.jobs).doc(jobId);
  try {
    const job = await jobRef.get();
    if (!job.exists || job.get("employerUid") !== employer.uid) {
      return { ok: false, error: "Job not found." };
    }
    await jobRef.update({ status: parsedStatus.data });
  } catch (error) {
    console.error("updateJobStatus failed", { name: (error as Error).name });
    return { ok: false, error: "The job status could not be updated. Please try again." };
  }
  revalidatePath("/jobs");
  revalidatePath("/worker/jobs");
  revalidatePath("/messages");
  return { ok: true };
}

export async function respondToApplication(applicationId: string, status: unknown): Promise<ActionResult> {
  const parsedStatus = applicationStatusSchema.safeParse(status);
  if (!parsedStatus.success || !applicationId || applicationId.length > 200) {
    return { ok: false, error: "Invalid application response." };
  }

  const employer = await requireUser("employer");
  const db = adminDb();
  const applicationRef = db.collection(COL.jobApplications).doc(applicationId);
  try {
    await db.runTransaction(async (transaction) => {
      const application = await transaction.get(applicationRef);
      if (!application.exists || application.get("employerUid") !== employer.uid) throw new Error("APPLICATION_NOT_FOUND");
      if (application.get("status") !== "pending") throw new Error("APPLICATION_REVIEWED");
      transaction.update(applicationRef, {
        status: parsedStatus.data,
        respondedAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "APPLICATION_NOT_FOUND") {
      return { ok: false, error: "Application not found." };
    }
    if (error instanceof Error && error.message === "APPLICATION_REVIEWED") {
      return { ok: false, error: "This application has already been reviewed." };
    }
    console.error("respondToApplication failed", { name: (error as Error).name });
    return { ok: false, error: "Your response could not be saved. Please try again." };
  }
  revalidatePath("/jobs");
  revalidatePath("/worker/jobs");
  revalidatePath("/messages");
  return { ok: true };
}
