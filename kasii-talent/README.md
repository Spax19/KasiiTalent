# KasiTalent

WhatsApp-first worker profiles with employer discovery and consent-based service requests.

## Local setup

Run these commands from this directory, beside `package.json`:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

On Windows PowerShell, use `Copy-Item .env.example .env.local` instead of `cp`. Fill in `.env.local` with the Firebase, gateway, and Cloudinary values for your development projects. Never commit `.env.local` or expose server secrets through `NEXT_PUBLIC_` variables. The checked-in `.env.example` files contain variable names only.

## Product flows

- Workers start on WhatsApp, create a profile, and add work samples by sending photos or videos.
- Workers sign in by opening a short-lived WhatsApp link or scanning its QR code, then approving the sign-in from the WhatsApp number linked to their profile. Passwords and SMS codes are never requested.
- Employers create an account, browse visible worker profiles, filter by skills and rating, and request a service.
- Workers accept or decline requests in WhatsApp. Their number is shared with the requesting employer only after acceptance.
- Workers can request general or skill-specific community reviews by sending `CODE` or `CODE <skill>` to the WhatsApp bot, then sharing the resulting code with a reviewer.

## External services

Configure Firebase Authentication with Email/Password and Google providers. Add local and production web domains to Firebase's authorized domains. Create the default Firestore database. Configure Firebase Admin credentials for the Next.js app and the gateway; keep private keys server-side and use the least-privilege service accounts supported by your deployment.

The `firestore.indexes.json` configuration enables Firestore TTL on `expiresAt` for `worker_login_challenges`, `worker_login_rate_limits`, `whatsapp_outbox`, `wa_sessions`, and `wa_processed`, so expired challenges, retry messages, conversation state, and idempotency records are cleaned up automatically.

Before launch, replace the bracketed operator, Information Officer, contact, and retention details in the privacy notice and have the notice reviewed for your business and POPIA obligations.

Firestore client access is denied by `firestore.rules`; this app accesses Firestore through its server-side Firebase Admin SDK. Deploy rules and indexes after configuring Firebase CLI for your project:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

## Baileys WhatsApp gateway

The WhatsApp connection runs as a separate, always-on Node.js service; do not run the socket inside a Vercel function. The app and gateway communicate in both directions: the gateway relays inbound messages to the app and polls Firestore for outbound messages. The app also fetches inbound media from the gateway while it is cached.

### Local connection

1. Start the Next.js app with `npm run dev`.
2. Use Node.js 20.6 or later. In another terminal, from `whatsapp-gateway`, copy `.env.example` to `.env` and fill in the gateway Firebase service-account settings. Set `VERCEL_APP_URL=http://localhost:3000`.
3. Generate a random shared secret (for example, with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`). Put the same value in the app's `.env.local` and the gateway's `.env` as `BAILEYS_GATEWAY_SHARED_SECRET`. Set the app's `BAILEYS_GATEWAY_URL=http://localhost:8787`.
4. Run `npm ci` and `npm start` in `whatsapp-gateway`. Scan the QR printed in the gateway terminal using WhatsApp > Linked devices.
5. Check `http://localhost:8787/health`; it should report `"connected":true`. Send a WhatsApp message to the linked number and confirm the bot replies.

### Production connection

Deploy `whatsapp-gateway/Dockerfile` to an always-on host that supports persistent volumes. Mount a durable, private volume at `/data` and set `BAILEYS_AUTH_DIR=/data/auth`. Configure these gateway variables from `whatsapp-gateway/.env.example`: `VERCEL_APP_URL` (the deployed app origin, no trailing path), `BAILEYS_GATEWAY_SHARED_SECRET` (the same random secret used by the app), `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `BAILEYS_AUTH_DIR=/data/auth`, `PORT` if required by the host, and `LOG_LEVEL`. Set the app's `BAILEYS_GATEWAY_URL` to the gateway's HTTPS origin.

The app also needs its Firebase Admin credentials in Vercel. Configure `NEXT_PUBLIC_WHATSAPP_NUMBER` with the business number in international digits without `+`. The gateway reads `whatsapp_outbox`, relays inbound messages to `/api/whatsapp/inbound` using an HMAC signature, and serves cached media only to requests bearing the shared secret. The gateway's `/health` endpoint reports its connection state.

Keep the gateway auth volume private and backed up securely. Losing it requires pairing the WhatsApp device again. Pairing QR codes and the saved auth directory grant account access; never share them or include them in logs/screenshots. Baileys is an unofficial WhatsApp Web client and is not affiliated with WhatsApp; connections can break or accounts may be restricted. Use a dedicated business number, avoid bulk messaging, and review WhatsApp's current terms and policies before launch.

After starting the gateway, scan its pairing QR using WhatsApp > Linked devices. Pairing QR codes and the saved auth directory grant account access; never share them or include them in logs/screenshots. Baileys is an unofficial WhatsApp Web client and is not affiliated with WhatsApp; connections can break or accounts may be restricted. Use a dedicated business number, avoid bulk messaging, and review WhatsApp's current terms and policies before launch.

Configure a Cloudinary account for worker media. Deploy the Firestore composite indexes in `firestore.indexes.json` with:

```bash
firebase deploy --only firestore:indexes
```

## Vercel deployment

Import this project directory (`kasii-talent`) into Vercel and use the standard Next.js build command, `npm run build`. Add the app variables from `.env.example` to Vercel for each environment that needs them. Set `NEXT_PUBLIC_APP_URL` to the deployed origin, `NEXT_PUBLIC_WHATSAPP_NUMBER` to the business number in international digits, `BAILEYS_GATEWAY_URL` to the gateway's HTTPS origin, and `BAILEYS_GATEWAY_SHARED_SECRET` to the same random secret configured on the gateway.

After deployment, verify gateway pairing and health, worker QR/link sign-in, employer signup/login, an inbound WhatsApp message, outbound service-request notification, worker acceptance, and the employer's consent-gated contact display. Ensure the gateway host retains its volume across restarts and the Vercel function duration supports bot actions such as media uploads.
