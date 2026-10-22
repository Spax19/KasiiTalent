import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { getWorkerLoginChallenge } from "@/services/worker-login";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { id?: string; pollToken?: string };
  if (
    typeof body.id !== "string" ||
    !/^[a-f0-9]{64}$/.test(body.id) ||
    typeof body.pollToken !== "string" ||
    !/^[a-f0-9]{64}$/.test(body.pollToken)
  ) {
    return NextResponse.json({ error: "Invalid sign-in challenge." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const result = await getWorkerLoginChallenge(body.id, body.pollToken);
    if (result.status === "pending") {
      return NextResponse.json({ status: "pending" }, { headers: { "Cache-Control": "no-store" } });
    }
    if (result.status === "expired") {
      return NextResponse.json({ status: "expired" }, { status: 410, headers: { "Cache-Control": "no-store" } });
    }
    if (result.status !== "verified") {
      return NextResponse.json({ error: "Invalid sign-in challenge." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }

    const customToken = await adminAuth().createCustomToken(result.workerUid, { role: "worker" });
    return NextResponse.json({ status: "verified", customToken }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("worker login challenge check failed", { name: (error as Error).name });
    return NextResponse.json(
      { error: "Worker sign-in is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}