import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb, COL } from "@/lib/firebase/admin";

const CHALLENGES = "worker_login_challenges";
const RATE_LIMITS = "worker_login_rate_limits";
const CHALLENGE_TTL_MS = 3 * 60 * 1000;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 5;

export class WorkerLoginRateLimitError extends Error {}

export async function issueWorkerLoginChallenge(ipAddress: string) {
  const db = adminDb();
  const pepper = process.env.PHONE_HASH_PEPPER;
  if (!pepper) throw new Error("Missing environment variable: PHONE_HASH_PEPPER");
  const rateLimitId = createHmac("sha256", pepper)
    .update(ipAddress || "unknown")
    .digest("hex");
  const rateLimitRef = db.collection(RATE_LIMITS).doc(rateLimitId);

  const allowed = await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(rateLimitRef);
    const data = snapshot.data();
    const windowStartedAt = data?.windowStartedAt as Timestamp | undefined;
    const count = (data?.count as number | undefined) ?? 0;
    const inWindow = windowStartedAt && Date.now() - windowStartedAt.toMillis() < RATE_WINDOW_MS;
    if (inWindow && count >= RATE_LIMIT) return false;

    tx.set(rateLimitRef, {
      count: inWindow ? count + 1 : 1,
      windowStartedAt: inWindow ? windowStartedAt : Timestamp.now(),
      expiresAt: Timestamp.fromMillis(Date.now() + RATE_WINDOW_MS),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return true;
  });
  if (!allowed) throw new WorkerLoginRateLimitError("Too many sign-in attempts. Try again in a few minutes.");

  const code = randomBytes(16).toString("hex").toUpperCase();
  const id = createHash("sha256").update(code).digest("hex");
  const pollToken = randomBytes(32).toString("hex");
  const expiresAt = Timestamp.fromMillis(Date.now() + CHALLENGE_TTL_MS);

  await db.collection(CHALLENGES).doc(id).create({
    status: "pending",
    pollTokenHash: createHash("sha256").update(pollToken).digest("hex"),
    expiresAt,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { id, code, pollToken, expiresAt: expiresAt.toMillis() };
}

export async function approveWorkerLoginChallenge(code: string, workerUid: string) {
  const db = adminDb();
  const id = createHash("sha256").update(code).digest("hex");
  const challengeRef = db.collection(CHALLENGES).doc(id);
  const workerRef = db.collection(COL.users).doc(workerUid);

  return db.runTransaction(async (tx) => {
    const [challenge, worker] = await Promise.all([tx.get(challengeRef), tx.get(workerRef)]);
    if (!worker.exists || worker.get("role") !== "worker") return "not_worker" as const;
    if (!challenge.exists || challenge.get("status") !== "pending") return "invalid" as const;
    if ((challenge.get("expiresAt") as Timestamp).toMillis() <= Date.now()) {
      tx.update(challengeRef, { status: "expired" });
      return "expired" as const;
    }

    tx.update(challengeRef, {
      status: "verified",
      workerUid,
      verifiedAt: FieldValue.serverTimestamp(),
    });
    return "verified" as const;
  });
}

function pollTokenMatches(storedHash: string, pollToken: string): boolean {
  const stored = Buffer.from(storedHash, "hex");
  const given = Buffer.from(createHash("sha256").update(pollToken).digest("hex"), "hex");
  return stored.length === given.length && timingSafeEqual(stored, given);
}

export async function getWorkerLoginChallenge(id: string, pollToken: string) {
  const db = adminDb();
  const challengeRef = db.collection(CHALLENGES).doc(id);

  return db.runTransaction(async (tx) => {
    const challenge = await tx.get(challengeRef);
    if (!challenge.exists) return { status: "invalid" as const };

    const storedHash = challenge.get("pollTokenHash") as string;
    if (!pollTokenMatches(storedHash, pollToken)) {
      return { status: "invalid" as const };
    }

    const status = challenge.get("status");
    if (status === "pending") {
      if ((challenge.get("expiresAt") as Timestamp).toMillis() <= Date.now()) {
        tx.update(challengeRef, { status: "expired" });
        return { status: "expired" as const };
      }
      return { status: "pending" as const };
    }
    if (status !== "verified") return { status: "invalid" as const };
    if ((challenge.get("expiresAt") as Timestamp).toMillis() <= Date.now()) {
      tx.update(challengeRef, { status: "expired" });
      return { status: "expired" as const };
    }

    return { status: "verified" as const, workerUid: challenge.get("workerUid") as string };
  });
}

export async function completeWorkerLoginChallenge(id: string, pollToken: string, workerUid: string) {
  const db = adminDb();
  const challengeRef = db.collection(CHALLENGES).doc(id);

  return db.runTransaction(async (tx) => {
    const challenge = await tx.get(challengeRef);
    if (!challenge.exists || challenge.get("status") !== "verified") return false;

    const storedHash = challenge.get("pollTokenHash") as string;
    if (!pollTokenMatches(storedHash, pollToken) || challenge.get("workerUid") !== workerUid) return false;
    if ((challenge.get("expiresAt") as Timestamp).toMillis() <= Date.now()) {
      tx.update(challengeRef, { status: "expired" });
      return false;
    }

    tx.update(challengeRef, { status: "consumed", consumedAt: FieldValue.serverTimestamp() });
    return true;
  });
}