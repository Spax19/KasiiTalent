/**
 * Only allow same-site relative paths as a post-login destination (prevents open redirects).
 * Rejects "//host", backslashes and control characters (browsers strip tabs/newlines, so "/\t/evil.com" becomes "//evil.com").
 */
export function safeNext(next: string | undefined, fallback = "/employer"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  if (/[\u0000-\u001f\\]/.test(next)) return fallback;
  return next;
}
