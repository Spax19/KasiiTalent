# KasiTalent

WhatsApp-first worker profiles with employer discovery and consent-based service requests.

## Local setup

Run these commands from this directory, beside `package.json`:

```bash
npm install
cp .env.example .env.local
npm run dev
```

On Windows PowerShell, use `Copy-Item .env.example .env.local` instead of `cp`. Fill in `.env.local` with the Firebase, WhatsApp, and Cloudinary values for your development projects. Never commit `.env.local` or expose server secrets through `NEXT_PUBLIC_` variables.

## Product flows

- Workers start on WhatsApp, create a profile, and add work samples by sending photos or videos.
- Workers sign in by opening a short-lived WhatsApp link or scanning its QR code, then approving the sign-in from the WhatsApp number linked to their profile. Passwords and SMS codes are never requested.
- Employers create an account, browse visible worker profiles, filter by skills and rating, and request a service.
- Workers accept or decline requests in WhatsApp. Their number is shared with the requesting employer only after acceptance.
- Workers can request general or skill-specific community reviews by sending `CODE` or `CODE <skill>` to the WhatsApp bot, then sharing the resulting code with a reviewer.

## External services

Configure Firebase Authentication with Email/Password and Google providers. Phone/SMS sign-in is not used. Add local and production web domains to Firebase's authorized domains. Create the default Firestore database. The Firebase Admin service account must have the minimum required Auth and Firestore privileges, including creating custom tokens.

Set Firestore TTL policies on the `expiresAt` field for the `worker_login_challenges` and `worker_login_rate_limits` collection groups so expired one-time challenges and rate-limit records are removed automatically.

Configure a Meta WhatsApp Cloud API webhook at `/api/whatsapp/webhook`, use the same verify token in Meta and `WHATSAPP_VERIFY_TOKEN`, and subscribe the app to message events. Create and approve the `contact_request` message template before relying on notifications outside WhatsApp's 24-hour messaging window.

Configure a Cloudinary account for worker media. Deploy the Firestore composite indexes in `firestore.indexes.json` with:

```bash
firebase deploy --only firestore:indexes
```

## Vercel deployment

Import this project directory (`kasii-talent`) into Vercel and use the standard Next.js build command, `npm run build`. Add all variables from `.env.example` to Vercel for each environment that needs them. Set `NEXT_PUBLIC_APP_URL` to the deployed origin and `NEXT_PUBLIC_WHATSAPP_NUMBER` to the WhatsApp business number in international digits without `+`.

After deployment, verify the worker WhatsApp QR/link sign-in, employer signup/login, the webhook verification handshake, an inbound WhatsApp message, a service request, worker acceptance, and the employer's consent-gated contact display. Confirm your Vercel plan supports the webhook route's 60-second maximum duration.
