# WhatsApp + Session Setup Guide

## 1. New environment variables

```
WHATSAPP_PHONE_NUMBER_ID=   # Meta app dashboard > WhatsApp > API setup
WHATSAPP_TOKEN=             # use a permanent System User token, not the 24h test token
WHATSAPP_APP_SECRET=        # Meta app > Settings > Basic > App secret
WHATSAPP_VERIFY_TOKEN=      # any long random string you invent; paste the same value in Meta
NEXT_PUBLIC_APP_URL=https://your-domain   # used for the privacy-notice link in the consent message
```

## 2. Connect the webhook

1. Deploy to Vercel (the route is `/api/whatsapp/webhook`).
2. In the Meta developer dashboard: WhatsApp > Configuration > Webhook. Callback URL `https://your-domain/api/whatsapp/webhook`, Verify token = `WHATSAPP_VERIFY_TOKEN`. Click Verify.
3. Subscribe to the **messages** field.
4. Message your WhatsApp number from a South African phone. You should get the consent prompt.

## 3. Message template (needed for job/contact alerts outside the 24h window)

Create and submit for approval in WhatsApp Manager:

- Name: `contact_request`, language `en`, category Utility
- Body: `{{1}} wants to contact you about work. Reply 1 to share your number with them, or 2 to decline.`

Until it is approved, `notifyContactRequest()` falls back to plain text, which only reaches workers who messaged you in the last 24 hours.

## 4. Firestore TTL policies (keeps data minimal, supports POPIA)

Enable TTL on field `expiresAt` for collections `wa_sessions` and `wa_processed` (Firestore > TTL).

## 5. Employer sign-in

Handled by the `/signup` and `/login` pages (see the README section "Employer signup and login"). Nothing to wire up here beyond the `NEXT_PUBLIC_FIREBASE_*` values.

## 6. Bot commands

| Sender | Message | Result |
|---|---|---|
| New person | anything | Consent prompt, then name, area, skills, years, profile created |
| Worker | photo / video | Compressed upload, saved as `pending` moderation |
| Worker | `NEW PHOTO`, `CODE`, `PAUSE`, `RESUME`, `STOP`, `DELETE`, `HELP` | As in `bot-messages.ts` |
| Voucher | `VOUCH ABC123` | Name, relationship, 1–5 rating, comment; two vouches mark skills `community_vouched` |
| Worker | `1` / `2` | Accept or decline the latest contact request |

## 7. Known gaps / next steps

- **Moderation:** media is saved as `pending`; employers only see `approved`. Add an admin screen or Cloudinary's moderation add-on.
- **Voucher abuse:** one vouch per phone per worker is enforced, but add a daily cap per voucher and flag clusters of mutual vouching.
- **Voucher data on erasure:** when a worker deletes their account, endorsements they *gave* to others remain (and affect others' ratings). Decide a policy: anonymise the voucher name, or delete and recompute counters.
- **Voice notes:** the bot asks for typed answers. Adding speech-to-text is the next accessibility win.
- **Languages:** only English copy exists. Add isiZulu, Sesotho, Setswana, etc. with native-speaker review.
- **Skill tagging for WhatsApp photos:** they attach to the worker's first skill; add a "Which skill is this for?" prompt if workers list several.
- **Rate limiting:** add a per-number message limit on the webhook to blunt spam.
