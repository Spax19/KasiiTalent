# KasiTalent (WorkBridge SA) — Project Blueprint

Stack: Next.js (App Router, TS, MUI) · Firebase (Firestore + Auth, Admin SDK) · Cloudinary · Vercel · WhatsApp Cloud API

> Code files in this bundle carry a `// Path:` header showing where they live in the repo.

---

## 1. System Architecture & User Flow

### 1.1 Architecture

```
 Worker (WhatsApp)                                Employer (Browser)
        │                                                │
        ▼                                                ▼
 WhatsApp Cloud API ──webhook──► Next.js on Vercel ◄── Server Components / Actions
                                  │   (App Router)
        ┌─────────────────────────┼──────────────────────────┐
        ▼                         ▼                          ▼
  Firebase Admin SDK        Cloudinary (signed)        Firebase Auth
  (Firestore, server only)  upload + transformation    (employer login,
                                                        worker identity by phone)
```

Key decisions:

- **All Firestore access is server-side via the Admin SDK.** Security rules deny every client read/write (see `firestore.rules`). The browser never talks to Firestore directly, so there is no way to scrape phone numbers or bypass consent flags from the client. This also keeps reads cheap and cacheable.
- **Next.js Server Components** render the employer grid (query Firestore on the server, serialise to plain DTOs, pass to the client `CandidateGrid`). **Server Actions** handle mutations (register worker, save media, post job, request contact).
- **WhatsApp webhook** (`app/api/whatsapp/webhook/route.ts`) is the worker's primary entry point. It verifies Meta's `X-Hub-Signature-256`, resolves/creates the worker via the same `createWorkerProfile()` service used by the web form, and advances a small conversation state machine stored in `wa_sessions/{phoneHash}`.
- **Media path:** WhatsApp sends a media ID → server fetches the binary with the WhatsApp token → uploads to Cloudinary with an *incoming transformation* (`q_auto, f_auto, w_1280` for images; `w_720, du_30, q_auto` for video) so every asset is stored already compressed. Web users upload straight to Cloudinary with a **server-signed** request (`getUploadSignature`) and then call `savePortfolioMedia` to record metadata. The server validates that the returned URL and `public_id` belong to our cloud and to that worker's folder.
- **Worker identity:** workers are Firebase Auth users keyed by phone number, created with `auth.createUser({ phoneNumber })` from the server (no SMS cost). Their "login" is a one-time magic link sent over WhatsApp. Employers use email/Google sign-in (avoids SMS OTP costs).
- **Distance filtering:** each worker/job stores `lat/lng` (township centroid is fine) and a `geohash`. Radius queries use `geofire-common` bounds, then a distance post-filter.

### 1.2 Low-data worker journey (WhatsApp-first)

1. **Entry.** Worker messages the KasiTalent number ("Hi") or taps a QR/link from a spaza, salon or taxi-rank poster.
2. **Consent first.** Bot sends a short plain-language message (English/isiZulu/Sesotho/etc.): what we collect, who sees it, that they can send `STOP` anytime. Worker replies `1` to accept → consent record written (`profile_sharing`, `terms`, `age_18_plus`). Nothing else is stored before this.
3. **Conversational profile (text or voice note).** "What work do you do?" → "Name?" → "Which area? (e.g. Soshanguve)" → "How long have you done it?". Voice notes are stored as-is for later transcription (optional, future) and the worker can answer in text. Skills are extracted by keyword mapping into tags (`hair_fading`, `welding`, `plumbing`, `retail_assistant` …). Each answer is one tiny message, so a session costs a few KB.
4. **Proof of work.** Bot asks for 1–3 photos or a 15–30s video. Each upload is compressed on the server (see above). Worker adds a short caption via text reply or leaves it blank.
5. **Community vouching.** Bot gives the worker a vouch link/code: *"Ask a client or boss to reply `VOUCH 4821` to this number."* The voucher (a customer, shop owner, church member) is asked: name, relationship, "Rate 1–5", one-line comment. Their phone is verified simply by the WhatsApp message coming from it. After **2 distinct vouchers**, the skill moves `pending → community_vouched` and the profile gets a badge.
6. **App-tested (optional upgrade).** A short 5-question multiple-choice skill check sent over WhatsApp (e.g. basic safety/pricing for plumbing). Passing sets `app_tested`.
7. **Receiving work.** When an employer taps "Request contact", the worker gets a WhatsApp message: *"Thuto's Hardware (Tembisa) wants to hire for a welding gig. Reply 1 to share your number, 2 to decline."* Only a `1` reveals the number.
8. **Updating over time.** Worker can text `NEW PHOTO`, `ADD SKILL`, `PAUSE` (hide profile) or `DELETE` (erase account) at any time.

### 1.3 Employer journey

Sign in → set business + township → browse **Candidate Grid** filtered by skill / township / radius / verified-only → open media previews → **Request contact** (consent-gated) → or post a **job** that is matched to workers within its radius and pushed to them via WhatsApp (template message, opt-in only).

### 1.4 Free-tier notes (verify current limits before launch)

- **Firestore (Spark):** daily read/write quotas — design for few, denormalised reads (rating counters on `users`, no per-card fan-out).
- **Cloudinary free plan:** credit-based storage/bandwidth — the incoming transformations above are what keep you inside it.
- **WhatsApp Cloud API:** worker-initiated conversations get a 24-hour service window for replies; business-initiated template messages (job alerts) are charged by Meta. Check Meta's current pricing.
- **Vercel Hobby:** limited to non-commercial use. Once KasiTalent earns revenue, move to Vercel Pro or another host.

---

## 2. Firestore Schema

Conventions: document IDs for users = Firebase Auth `uid`. Timestamps are Firestore `Timestamp`. Counters are denormalised and updated in transactions. **Private data lives in separate collections** from anything rendered to employers.

### 2.1 `users/{uid}` — public-ish profile (no phone number)

| Field | Type | Notes |
|---|---|---|
| `role` | `"worker" \| "employer"` | |
| `displayName` | string | First name + initial is enough |
| `township` | string | e.g. `"Soshanguve"`, `"Tembisa"` |
| `townshipSlug` | string | normalised for queries |
| `city`, `province` | string | |
| `location` | `{ lat, lng, geohash }` | approximate (township centroid) |
| `bio` | string (≤280) | |
| `languages` | string[] | |
| `ratingAvg`, `ratingCount` | number | denormalised from endorsements |
| `endorsementCount`, `verifiedSkillCount`, `mediaCount` | number | |
| `visibility` | `"private" \| "visible" \| "paused"` | **defaults to `private`** until `profile_sharing` consent |
| `onboardingChannel` | `"whatsapp" \| "web"` | |
| `preferredLanguage` | string | |
| `createdAt`, `updatedAt`, `lastActiveAt` | Timestamp | |
| *(employer only)* `businessName`, `businessType` | string | |

### 2.2 `user_private/{uid}` — never sent to browsers

`phoneE164`, `phoneHash` (HMAC-SHA256 with server pepper, used for lookups/dedupe), `email?`, `waProfileName?`.

### 2.3 `consents/{autoId}`

`uid`, `type` (`terms | profile_sharing | contact_sharing | marketing | age_18_plus`), `granted` (bool), `policyVersion`, `channel`, `sourceMessageId?`, `createdAt`. Append-only; latest record per `uid+type` wins. This is your POPIA audit trail.

### 2.4 `skills/{uid}_{skillSlug}`

| Field | Type |
|---|---|
| `uid`, `skillSlug` (`hair_fading`), `label` ("Hair fading") | string |
| `category` | `"beauty" \| "construction" \| "retail" \| "trades" \| "services" \| ...` |
| `yearsExperience` | number |
| `verificationStatus` | `"pending" \| "community_vouched" \| "app_tested"` |
| `vouchCount` | number |
| `testScore?`, `testedAt?` | number / Timestamp |
| `createdAt`, `updatedAt` | Timestamp |

(Top-level rather than subcollection so employers can query across all workers: "all `welding` skills with status ≥ vouched in Tembisa" — `township` is copied onto the skill doc as `townshipSlug` for that composite query.)

### 2.5 `endorsements/{autoId}`

`workerUid`, `skillSlug?`, `voucherName`, `voucherRelationship` (`customer | employer | neighbour | peer`), `voucherPhoneHash` (dedupe; one vouch per voucher per skill), `rating` (1–5), `comment` (≤280), `status` (`pending | approved | rejected`), `createdAt`. Approved endorsements increment `users.ratingAvg/ratingCount` and `skills.vouchCount` inside a transaction. Voucher full phone is **not** stored.

### 2.6 `portfolio_media/{autoId}`

`uid`, `type` (`image | video`), `secureUrl`, `publicId`, `thumbnailUrl`, `width`, `height`, `bytes`, `durationSec?`, `caption`, `skillSlug`, `moderationStatus` (`approved | pending | rejected`), `createdAt`.

### 2.7 `job_postings/{autoId}`

`employerUid`, `title`, `description`, `skillSlugs[]`, `paymentType` (`fixed | hourly | daily`), `payAmountZar`, `township`, `townshipSlug`, `location {lat,lng,geohash}`, `radiusKm`, `status` (`open | filled | closed | expired`), `startDate`, `expiresAt`, `applicantCount`, `createdAt`.

### 2.8 Supporting collections

- `contact_requests/{id}`: `employerUid`, `workerUid`, `jobId?`, `status` (`sent | accepted | declined | expired`), `createdAt`, `respondedAt`.
- `wa_sessions/{phoneHash}`: conversation `step`, partial answers, TTL 7 days (enable Firestore TTL on `expiresAt`).
- `deletion_requests/{id}`: `uid`, `requestedAt`, `completedAt`.

### 2.9 Composite indexes (create when Firestore prompts or in `firestore.indexes.json`)

- `users`: `role ASC, visibility ASC, townshipSlug ASC, ratingAvg DESC`
- `skills`: `skillSlug ASC, townshipSlug ASC, verificationStatus ASC`
- `skills`: `uid ASC, createdAt DESC`
- `portfolio_media`: `uid ASC, createdAt DESC`
- `endorsements`: `workerUid ASC, status ASC, createdAt DESC`
- `job_postings`: `status ASC, townshipSlug ASC, createdAt DESC`

---

## 3. Code index

| File | Path in repo |
|---|---|
| `types.ts` | `src/types/index.ts` |
| `firebase-admin.ts` | `src/lib/firebase/admin.ts` |
| `phone.ts` | `src/lib/phone.ts` |
| `schemas.ts` | `src/lib/schemas.ts` |
| `session-auth.ts` | `src/lib/auth.ts` |
| `worker-service.ts` | `src/services/workers.ts` |
| `worker-actions.ts` | `src/app/actions/worker.ts` |
| `erasure-service.ts` | `src/services/erasure.ts` |
| `CandidateGrid.tsx` | `src/components/employer/CandidateGrid.tsx` |
| `firestore.rules` | project root |

Install: `npm i firebase-admin zod cloudinary geofire-common server-only`

Environment (`.env.local`, never committed):

```
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
PHONE_HASH_PEPPER=<long random string>
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
WHATSAPP_TOKEN=
WHATSAPP_APP_SECRET=
```

---

## 4. POPIA Compliance & Trust Safeguards

**Rule 1 — Minimise and isolate personal information (phone numbers).**
Phone numbers live only in `user_private` (rules deny all client access). Lookups and de-duplication use an HMAC-SHA256 hash with a server-side pepper (`phone.ts`). Employers never receive a number from the grid — the DTO has no phone field. Contact is revealed only after the worker replies `1` to a contact request, and the reveal is logged in `contact_requests`. Never log raw numbers or webhook bodies.

**Rule 2 — Explicit, specific, recorded consent before processing or sharing.**
`createWorkerProfile()` refuses to run without `terms`, `age_18_plus` and `profile_sharing` consents, each written to the append-only `consents` collection with policy version, channel and WhatsApp message ID. Profiles start `visibility: "private"` and become `visible` only after sharing consent. Workers can withdraw at any time (`STOP`/`PAUSE`), which flips visibility immediately. Only adults (18+) are onboarded because POPIA imposes stricter conditions on processing children's information.

**Rule 3 — Honour access and deletion rights (data-subject rights).**
`deleteWorkerAccount()` (`erasure-service.ts`) removes the Auth user, Firestore profile, private data, skills, media records, and the Cloudinary assets (images and videos) in one auditable operation, anonymises endorsements the worker *received* only if they must be retained for fraud/audit, and writes a `deletion_requests` record. Trigger it from the WhatsApp `DELETE` keyword and a web settings page. Add a matching "send me my data" export for access requests.

Operational must-dos beyond code: register an **Information Officer** with the Information Regulator; publish a plain-language privacy notice; sign operator agreements with Meta, Google (Firebase), Cloudinary and Vercel and document cross-border transfers (POPIA s72); keep breach-notification procedures ready (notify the Regulator and affected people as soon as reasonably possible); and have a lawyer review the consent wording. This blueprint is engineering guidance, not legal advice.
