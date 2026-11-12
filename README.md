# KasiTalent (WorkBridge SA)

WhatsApp-first talent platform for South Africa's informal workers, with a hyper-local employer dashboard.

Stack: Next.js 15 (App Router, TypeScript, MUI 6) · Firebase Admin (Firestore + Auth) · Cloudinary · WhatsApp Cloud API · Vercel

## Quick start

```bash
npm install
cp .env.example .env.local     # then fill in the values (see below)
npm run dev                    # http://localhost:3000
```

Type-check: `npm run typecheck`

`.env.local` starts with a dot, so file managers hide it. Use `ls -a` to see it. Next.js only reads it on startup, so restart `npm run dev` after every change.

## Connect Firebase

1. console.firebase.google.com > **Add project**.
2. **Build > Firestore Database > Create database.** Choose the Johannesburg region (`africa-south1`) if offered. It cannot be changed later.
3. **Build > Authentication > Get started > Sign-in method.** Enable **Email/Password** and **Google** (employer signup and login) and **Phone** (worker dashboard sign-in). `localhost` is authorised by default; when you deploy, add your domain under **Authentication > Settings > Authorized domains**.
4. Gear icon > **Project settings > Service accounts > Generate new private key.** Copy three values from the downloaded JSON into `.env.local`:
   - `project_id` -> `FIREBASE_PROJECT_ID`
   - `client_email` -> `FIREBASE_CLIENT_EMAIL`
   - `private_key` -> `FIREBASE_PRIVATE_KEY` (keep the quotes and the `\n` characters)
5. Deploy the security rules, indexes and TTL policies:
   ```bash
   npx firebase-tools login
   npx firebase-tools use --add
   npx firebase-tools deploy --only firestore
   ```
6. Never commit the JSON key or `.env.local`.

## Employer signup and login (Firebase web config)

The login and signup pages talk to Firebase Auth from the browser, so they need the web app config (separate from the Admin key above):

1. Project settings > General > **Your apps** > add a **Web app** (`</>`).
2. Copy `apiKey`, `authDomain`, `projectId` and `appId` into `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID` and `NEXT_PUBLIC_FIREBASE_APP_ID`. Restart `npm run dev`.
3. Add your development and production hostnames under **Authentication > Settings > Authorized domains**.
4. In Firebase Console, open **Authentication > Templates > Email address verification** and set the **Customize action URL** to `https://<your-site>/verify-email` (use the matching development origin while testing locally). This makes Firebase send verification links to KasiTalent's verification page, which validates the action code before showing success.
5. Customize the built-in template's sender name, subject and message. Suggested sender: `KasiTalent`; subject: `Verify your KasiTalent email`; message: `Welcome to KasiTalent. Verify your email to finish setting up your business account. If you didn't create this account, you can ignore this email.` Keep Firebase's generated verification link/button in the message. The built-in template supports basic copy and sender customization; Firebase controls the email layout.
6. Try it: open `/signup`, create an account, and click the verification link. The `/verify-email` page confirms the email and offers a button to `/login`.

How it works: the browser signs in with Firebase, then `/api/session` verifies the token and sets an httpOnly cookie. The first time an employer account signs in, the server gives it the `employer` role. Email accounts must verify their email first; Google accounts are already verified. Workers create profiles through WhatsApp and use phone OTP at `/worker/login` to access their dashboard.

## Other keys

- `PHONE_HASH_PEPPER`: run `openssl rand -hex 32`. Back it up. Do not change it once real users exist.
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`: Cloudinary dashboard > API keys.

## Connect WhatsApp

1. developers.facebook.com > **Create app** > type **Business** > add the **WhatsApp** product.
2. **WhatsApp > API Setup:**
   - Copy **Phone number ID** -> `WHATSAPP_PHONE_NUMBER_ID`.
   - Copy the temporary token -> `WHATSAPP_TOKEN`. It expires after 24 hours; for anything lasting, create a System User token in Meta Business Settings.
   - Add your own cellphone as a test recipient (the test number can only message people you add).
3. **App settings > Basic:** copy **App secret** -> `WHATSAPP_APP_SECRET`.
4. Invent a long random string for `WHATSAPP_VERIFY_TOKEN`.
5. Meta cannot reach `localhost`, so expose your dev server:
   ```bash
   npx cloudflared tunnel --url http://localhost:3000     # or: ngrok http 3000
   ```
6. **WhatsApp > Configuration > Webhook:** callback URL `https://<tunnel-url>/api/whatsapp/webhook`, verify token = `WHATSAPP_VERIFY_TOKEN`. Click **Verify and save**, then subscribe to the **messages** field.
7. Sanity check (should print `123`):
   `http://localhost:3000/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=123`
8. Message the test number from your phone. You should get the consent prompt. Only South African (+27) mobile numbers are accepted; others are ignored.

More detail (message template, commands): `docs/WhatsApp-Setup-Guide.md`.

## Deploy

Push to Vercel and add every variable from `.env.example` in Project Settings. Vercel Hobby is for non-commercial use only. Then replace the tunnel URL in Meta's webhook settings with your production URL and set `NEXT_PUBLIC_APP_URL`.

## Layout

```
src/
  theme.ts                           MUI theme
  app/
    layout.tsx                       MUI providers
    page.tsx                         landing page
    privacy/page.tsx                 POPIA notice template ([BRACKETED] items to fill)
    login/page.tsx, signup/page.tsx  employer login and signup (email + Google)
    (employer)/dashboard/page.tsx    employer candidate dashboard (server component)
    (worker)/worker/                 worker phone sign-in and profile dashboard
    actions/worker.ts                server actions: register, upload signature, save media
    api/whatsapp/webhook/route.ts    Meta webhook (verify + receive)
    api/session/route.ts             ID token -> session cookie
  components/auth/                   AuthForm (login/signup), SignOutButton
  components/employer/CandidateGrid.tsx
  components/worker/                 worker sign-in and portfolio manager
  lib/                               firebase admin, phone utils, schemas, whatsapp client, bot copy, auth
  services/                          workers, media, contact, erasure, whatsapp-bot (state machine)
  types/index.ts
docs/                                blueprint (original design) + WhatsApp setup guide
firestore.rules                      deny-all (all access is server-side)
firestore.indexes.json               composite indexes + TTL policies
```

## Known gaps

- **Employer profile:** the business name comes from signup (or the Google name). There is no screen to edit business details or township yet.
- **Media approval:** uploads are saved as `pending` and employers only see `approved`. Add an admin screen or Cloudinary moderation.
- Job postings UI and skill tests (`app_tested`). Workers can manage portfolio uploads on the web; profile and visibility changes remain available through WhatsApp.
- Run `npm run typecheck` after making changes to check the TypeScript code.

## Security notes

- All Firestore access is through the Admin SDK on the server; client rules deny everything.
- Phone numbers live only in `user_private` and are never sent to the browser.
- Rotate `WHATSAPP_APP_SECRET` and service-account keys if they leak.
