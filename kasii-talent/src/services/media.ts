// Path: src/services/media.ts
// Shared by the web Server Action and the WhatsApp bot.
import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { adminDb, COL } from "@/lib/firebase/admin";
import type { SavePortfolioMediaInput } from "@/lib/schemas";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export const MAX_MEDIA_PER_WORKER = 12;

/** Applied at upload time so Cloudinary only ever stores the compressed version. */
export const TRANSFORMS = {
  image: "c_limit,w_1280,q_auto:eco,f_auto",
  video: "c_limit,w_720,q_auto:eco,du_30", // hard cap of 30 seconds
} as const;

/** An error whose message is safe to show to the end user. */
export class MediaError extends Error {}

export const workerFolder = (uid: string) => `kasitalent/workers/${uid}`;

export function buildThumbnailUrl(secureUrl: string, type: "image" | "video"): string {
  const transform =
    type === "video" ? "so_1,c_fill,w_400,h_400,q_auto,f_jpg" : "c_fill,w_400,h_400,q_auto,f_auto";
  const withTransform = secureUrl.replace("/upload/", `/upload/${transform}/`);
  return type === "video" ? withTransform.replace(/\.[a-z0-9]+$/i, ".jpg") : withTransform;
}

/** Server-side upload (used by the WhatsApp bot, where there is no browser to upload from). */
export function uploadWorkerMedia(uid: string, buffer: Buffer, type: "image" | "video"): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: workerFolder(uid), resource_type: type, transformation: TRANSFORMS[type] },
      (err, result) => (err || !result ? reject(err ?? new Error("Upload failed")) : resolve(result)),
    );
    stream.end(buffer);
  });
}

/** Writes the portfolio_media doc and bumps the worker's counter in one transaction. */
export async function recordPortfolioMedia(uid: string, m: SavePortfolioMediaInput): Promise<string> {
  const db = adminDb();
  const userRef = db.collection(COL.users).doc(uid);
  const mediaRef = db.collection(COL.media).doc();

  await db.runTransaction(async (tx) => {
    const [userSnap, skillSnap] = await Promise.all([
      tx.get(userRef),
      tx.get(db.collection(COL.skills).doc(`${uid}_${m.skillSlug}`)),
    ]);
    if (!userSnap.exists) throw new MediaError("Create your profile first.");
    if (!skillSnap.exists) throw new MediaError("Pick one of the skills on your profile.");
    if ((userSnap.get("mediaCount") ?? 0) >= MAX_MEDIA_PER_WORKER) {
      throw new MediaError(`You can keep up to ${MAX_MEDIA_PER_WORKER} photos/videos. Delete one to add more.`);
    }

    tx.set(mediaRef, {
      uid,
      type: m.type,
      secureUrl: m.secureUrl,
      publicId: m.publicId,
      thumbnailUrl: buildThumbnailUrl(m.secureUrl, m.type),
      width: m.width ?? null,
      height: m.height ?? null,
      bytes: m.bytes ?? null,
      durationSec: m.durationSec ?? null,
      caption: m.caption,
      skillSlug: m.skillSlug,
      moderationStatus: "pending", // employers only see "approved"
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.update(userRef, {
      mediaCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
      lastActiveAt: FieldValue.serverTimestamp(),
    });
  });

  return mediaRef.id;
}
