// Path: src/app/api/whatsapp/webhook/route.ts
import { after, NextRequest, NextResponse } from "next/server";
import { verifySignature, type WaMessage } from "../../../../lib/whatsapp";
import { handleIncomingMessage } from "../../../../services/whatsapp-bot";

export const maxDuration = 60; // media download + Cloudinary upload can be slow; check your plan's limit

/** Meta's one-time webhook verification handshake. */
export function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const ok =
    p.get("hub.mode") === "subscribe" &&
    !!process.env.WHATSAPP_VERIFY_TOKEN &&
    p.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN;
  return ok ? new NextResponse(p.get("hub.challenge"), { status: 200 }) : new NextResponse("Forbidden", { status: 403 });
}

interface WebhookPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: WaMessage[];
        contacts?: Array<{ wa_id: string; profile?: { name?: string } }>;
      };
    }>;
  }>;
}

export async function POST(req: NextRequest) {
  // Signature must be checked against the exact raw bytes, so read text() before parsing.
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }

  const jobs: Array<{ message: WaMessage; profileName?: string }> = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      for (const message of value?.messages ?? []) {
        const profileName = value?.contacts?.find((c) => c.wa_id === message.from)?.profile?.name;
        jobs.push({ message, profileName });
      }
    }
  }

  // Acknowledge immediately (Meta retries slow webhooks), then do the work after the response.
  after(async () => {
    for (const job of jobs) {
      try {
        await handleIncomingMessage(job.message, job.profileName);
      } catch (err) {
        console.error("whatsapp handler failed", { name: (err as Error).name }); // never log message content or numbers
      }
    }
  });

  return NextResponse.json({ received: true });
}
