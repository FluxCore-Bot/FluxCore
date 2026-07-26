export const SCORE_EXACT = 100;
export const SCORE_TITLE_PREFIX = 80;
export const SCORE_WORD_PREFIX = 60;
export const SCORE_TITLE_SUBSTRING = 40;
export const SCORE_KEYWORD = 20;

export interface Scorable {
  title: string;
  keywords?: string;
}

export interface Segment {
  text: string;
  match: boolean;
}

/**
 * Casefold and strip diacritics so "moderation" finds "Modération". NFD splits
 * a letter into base + combining mark; removing the marks leaves the base. NFC
 * recomposes so precomposed scripts like Korean and Arabic round-trip unchanged
 * when they have no diacritics. Diacritics (like Latin accents or Arabic matras)
 * are stripped, and if stripping changed the length, segment() skips highlighting.
 */
export function normalize(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").normalize("NFC").toLowerCase();
}

export function score(query: string, c: Scorable): number | null {
  const q = normalize(query.trim());
  if (!q) return 0;

  const title = normalize(c.title);
  if (title === q) return SCORE_EXACT;
  if (title.startsWith(q)) return SCORE_TITLE_PREFIX;

  // Split on anything that is not a letter or number, so "Role Panels" yields
  // ["role", "panels"] and a query of "pan" is a word prefix rather than a
  // mid-string substring. Avoids \b, which misbehaves on non-Latin scripts.
  const words = title.split(/[^\p{L}\p{N}]+/u);
  if (words.some((w) => w.length > 0 && w.startsWith(q))) return SCORE_WORD_PREFIX;

  if (title.includes(q)) return SCORE_TITLE_SUBSTRING;
  if (c.keywords && normalize(c.keywords).includes(q)) return SCORE_KEYWORD;

  return null;
}

/**
 * Split `title` into matched/unmatched runs for <mark> highlighting. Indices
 * come from the normalized form but slice the ORIGINAL string, so the caller
 * renders the user's real casing and accents back to them.
 *
 * Safe because normalize() removes combining marks, which never begin a
 * grapheme — so index alignment with the source string is preserved for the
 * scripts we highlight. Where alignment cannot hold, the match simply fails
 * and the whole title renders unmatched.
 */
export function segment(title: string, query: string): Segment[] {
  const q = normalize(query.trim());
  if (!q) return [{ text: title, match: false }];

  const start = normalize(title).indexOf(q);
  if (start === -1 || normalize(title).length !== title.length) {
    return [{ text: title, match: false }];
  }

  const end = start + q.length;
  const out: Segment[] = [];
  if (start > 0) out.push({ text: title.slice(0, start), match: false });
  out.push({ text: title.slice(start, end), match: true });
  if (end < title.length) out.push({ text: title.slice(end), match: false });
  return out;
}
