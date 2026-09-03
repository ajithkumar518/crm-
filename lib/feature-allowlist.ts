/**
 * Single source of truth for per-user feature restrictions.
 * Both frontend and backend import from this file — they cannot drift.
 */

export const QUOTATION_FOLLOWUP_ALLOWED_EMAILS = [
  "shahnaz@sukisoftware.com",
] as const;

export function isQuotationFollowupAllowed(email: string | undefined | null): boolean {
  if (!email) return false;
  return (QUOTATION_FOLLOWUP_ALLOWED_EMAILS as readonly string[]).includes(email.toLowerCase());
}
