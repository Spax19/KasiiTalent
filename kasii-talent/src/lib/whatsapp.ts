// Path: src/lib/whatsapp.ts
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const GRAPH = "https://graph.facebook.com/v21.0";
const MAX_MEDIA_BYTES = 16 * 1024 * 1024; // WhatsApp's own limit for video

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

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable: ${name}`);
  return v;
}

const authHeader = () => ({ Authorization: `Bearer ${env("WHATSAPP_TOKEN")}` });

/** Verifies Meta's X-Hub-Signature-256 header against the RAW request body. */
export function verifySignature(rawBody: string, header: string | null): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", env("WHATSAPP_APP_SECRET")).update(rawBody).digest();
  const given = Buffer.from(header.slice("sha256=".length), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function post(body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${GRAPH}/${env("WHATSAPP_PHONE_NUMBER_ID")}/messages`, {
    method: "POST",
    headers: { ...authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
  });
  // Do not include the response body or recipient in the error: they can contain personal data.
  if (!res.ok) throw new Error(`WhatsApp send failed (${res.status})`);
}

const toWaId = (phone: string) => phone.replace(/^\+/, "");

/** Free-form text. Only delivered inside the 24h customer-service window. */
export const sendText = (to: string, body: string) =>
  post({ to: toWaId(to), type: "text", text: { body, preview_url: false } });

/** Pre-approved template: required for business-initiated messages outside the 24h window. */
export const sendTemplate = (to: string, name: string, lang: string, params: string[]) =>
  post({
    to: toWaId(to),
    type: "template",
    template: {
      name,
      language: { code: lang },
      components: params.length
        ? [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }]
        : [],
    },
  });

/** Two-step media fetch: resolve the temporary URL, then download with the bearer token. */
export async function downloadMedia(mediaId: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const metaRes = await fetch(`${GRAPH}/${mediaId}`, { headers: authHeader() });
  if (!metaRes.ok) throw new Error(`WhatsApp media lookup failed (${metaRes.status})`);
  const meta = (await metaRes.json()) as { url: string; mime_type: string; file_size?: number };
  if (meta.file_size && meta.file_size > MAX_MEDIA_BYTES) throw new Error("MEDIA_TOO_LARGE");

  const binRes = await fetch(meta.url, { headers: authHeader() });
  if (!binRes.ok) throw new Error(`WhatsApp media download failed (${binRes.status})`);
  return { buffer: Buffer.from(await binRes.arrayBuffer()), mimeType: meta.mime_type };
}
