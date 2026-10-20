// Turns Firebase Auth error codes into plain-language messages.
const BAD_LOGIN = "That email and password do not match. Try again, or reset your password.";

const MESSAGES: Record<string, string> = {
  "auth/invalid-credential": BAD_LOGIN,
  "auth/wrong-password": BAD_LOGIN,
  "auth/user-not-found": BAD_LOGIN,
  "auth/invalid-email": "That email address does not look right.",
  "auth/email-already-in-use": "An account with this email already exists. Try logging in instead.",
  "auth/weak-password": "Choose a stronger password (at least 8 characters).",
  "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
  "auth/network-request-failed": "No connection. Check your internet and try again.",
  "auth/popup-closed-by-user": "The Google window was closed before finishing.",
  "auth/cancelled-popup-request": "The Google window was closed before finishing.",
  "auth/popup-blocked": "Your browser blocked the Google window. Allow pop-ups for this site and try again.",
  "auth/operation-not-allowed": "This sign-in method is not switched on yet. Enable it in Firebase > Authentication.",
  "auth/unauthorized-domain":
    "This website's address is not authorised in Firebase yet (Authentication > Settings > Authorized domains).",
  "auth/user-disabled": "This account has been disabled.",
  "auth/expired-action-code": "This verification link has expired. Request a new one from the signup page.",
  "auth/invalid-action-code": "This verification link is invalid or has already been used. Try logging in or request a new link.",
};

export function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code;
  if (typeof code === "string" && code.startsWith("auth/")) {
    return MESSAGES[code] ?? "Something went wrong. Please try again.";
  }
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong. Please try again.";
}
