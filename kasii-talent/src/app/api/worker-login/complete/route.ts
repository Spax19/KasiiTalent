import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { completeWorkerLoginChallenge } from "@/services/worker-login";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    pollToken?: string;
    idToken?: string;
  };
  if (
    typeof body.id !== "string" ||
    !/^[a-f0-9]{64}$/.test(body.id) ||
    typeof body.pollToken !== "string" ||
    !/^[a-f0-9]{64}$/.test(body.pollToken) ||
    typeof body.idToken !== "string"
  ) {
    return NextResponse.json({ error: "Invalid sign-in challenge." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const decoded = await adminAuth().verifyIdToken(body.idToken, true);
    const completed = await completeWorkerLoginChallenge(body.id, body.pollToken, decoded.uid);
    if (!completed) {
      return NextResponse.json({ error: "This sign-in challenge is invalid or expired." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("worker login challenge completion failed", { name: (error as Error).name });
    return NextResponse.json(
      { error: "Worker sign-in is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}