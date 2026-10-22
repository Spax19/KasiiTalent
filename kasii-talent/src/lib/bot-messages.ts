// Path: src/lib/bot-messages.ts
// All user-facing bot copy lives here so it can be translated without touching logic.
// Add isiZulu / Sesotho / Setswana / Xitsonga objects with the same keys and have
// them written or reviewed by native speakers; do not machine-translate consent text.

export const POLICY_VERSION = "2026-10-v1";

const privacyUrl = () => `${process.env.NEXT_PUBLIC_APP_URL ?? "https://kasitalent.example"}/privacy`;

export const en = {
  consent: () =>
    `Hi, welcome to KasiTalent 👋 We help you show your skills to local businesses.\n\n` +
    `To build your profile we save your name, area, skills, photos/videos of your work and your cellphone number. ` +
    `Employers only see your name, area, skills and work photos. They never get your number unless you say yes.\n\n` +
    `Reply STOP to pause or DELETE to erase everything, any time. Privacy notice: ${privacyUrl()}\n\n` +
    `By continuing you confirm you are 18 or older.\n` +
    `Reply 1 = Yes, employers can see my profile\n` +
    `Reply 2 = Yes, but keep my profile private for now`,
  consentRetry: `Please reply 1 or 2.\n1 = employers can see my profile\n2 = keep my profile private for now`,
  askName: `Great! What is your name? (first name and surname initial is fine)`,
  askTownship: `Which area do you work in? (for example Soshanguve, Tembisa, Soweto)`,
  askSkills: `What work do you do? List up to 5 skills, separated by commas.\nExample: hair fading, braiding, barbering`,
  askYears: `How many years have you been doing this work? Reply with a number (0 if you are just starting).`,
  invalid: `Sorry, I did not understand that. Please try again.`,
  textOnly: `Thanks! I can only read typed replies for now. Please type your answer.`,
  welcome: (name: string, code: string) =>
    `Welcome, ${name}! ✅ Your profile is created.\n\n` +
    `Next, send 1–3 photos or a short video (up to 30 seconds) of your work. Add a caption if you like.\n\n` +
    `To get community vouches, ask a customer or boss to send this to our number:\nVOUCH ${code}\n\n` +
    `Reply DONE when you have finished sending photos. Reply HELP any time.`,
  askMedia: `Send a photo or short video of your work (up to 30 seconds). Reply DONE when finished.`,
  mediaSaved: `Got it ✅ Send another, or reply DONE.`,
  mediaFailed: `Sorry, that upload did not work. Please try again, or send a smaller video.`,
  mediaLimit: `You have reached the limit of photos/videos. Remove one on the website to add more.`,
  mediaDone: `All set 👍 Employers can now see your work once it has been checked. Reply HELP for options.`,
  help:
    `KasiTalent options:\n` +
    `NEW PHOTO – add work photos or video\n` +
    `CODE – get a general vouch code; CODE <skill> – get a code for one skill\n` +
    `PAUSE – hide your profile\n` +
    `RESUME – show your profile again\n` +
    `STOP – stop sharing your profile\n` +
    `DELETE – erase all your data`,
  paused: `Your profile is hidden. Reply RESUME whenever you want employers to see it again.`,
  stopped: `Done. Your profile is hidden and we will not share it. Reply DELETE if you want all your data erased.`,
  stoppedNoData: `No problem. We have not saved anything about you. Say hi any time if you change your mind.`,
  resumeAsk: `Reply 1 to confirm you are happy for employers to see your profile again.`,
  resumed: `Your profile is visible to employers again ✅`,
  confirmDelete: `This will permanently erase your profile, photos, videos and number. It cannot be undone.\nReply YES DELETE to confirm, or anything else to cancel.`,
  deleted: `Your data has been erased. Thank you for trying KasiTalent.`,
  deleteCancelled: `Okay, nothing was deleted.`,
  noProfile: `You do not have a profile yet. Say hi to start.`,
  yourCode: (code: string, skill?: string) =>
    `Your ${skill ? `${skill} ` : ""}vouch code is ${code}. Ask a customer, colleague or community member to send "VOUCH ${code}" to this number.`,
  skillNotFound: `I could not find that skill on your profile. Reply CODE to get a general vouch code, or send CODE followed by one of your listed skills.`,
  contactShared: `Thanks! We have let the employer know you are happy to be contacted.`,
  contactDeclined: `No problem, we have declined for you.`,
  contactRequest: (business: string, serviceTitle?: string, details?: string) =>
    `${business} is requesting ${serviceTitle || "your service"}${details ? `: ${details}` : ""}. ` +
    `Reply 1 to accept and share your number, or 2 to decline.`,
  loginApproved: `Your worker sign-in is approved. Return to your browser to finish signing in. If you did not request this, ignore this message.`,
  loginNotLinked: `This WhatsApp number is not linked to a worker profile. Start by saying hi to KasiTalent to create one.`,
  loginInvalid: `That sign-in link has expired or was already used. Start again from the worker sign-in page.`,
  /* vouching */
  vouchInvalid: `That code is not valid. Please check it and try again.`,
  vouchSelf: `You cannot vouch for yourself 🙂`,
  vouchAlready: `You have already vouched for this person. Thank you!`,
  vouchIntro: (worker: string, skill?: string) =>
    `You are reviewing ${worker}${skill ? ` for ${skill}` : ""}. Your name and comment will be shown on their profile. Reply STOP to cancel.\n\nWhat is your name?`,
  vouchRelationship:
    `How do you know them?\n1 = I am a customer\n2 = I am their boss/employer\n3 = I am a neighbour/community member\n4 = I am a colleague`,
  vouchRating: `How would you rate their work? Reply 1 (poor) to 5 (excellent).`,
  vouchComment: `Add one short sentence about their work, or reply SKIP.`,
  vouchThanks: `Thank you! Your vouch helps local people get work 🙏`,
  vouchNotify: (name: string) => `${name} just vouched for you on KasiTalent ⭐`,
  genericError: `Sorry, something went wrong on our side. Please try again in a moment.`,
};

export type Messages = typeof en;
