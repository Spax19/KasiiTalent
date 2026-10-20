// Path: src/app/actions/worker.ts
"use server";

import { v2 as cloudinary } from "cloudinary";
import { adminAuth } from "@/lib/firebase/admin";
import { requireUser } from "@/lib/auth";
import { registerWorkerSchema, savePortfolioMediaSchema, type SavePortfolioMediaInput } from "@/lib/schemas";
import { createWorkerProfile, DomainError } from "@/services/workers";
import { MediaError, recordPortfolioMedia, TRANSFORMS, workerFolder } from "@/services/media"; // also configures Cloudinary

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/* ------------------------------------------------------------------ */
/* 1. Register a worker from the light web form                        */
/* ------------------------------------------------------------------ */
/**
 * The web form first verifies the phone with Firebase client Phone Auth and passes
 * the resulting ID token here so nobody can register a number they do not control.
 * (The WhatsApp bot calls createWorkerProfile() directly: WhatsApp already proves
 * possession of the number.)
 */
export async function registerWorker(
  payload: unknown,
  idToken: string,
): Promise<ActionResult<{ uid: string; created: boolean }>> {
  const parsed = registerWorkerSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid details" };
  }

  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    if (!decoded.phone_number) return { ok: false, error: "Phone verification required." };

    // Force the verified number; ignore whatever the client claimed.
    const result = await createWorkerProfile({ ...parsed.data, phone: decoded.phone_number, channel: "web" });
    return { ok: true, data: result };
  } catch (err) {
    if (err instanceof DomainError) return { ok: false, error: err.message };
    console.error("registerWorker failed", { name: (err as Error).name }); // no PII in logs
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/* ------------------------------------------------------------------ */
/* 2. Signed Cloudinary upload (compression happens at upload time)    */
/* ------------------------------------------------------------------ */
export async function getUploadSignature(kind: "image" | "video") {
  const user = await requireUser("worker");
  const timestamp = Math.round(Date.now() / 1000);
  const folder = workerFolder(user.uid);
  const transformation = TRANSFORMS[kind];

  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder, transformation },
    process.env.CLOUDINARY_API_SECRET!,
  );

  return {
    signature,
    timestamp,
    folder,
    transformation,
    apiKey: process.env.CLOUDINARY_API_KEY!,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
    resourceType: kind,
  };
}

/* ------------------------------------------------------------------ */
/* 3. Persist portfolio media metadata after the browser upload        */
/* ------------------------------------------------------------------ */
export async function savePortfolioMedia(payload: SavePortfolioMediaInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser("worker");
  const parsed = savePortfolioMediaSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid media" };
  const m = parsed.data;

  // Trust but verify: the asset must live in OUR cloud and in THIS worker's folder.
  const cloud = process.env.CLOUDINARY_CLOUD_NAME!;
  if (!m.secureUrl.startsWith(`https://res.cloudinary.com/${cloud}/`) || !m.publicId.startsWith(`${workerFolder(user.uid)}/`)) {
    return { ok: false, error: "Upload could not be verified." };
  }

  try {
    const id = await recordPortfolioMedia(user.uid, m);
    return { ok: true, data: { id } };
  } catch (err) {
    if (err instanceof MediaError) return { ok: false, error: err.message };
    return { ok: false, error: "Could not save your upload." };
  }
}
