// Path: src/services/whatsapp-bot.ts
// Conversation state machine for the WhatsApp-first worker experience.
// State lives in Firestore (wa_sessions/{phoneHash}, 7-day TTL) because serverless instances are stateless.
import "server-only";
import { createHash, randomInt } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb, COL } from "@/lib/firebase/admin";
import { hashPhone, normalizeSaPhone } from "@/lib/phone";
import { slugify } from "@/lib/schemas";
import { downloadMedia, sendText, type WaMessage } from "@/lib/whatsapp";
import { en as T, POLICY_VERSION } from "@/lib/bot-messages";
import { createWorkerProfile, DomainError } from "@/services/workers";
import { deleteWorkerAccount } from "@/services/erasure";
import { MediaError, recordPortfolioMedia, uploadWorkerMedia } from "@/services/media";
import { respondToContactRequest } from "@/services/contact";

const SESSIONS = "wa_sessions";
const PROCESSED = "wa_processed";
const VOUCH_CODES = "vouch_codes";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

type Step =
  | "consent" | "name" | "township" | "skills" | "years" | "media"
  | "confirm_delete" | "resume_confirm"
  | "vouch_name" | "vouch_rel" | "vouch_rating" | "vouch_comment";

type Relationship = "customer" | "employer" | "neighbour" | "peer";

interface SessionData {
  profileSharing?: boolean;
  displayName?: string;
  township?: string;
  skills?: string[];
  workerUid?: string;
  workerName?: string;
  voucherName?: string;
  relationship?: Relationship;
  rating?: number;
}
interface Session { step: Step; data: SessionData }

interface Ctx {
  phone: string;
  phoneHash: string;
  uid: string | null; // existing worker, if any
  msg: WaMessage;
  text: string;
  upper: string;
  session: Session | null;
  say: (text: string) => Promise<void>;
  /** `reset: true` replaces the stored answers instead of merging (used to drop onboarding PII once the profile exists). */
  setStep: (step: Step, data?: SessionData, reset?: boolean) => Promise<void>;
  endSession: () => Promise<void>;
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */
export async function handleIncomingMessage(msg: WaMessage, _profileName?: string): Promise<void> {
  const phone = normalizeSaPhone(msg.from);
  if (!phone) return; // this service is South Africa only
  if (!(await claimMessage(msg.id))) return; // Meta retries; process each message once

  const db = adminDb();
  const phoneHash = hashPhone(phone);
  const sessionRef = db.collection(SESSIONS).doc(phoneHash);

  const [sessionSnap, userSnap] = await Promise.all([
    sessionRef.get(),
    db.collection(COL.userPrivate).where("phoneHash", "==", phoneHash).limit(1).get(),
  ]);

  const expired = sessionSnap.exists && (sessionSnap.get("expiresAt") as Timestamp).toMillis() < Date.now();
  const session: Session | null =
    sessionSnap.exists && !expired
      ? { step: sessionSnap.get("step") as Step, data: (sessionSnap.get("data") ?? {}) as SessionData }
      : null;

  const text = msg.text?.body?.trim() ?? "";
  const ctx: Ctx = {
    phone,
    phoneHash,
    uid: userSnap.empty ? null : userSnap.docs[0].id,
    msg,
    text,
    upper: text.toUpperCase().replace(/\s+/g, " "),
    session,
    say: (body) => sendText(phone, body),
    setStep: async (step, data = {}, reset = false) => {
      await sessionRef.set({
        step,
        data: reset ? data : { ...(session?.data ?? {}), ...data },
        expiresAt: Timestamp.fromMillis(Date.now() + SESSION_TTL_MS),
      });
    },
    endSession: async () => {
      await sessionRef.delete();
    },
  };

  try {
    await route(ctx);
  } catch (err) {
    console.error("bot error", { name: (err as Error).name });
    await ctx.say(T.genericError).catch(() => undefined);
  }
}

/** Idempotency: returns false if this WhatsApp message id was already handled. */
async function claimMessage(messageId: string): Promise<boolean> {
  const id = createHash("sha256").update(messageId).digest("hex"); // ids may contain "/"
  try {
    await adminDb()
      .collection(PROCESSED)
      .doc(id)
      .create({ expiresAt: Timestamp.fromMillis(Date.now() + 2 * 24 * 60 * 60 * 1000) });
    return true;
  } catch (e) {
    if ((e as { code?: number }).code === 6) return false; // ALREADY_EXISTS
    throw e;
  }
}

/* ------------------------------------------------------------------ */
/* Routing                                                             */
/* ------------------------------------------------------------------ */
async function route(ctx: Ctx): Promise<void> {
  const { upper, uid, session } = ctx;

  // Global commands work in any state.
  if (upper === "STOP") return handleStop(ctx);
  const vouch = /^VOUCH ([A-Z0-9]{6})$/.exec(upper);
  if (vouch) return startVouch(ctx, vouch[1]);
  if (upper === "HELP" || upper === "MENU") return ctx.say(T.help);

  if (uid) {
    if (upper === "PAUSE") {
      await setVisibility(uid, "paused");
      await ctx.endSession();
      return ctx.say(T.paused);
    }
    if (upper === "RESUME") {
      await ctx.setStep("resume_confirm");
      return ctx.say(T.resumeAsk);
    }
    if (upper === "DELETE") {
      await ctx.setStep("confirm_delete");
      return ctx.say(T.confirmDelete);
    }
    if (upper === "CODE") {
      const code = await getOrIssueVouchCode(uid);
      return ctx.say(T.yourCode(code));
    }
  } else if (upper === "DELETE") {
    await ctx.endSession();
    return ctx.say(T.stoppedNoData);
  }

  switch (session?.step) {
    case "consent": return stepConsent(ctx);
    case "name": return stepName(ctx);
    case "township": return stepTownship(ctx);
    case "skills": return stepSkills(ctx);
    case "years": return stepYears(ctx);
    case "media": return stepMedia(ctx);
    case "confirm_delete": return stepConfirmDelete(ctx);
    case "resume_confirm": return stepResume(ctx);
    case "vouch_name": return stepVouchName(ctx);
    case "vouch_rel": return stepVouchRelationship(ctx);
    case "vouch_rating": return stepVouchRating(ctx);
    case "vouch_comment": return stepVouchComment(ctx);
  }

  if (!uid) {
    // First contact: consent BEFORE anything is stored about the person.
    await ctx.setStep("consent");
    return ctx.say(T.consent());
  }
  return idle(ctx);
}

async function idle(ctx: Ctx): Promise<void> {
  const { msg, upper, uid } = ctx;
  if (!uid) return;

  if (msg.type === "image" || msg.type === "video") return handleMedia(ctx);
  if (upper === "NEW PHOTO" || upper === "PHOTO" || upper === "NEW VIDEO") {
    await ctx.setStep("media");
    return ctx.say(T.askMedia);
  }
  if (upper === "1" || upper === "2") {
    const { found } = await respondToContactRequest(uid, upper === "1");
    if (found) return ctx.say(upper === "1" ? T.contactShared : T.contactDeclined);
  }
  return ctx.say(T.help);
}

/* ------------------------------------------------------------------ */
/* Onboarding steps                                                    */
/* ------------------------------------------------------------------ */
async function stepConsent(ctx: Ctx) {
  if (ctx.upper !== "1" && ctx.upper !== "2") return ctx.say(T.consentRetry);
  await ctx.setStep("name", { profileSharing: ctx.upper === "1" });
  return ctx.say(T.askName);
}

async function stepName(ctx: Ctx) {
  if (ctx.msg.type !== "text") return ctx.say(T.textOnly);
  if (ctx.text.length < 2 || ctx.text.length > 60) return ctx.say(T.invalid);
  await ctx.setStep("township", { displayName: ctx.text });
  return ctx.say(T.askTownship);
}

async function stepTownship(ctx: Ctx) {
  if (ctx.msg.type !== "text") return ctx.say(T.textOnly);
  if (ctx.text.length < 2 || ctx.text.length > 60) return ctx.say(T.invalid);
  await ctx.setStep("skills", { township: ctx.text });
  return ctx.say(T.askSkills);
}

async function stepSkills(ctx: Ctx) {
  if (ctx.msg.type !== "text") return ctx.say(T.textOnly);
  const skills = [...new Set(ctx.text.split(/[,\n;]| and /i).map((s) => s.trim()).filter((s) => s.length >= 2 && s.length <= 50))].slice(0, 5);
  if (skills.length === 0) return ctx.say(T.invalid);
  await ctx.setStep("years", { skills });
  return ctx.say(T.askYears);
}

async function stepYears(ctx: Ctx) {
  if (ctx.msg.type !== "text") return ctx.say(T.textOnly);
  const years = Number.parseInt(ctx.text, 10);
  const d = ctx.session?.data;
  if (!Number.isFinite(years) || years < 0 || years > 60) return ctx.say(T.invalid);
  if (!d?.displayName || !d.township || !d.skills?.length) {
    await ctx.endSession(); // corrupted session: start over
    return ctx.say(T.genericError);
  }

  try {
    const { uid } = await createWorkerProfile({
      phone: ctx.phone,
      displayName: d.displayName,
      township: d.township,
      city: "",
      province: "",
      bio: "",
      languages: [],
      skills: d.skills.map((label) => ({ label, category: "services", yearsExperience: years })),
      consents: {
        terms: true,
        age18Plus: true, // confirmed in the consent message the user replied to
        profileSharing: d.profileSharing === true,
        policyVersion: POLICY_VERSION,
      },
      channel: "whatsapp",
      sourceMessageId: ctx.msg.id,
    });
    const code = await getOrIssueVouchCode(uid);
    await ctx.setStep("media", {}, true); // profile exists: wipe the temporary onboarding answers
    return ctx.say(T.welcome(d.displayName, code));
  } catch (err) {
    if (err instanceof DomainError) return ctx.say(T.invalid);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/* Media                                                               */
/* ------------------------------------------------------------------ */
async function stepMedia(ctx: Ctx) {
  if (ctx.msg.type === "image" || ctx.msg.type === "video") return handleMedia(ctx);
  if (ctx.upper === "DONE" || ctx.upper === "SKIP") {
    await ctx.endSession();
    return ctx.say(T.mediaDone);
  }
  return ctx.say(T.askMedia);
}

async function handleMedia(ctx: Ctx) {
  const { uid, msg } = ctx;
  if (!uid) return;
  const type = msg.type === "video" ? "video" : "image";
  const item = type === "video" ? msg.video : msg.image;
  if (!item?.id) return ctx.say(T.mediaFailed);

  const db = adminDb();
  // Photos sent over WhatsApp attach to the worker's first listed skill; they can re-tag on the website.
  const skills = await db.collection(COL.skills).where("uid", "==", uid).limit(1).get();
  const skillSlug = (skills.docs[0]?.get("skillSlug") as string | undefined) ?? slugify("general");

  try {
    const { buffer } = await downloadMedia(item.id);
    const uploaded = await uploadWorkerMedia(uid, buffer, type);
    await recordPortfolioMedia(uid, {
      publicId: uploaded.public_id,
      secureUrl: uploaded.secure_url,
      type,
      skillSlug,
      caption: (item.caption ?? "").slice(0, 140),
      width: uploaded.width,
      height: uploaded.height,
      bytes: uploaded.bytes,
      durationSec: typeof uploaded.duration === "number" && uploaded.duration > 0 ? uploaded.duration : undefined,
    });
    await ctx.setStep("media");
    return ctx.say(T.mediaSaved);
  } catch (err) {
    if (err instanceof MediaError) return ctx.say(err.message);
    console.error("media handling failed", { name: (err as Error).name });
    return ctx.say(T.mediaFailed);
  }
}

/* ------------------------------------------------------------------ */
/* Account controls (POPIA: withdraw consent, erasure)                 */
/* ------------------------------------------------------------------ */
async function setVisibility(uid: string, visibility: "visible" | "paused") {
  await adminDb()
    .collection(COL.users)
    .doc(uid)
    .update({ visibility, updatedAt: FieldValue.serverTimestamp() });
}

async function recordConsent(uid: string, type: "profile_sharing", granted: boolean, sourceMessageId: string) {
  await adminDb().collection(COL.consents).add({
    uid,
    type,
    granted,
    policyVersion: POLICY_VERSION,
    channel: "whatsapp",
    sourceMessageId,
    createdAt: FieldValue.serverTimestamp(),
  });
}

async function handleStop(ctx: Ctx) {
  if (ctx.uid) {
    await setVisibility(ctx.uid, "paused");
    await recordConsent(ctx.uid, "profile_sharing", false, ctx.msg.id); // consent withdrawn, audited
    await ctx.endSession();
    return ctx.say(T.stopped);
  }
  await ctx.endSession(); // drops any partial onboarding answers
  return ctx.say(T.stoppedNoData);
}

async function stepResume(ctx: Ctx) {
  if (!ctx.uid || ctx.upper !== "1") {
    await ctx.endSession();
    return ctx.say(T.help);
  }
  await recordConsent(ctx.uid, "profile_sharing", true, ctx.msg.id);
  await setVisibility(ctx.uid, "visible");
  await ctx.endSession();
  return ctx.say(T.resumed);
}

async function stepConfirmDelete(ctx: Ctx) {
  if (ctx.uid && ctx.upper === "YES DELETE") {
    await deleteWorkerAccount(ctx.uid); // also removes this phone's wa_sessions doc
    return ctx.say(T.deleted);
  }
  await ctx.endSession();
  return ctx.say(T.deleteCancelled);
}

/* ------------------------------------------------------------------ */
/* Community vouching                                                  */
/* ------------------------------------------------------------------ */
function randomCode(): string {
  return Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}

async function getOrIssueVouchCode(uid: string): Promise<string> {
  const db = adminDb();
  const existing = await db.collection(VOUCH_CODES).where("uid", "==", uid).limit(1).get();
  if (!existing.empty) return existing.docs[0].id;

  for (let i = 0; i < 5; i++) {
    const code = randomCode();
    try {
      await db.collection(VOUCH_CODES).doc(code).create({ uid, createdAt: FieldValue.serverTimestamp() });
      return code;
    } catch (e) {
      if ((e as { code?: number }).code !== 6) throw e; // only retry on collision
    }
  }
  throw new Error("Could not allocate vouch code");
}

const endorsementId = (workerUid: string, voucherHash: string) => `${workerUid}_${voucherHash}`;

async function startVouch(ctx: Ctx, code: string) {
  const db = adminDb();
  const codeSnap = await db.collection(VOUCH_CODES).doc(code).get();
  if (!codeSnap.exists) return ctx.say(T.vouchInvalid);

  const workerUid = codeSnap.get("uid") as string;
  if (workerUid === ctx.uid) return ctx.say(T.vouchSelf);

  const [already, worker] = await Promise.all([
    db.collection(COL.endorsements).doc(endorsementId(workerUid, ctx.phoneHash)).get(),
    db.collection(COL.users).doc(workerUid).get(),
  ]);
  if (already.exists) return ctx.say(T.vouchAlready);
  if (!worker.exists) return ctx.say(T.vouchInvalid);

  const workerName = worker.get("displayName") as string;
  await ctx.setStep("vouch_name", { workerUid, workerName });
  return ctx.say(T.vouchIntro(workerName));
}

async function stepVouchName(ctx: Ctx) {
  if (ctx.msg.type !== "text") return ctx.say(T.textOnly);
  if (ctx.text.length < 2 || ctx.text.length > 60) return ctx.say(T.invalid);
  await ctx.setStep("vouch_rel", { voucherName: ctx.text });
  return ctx.say(T.vouchRelationship);
}

async function stepVouchRelationship(ctx: Ctx) {
  const map: Record<string, Relationship> = { "1": "customer", "2": "employer", "3": "neighbour", "4": "peer" };
  const relationship = map[ctx.upper];
  if (!relationship) return ctx.say(T.vouchRelationship);
  await ctx.setStep("vouch_rating", { relationship });
  return ctx.say(T.vouchRating);
}

async function stepVouchRating(ctx: Ctx) {
  if (!/^[1-5]$/.test(ctx.upper)) return ctx.say(T.vouchRating);
  await ctx.setStep("vouch_comment", { rating: Number(ctx.upper) });
  return ctx.say(T.vouchComment);
}

async function stepVouchComment(ctx: Ctx) {
  if (ctx.msg.type !== "text") return ctx.say(T.textOnly);
  const d = ctx.session?.data;
  if (!d?.workerUid || !d.voucherName || !d.relationship || !d.rating) {
    await ctx.endSession();
    return ctx.say(T.genericError);
  }
  const comment = ctx.upper === "SKIP" ? "" : ctx.text.slice(0, 280);

  const db = adminDb();
  const userRef = db.collection(COL.users).doc(d.workerUid);
  const endorsementRef = db.collection(COL.endorsements).doc(endorsementId(d.workerUid, ctx.phoneHash));
  const skillsQuery = db.collection(COL.skills).where("uid", "==", d.workerUid);
  let duplicate = false;

  await db.runTransaction(async (tx) => {
    // All reads first (Firestore requirement).
    const [userSnap, skillsSnap, existing] = await Promise.all([tx.get(userRef), tx.get(skillsQuery), tx.get(endorsementRef)]);
    if (existing.exists) { duplicate = true; return; }
    if (!userSnap.exists) throw new Error("WORKER_GONE");

    const count = (userSnap.get("ratingCount") as number) ?? 0;
    const avg = (userSnap.get("ratingAvg") as number) ?? 0;
    const newCount = count + 1;
    const newAvg = Math.round(((avg * count + d.rating!) / newCount) * 100) / 100;

    // The voucher's phone is verified by WhatsApp itself, so the endorsement is approved immediately.
    // Two distinct vouches move a skill from "pending" to "community_vouched".
    let verified = 0;
    for (const s of skillsSnap.docs) {
      const vouchCount = ((s.get("vouchCount") as number) ?? 0) + 1;
      const current = s.get("verificationStatus") as string;
      const next = current === "pending" && vouchCount >= 2 ? "community_vouched" : current;
      if (next !== "pending") verified++;
      tx.update(s.ref, { vouchCount, verificationStatus: next, updatedAt: FieldValue.serverTimestamp() });
    }

    tx.set(endorsementRef, {
      workerUid: d.workerUid,
      voucherName: d.voucherName,
      voucherRelationship: d.relationship,
      voucherPhoneHash: ctx.phoneHash, // never the number itself
      rating: d.rating,
      comment,
      status: "approved",
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.update(userRef, {
      ratingAvg: newAvg,
      ratingCount: newCount,
      endorsementCount: FieldValue.increment(1),
      verifiedSkillCount: verified,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  await ctx.endSession();
  if (duplicate) return ctx.say(T.vouchAlready);
  await ctx.say(T.vouchThanks);

  // Best-effort nudge to the worker (may fail outside the 24h window; that is fine).
  const priv = await db.collection(COL.userPrivate).doc(d.workerUid).get();
  const workerPhone = priv.get("phoneE164") as string | undefined;
  if (workerPhone) await sendText(workerPhone, T.vouchNotify(d.voucherName)).catch(() => undefined);
}
