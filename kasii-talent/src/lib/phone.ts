// Path: src/lib/phone.ts
import "server-only";
import { createHmac } from "node:crypto";

/**
 * Normalise a South African mobile number to E.164 (+27XXXXXXXXX).
 * Accepts: 0821234567, 082 123 4567, 27821234567, +27 82 123 4567.
 * Returns null if it is not a valid SA mobile number.
 */
export function normalizeSaPhone(input: string): string | null {
  const digits = input.replace(/[^\d]/g, "");
  let national: string;

  if (digits.startsWith("27") && digits.length === 11) national = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 10) national = digits.slice(1);
  else if (digits.length === 9) national = digits;
  else return null;

  // SA mobile ranges start with 6, 7 or 8
  return /^[678]\d{8}$/.test(national) ? `+27${national}` : null;
}

/** Deterministic, non-reversible identifier for lookups and de-duplication. */
export function hashPhone(e164: string): string {
  const pepper = process.env.PHONE_HASH_PEPPER;
  if (!pepper) throw new Error("Missing environment variable: PHONE_HASH_PEPPER");
  return createHmac("sha256", pepper).update(e164).digest("hex");
}

/** For logs and support screens only: +27 82 *** **67 */
export function maskPhone(e164: string): string {
  return `${e164.slice(0, 6)} *** **${e164.slice(-2)}`;
}
