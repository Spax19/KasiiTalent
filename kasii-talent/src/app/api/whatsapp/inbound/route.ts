import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { WaMessage } from "@/lib/whatsapp";

interface InboundBody {
  message?: WaMessage;
  profileName?: string;
}

export const maxDuration = 60;

function isValidSignature(rawBody: string, header: string | null): boolean {
  // Support both variable names to prevent mismatch issues
  const secret = process.env.BAILEYS_GATEWAY_SHARED_SECRET || process.env.WHATSAPP_GATEWAY_SECRET;
  if (!secret || !header || !/^[a-f0-9]{64}$/.test(header)) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const supplied = Buffer.from(header, "hex");
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!isValidSignature(rawBody, request.headers.get("x-gateway-signature"))) {
    console.error("Webhook signature verification failed.");
    return NextResponse.json(
      { error: "Unauthorized gateway request." },
      { status: 401 },
    );
  }

  let body: InboundBody;
  try {
    body = JSON.parse(rawBody) as InboundBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid message payload." },
      { status: 400 },
    );
  }

  // Relaxed validation to accept both JIDs and raw user handles/numbers without requiring an '@'
  if (
    !body.message ||
    typeof body.message.id !== "string" ||
    typeof body.message.from !== "string" ||
    typeof body.message.type !== "string"
  ) {
    console.error("Invalid message payload structure received:", body);
    return NextResponse.json(
      { error: "Invalid message payload." },
      { status: 400 },
    );
  }

  try {
    const { handleIncomingMessage } = await import("@/services/whatsapp-bot");
    await handleIncomingMessage(body.message, body.profileName);
    return NextResponse.json(
      { received: true },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Baileys message processing failed", {
      name: (error as Error).name,
      message: (error as Error).message,
    });
    return NextResponse.json(
      { error: "Message processing failed." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}