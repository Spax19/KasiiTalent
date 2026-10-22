import { NextRequest, NextResponse } from "next/server";
import { issueWorkerLoginChallenge, WorkerLoginRateLimitError } from "@/services/worker-login";

export async function POST(request: NextRequest) {
  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  try {
    const challenge = await issueWorkerLoginChallenge(ipAddress);
    return NextResponse.json(challenge, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof WorkerLoginRateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429, headers: { "Cache-Control": "no-store" } });
    }
    console.error("worker login challenge creation failed", { name: (error as Error).name });
    return NextResponse.json(
      { error: "Worker sign-in is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}