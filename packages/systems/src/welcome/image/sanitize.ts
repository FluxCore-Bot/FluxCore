/**
 * Sanitize a Discord-supplied display name, username, or guild name before
 * rendering it onto the welcome canvas. Removes control characters,
 * zero-width chars, bidi overrides/isolates, normalizes to NFC, collapses
 * whitespace, and hard-truncates to maxLen UTF-16 code units.
 */

// Bidi override + isolate ranges
const BIDI_OVERRIDES = /[\u202A-\u202E\u2066-\u2069]/g;
// Zero-width chars
const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/g;
// C0 + C1 control characters EXCEPT \t \n \r (we still collapse them later)
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
// Whitespace runs (after we've stripped controls)
const WHITESPACE_RUN = /\s+/g;

export function sanitizeDisplayName(raw: string, maxLen: number): string {
  if (typeof raw !== "string") return "Unknown";

  let out = raw
    .normalize("NFC")
    .replace(BIDI_OVERRIDES, "")
    .replace(ZERO_WIDTH, "")
    .replace(CONTROL_CHARS, "")
    .replace(WHITESPACE_RUN, " ")
    .trim();

  if (out.length === 0) return "Unknown";
  if (out.length > maxLen) out = out.slice(0, maxLen);
  return out;
}
