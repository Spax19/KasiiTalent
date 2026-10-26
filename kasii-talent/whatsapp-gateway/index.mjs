import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import makeWASocket, {
  DisconnectReason,
  downloadMediaMessage,
  useMultiFileAuthState as loadMultiFileAuthState,
} from "@whiskeysockets/baileys";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import pino from "pino";
import qrcode from "qrcode-terminal";

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
};

const appUrl = (process.env.VERCEL_APP_URL || "http://localhost:3000").replace(/\/$/, "");
const sharedSecret = required("BAILEYS_GATEWAY_SHARED_SECRET");
const authDir = path.resolve(process.env.BAILEYS_AUTH_DIR ?? "./data/auth");
const port = Number(process.env.PORT ?? 8787);
const maxMediaBytes = 16 * 1024 * 1024;
const mediaCache = new Map();
const mediaTtlMs = 5 * 60 * 1000;
const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: ["*.phone", "*.text", "*.token"],
});

const projectId = required("FIREBASE_PROJECT_ID");
const app =
  getApps()[0] ??
  initializeApp({
    credential: cert({
      projectId,
      clientEmail: required("FIREBASE_CLIENT_EMAIL"),
      privateKey: required("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    }),
  });
const db = getFirestore(app);
const outbox = db.collection("whatsapp_outbox");

function authorized(request) {
  const header = request.headers.authorization ?? "";
  const supplied = Buffer.from(header.replace(/^Bearer\s+/i, ""));
  const expected = Buffer.from(sharedSecret);
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
}

function unwrapContent(message) {
  let content = message.message;
  content =
    content?.ephemeralMessage?.message ??
    content?.viewOnceMessage?.message ??
    content?.viewOnceMessageV2?.message ??
    content;
  return content;
}

function extractMessage(message) {
  const jid = message.key.remoteJid ?? "";
  console.log("[EXTRACT DEBUG] remoteJid:", jid, "fromMe:", message.key.fromMe, "id:", message.key.id);

  const content = unwrapContent(message);
  console.log("[EXTRACT DEBUG] unwrapped content keys:", content ? Object.keys(content) : "null");

  const text =
    content?.conversation ?? content?.extendedTextMessage?.text ?? "";
  
  // Temporarily allow both @s.whatsapp.net and @lid for local debugging
  if (!jid.includes("@s.whatsapp.net") && !jid.includes("@lid")) {
    console.log("[EXTRACT FAIL] JID did not match allowed suffixes:", jid);
    return null;
  }
  if (message.key.fromMe) {
    console.log("[EXTRACT FAIL] Message was sent from self (fromMe: true)");
    return null;
  }
  if (!message.key.id) {
    console.log("[EXTRACT FAIL] Missing message key ID");
    return null;
  }

  // Extract phone number or fallback to raw sender handle if LID
  let from = "";
  if (jid.includes("@s.whatsapp.net")) {
    from = jid.split("@")[0].split(":")[0];
  } else {
    from = message.key.participant?.split("@")[0].split(":")[0] || jid.split("@")[0];
  }

  const id = message.key.id;
  const image = content?.imageMessage;
  const video = content?.videoMessage;
  const audio = content?.audioMessage;
  const document = content?.documentMessage;

  if (image || video) {
    return {
      id,
      from,
      type: image ? "image" : "video",
      ...(image ? { image: { id, caption: image.caption, mime_type: image.mimetype } } : {}),
      ...(video ? { video: { id, caption: video.caption, mime_type: video.mimetype } } : {}),
    };
  }
  if (audio) return { id, from, type: "audio", audio: { id } };
  if (document) return { id, from, type: "document" };
  
  return { id, from, type: "text", text: { body: text } };
}

async function sendInbound(message, profileName) {
  const body = JSON.stringify({ message, profileName });
  const signature = createHmac("sha256", sharedSecret)
    .update(body)
    .digest("hex");
  let lastError;
  
  console.log(`[GATEWAY] Forwarding inbound message from ${message.from} to ${appUrl}/api/whatsapp/inbound`);

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(`${appUrl}/api/whatsapp/inbound`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gateway-signature": signature,
        },
        body,
        signal: AbortSignal.timeout(65000),
      });
      
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`App inbound endpoint returned ${response.status}: ${errText}`);
      }
      
      console.log(`[GATEWAY] Successfully delivered message ${message.id} to Next.js webhook.`);
      return;
    } catch (error) {
      lastError = error;
      console.error(`[GATEWAY ERROR] Attempt ${attempt + 1} failed:`, error.message);
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(1000 * 2 ** attempt, 8000)),
      );
    }
  }
  throw lastError;
}

async function cacheMedia(message, waMessage) {
  const content = unwrapContent(message);
  const mediaMessage = content?.imageMessage ?? content?.videoMessage;
  if (!mediaMessage || !waMessage.id) return;
  const buffer = await downloadMediaMessage(message, "buffer", {}, { logger });
  if (buffer.byteLength > maxMediaBytes)
    throw new Error("Inbound media exceeds configured limit.");
  const mimeType = mediaMessage.mimetype ?? "application/octet-stream";
  mediaCache.set(waMessage.id, {
    buffer,
    mimeType,
    expiresAt: Date.now() + mediaTtlMs,
  });
}

let socket;
let connected = false;
let reconnectTimer;
let outboxBusy = false;

async function processOutbox() {
  if (!connected || !socket || outboxBusy) return;
  outboxBusy = true;
  try {
    const snapshot = await outbox
      .where("status", "in", ["pending", "processing"])
      .limit(20)
      .get();
    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (
        data.status === "processing" &&
        (data.leaseUntil?.toMillis?.() ?? 0) > Date.now()
      )
        continue;
      if (
        data.status === "pending" &&
        (data.nextAttemptAt?.toMillis?.() ?? 0) > Date.now()
      )
        continue;

      const claimed = await db.runTransaction(async (tx) => {
        const current = await tx.get(doc.ref);
        if (!current.exists) return false;
        const currentData = current.data();
        if (
          currentData.status === "sent" ||
          (currentData.status === "processing" &&
            (currentData.leaseUntil?.toMillis?.() ?? 0) > Date.now())
        )
          return false;
        tx.update(doc.ref, {
          status: "processing",
          leaseUntil: Timestamp.fromMillis(Date.now() + 60000),
          attempts: FieldValue.increment(1),
        });
        return true;
      });
      if (!claimed) continue;

      try {
        const to = String(data.to ?? "").replace(/\D/g, "");
        if (!/^\d{9,15}$/.test(to) || typeof data.text !== "string")
          throw new Error("Invalid outbox message.");
        await socket.sendMessage(`${to}@s.whatsapp.net`, { text: data.text });
        await doc.ref.update({
          status: "sent",
          sentAt: FieldValue.serverTimestamp(),
          leaseUntil: FieldValue.delete(),
        });
      } catch (error) {
        const attempts = (data.attempts ?? 0) + 1;
        await doc.ref.update({
          status: attempts >= 5 ? "failed" : "pending",
          lastError: String(error?.message ?? "send failed").slice(0, 120),
          nextAttemptAt: Timestamp.fromMillis(
            Date.now() + Math.min(attempts * 5000, 60000),
          ),
          leaseUntil: FieldValue.delete(),
        });
        logger.error(
          { outboxId: doc.id, attempts, error: error?.message },
          "message delivery failed",
        );
      }
    }
  } catch (error) {
    logger.error({ error: error?.message }, "outbox polling failed");
  } finally {
    outboxBusy = false;
  }
}

async function connect() {
  await mkdir(authDir, { recursive: true, mode: 0o700 });
  const { state, saveCreds } = await loadMultiFileAuthState(authDir);
  socket = makeWASocket({
    auth: state,
    logger,
    printQRInTerminal: false,
    markOnlineOnConnect: false,
  });
  socket.ev.on("creds.update", saveCreds);
  socket.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      logger.warn(
        "Scan this pairing QR from WhatsApp > Linked devices. Keep gateway logs private.",
      );
      qrcode.generate(qr, { small: true });
    }
    if (connection === "open") {
      connected = true;
      logger.info("Baileys connected");
    }
    if (connection === "close") {
      connected = false;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      logger.warn({ statusCode }, "Baileys connection closed");
      socket = undefined;
      if (statusCode !== DisconnectReason.loggedOut) {
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(
          () =>
            void connect().catch((error) =>
              logger.error({ error: error.message }, "reconnect failed"),
            ),
          3000,
        );
      } else {
        logger.error(
          "WhatsApp logged this device out. Remove the persisted auth state and pair again.",
        );
      }
    }
  });
  socket.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const message of messages) {
      console.log("[GATEWAY] Raw message upsert received:", message.key?.id);
      const waMessage = extractMessage(message);
      if (!waMessage) {
        console.log("[GATEWAY] Message filtered out by extractMessage()");
        continue;
      }
      try {
        await cacheMedia(message, waMessage);
        await sendInbound(waMessage, message.pushName);
      } catch (error) {
        logger.error(
          { messageId: waMessage.id, error: error?.message },
          "inbound message relay failed",
        );
      }
    }
  });
}

const server = createServer(async (request, response) => {
  const url = new URL(
    request.url ?? "/",
    `http://${request.headers.host ?? "localhost"}`,
  );
  if (request.method === "GET" && url.pathname === "/health") {
    response.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    response.end(JSON.stringify({ ok: true, connected }));
    return;
  }
  if (request.method === "GET" && url.pathname.startsWith("/media/")) {
    if (!authorized(request)) {
      response.writeHead(401);
      response.end();
      return;
    }
    const id = decodeURIComponent(url.pathname.slice("/media/".length));
    const cached = mediaCache.get(id);
    if (!cached || cached.expiresAt <= Date.now()) {
      mediaCache.delete(id);
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, {
      "Content-Type": cached.mimeType,
      "Content-Length": cached.buffer.byteLength,
      "Cache-Control": "no-store",
    });
    response.end(cached.buffer);
    mediaCache.delete(id);
    return;
  }
  response.writeHead(404);
  response.end();
});

server.listen(port, "0.0.0.0", () =>
  logger.info({ port }, "Baileys gateway listening"),
);
setInterval(() => {
  for (const [id, media] of mediaCache)
    if (media.expiresAt <= Date.now()) mediaCache.delete(id);
  void processOutbox();
}, 3000).unref();
void connect().catch((error) =>
  logger.error({ error: error.message }, "initial Baileys connection failed"),
);