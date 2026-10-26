// Path: src/lib/whatsapp.ts
import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";

const OUTBOX = "whatsapp_outbox";
const OUTBOX_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_MEDIA_BYTES = 16 * 1024 * 1024;

/** Shape of the inbound message fields we use (subset of Meta's payload). */
export interface WaMessage {
  id: string;
  from: string; // digits only, e.g. "27821234567"
  type: string; // text | image | video | audio | document | ...
  text?: { body: string };
  image?: { id: string; caption?: string; mime_type?: string };
  video?: { id: string; caption?: string; mime_type?: string };
  audio?: { id: string };
}

const toWaId = (phone: string) => phone.replace(/^\+/, "");

export async function sendText(to: string, text: string): Promise<void> {
  await adminDb().collection(OUTBOX).add({
    to: toWaId(to),
    text,
    status: "pending",
    attempts: 0,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + OUTBOX_TTL_MS),
  });
}

/** Fetch media cached by the persistent Baileys gateway while it processes the inbound message. */
export async function downloadMedia(mediaId: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const gatewayUrl = process.env.BAILEYS_GATEWAY_URL;
  const sharedSecret = process.env.BAILEYS_GATEWAY_SHARED_SECRET;
  if (!gatewayUrl || !sharedSecret) throw new Error("Baileys gateway is not configured.");

  const response = await fetch(`${gatewayUrl.replace(/\/$/, "")}/media/${encodeURIComponent(mediaId)}`, {
    headers: { Authorization: `Bearer ${sharedSecret}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`WhatsApp media download failed (${response.status})`);
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_MEDIA_BYTES) throw new Error("MEDIA_TOO_LARGE");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_MEDIA_BYTES) throw new Error("MEDIA_TOO_LARGE");
  return { buffer, mimeType: response.headers.get("content-type") ?? "application/octet-stream" };
}
