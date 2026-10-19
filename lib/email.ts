// Single source of truth for turning untrusted input into a canonical email
// address. Used by every auth path (OTP send/verify, NextAuth credentials +
// Google, profile uniqueness) so the same address can't resolve to two
// different accounts just because of capitalization or stray whitespace
// (see AUTH-007), and so a non-string (e.g. a `{ "$ne": ... }` Mongo
// operator) can never reach a query (see AUTH-001).
//
// Note: emails are lowercased wholesale. The local part is technically
// case-sensitive per RFC 5321, but in practice no real provider treats it
// that way, and the previous verbatim storage caused duplicate accounts.
// Existing mixed-case rows should be migrated with
// scripts/migrate-email-lowercase.ts.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalized)) return null;
  return normalized;
}
