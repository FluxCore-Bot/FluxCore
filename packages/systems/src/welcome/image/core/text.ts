import { getLatinFont, ARABIC_FONTS, EMOJI_FONT } from "../fonts/manifest.js";

/** The single-character ellipsis. Three periods bidi-reorder badly in RTL text. */
const ELLIPSIS = "…";

/**
 * Hebrew, Arabic, Syriac, Thaana, NKo, Samaritan, Mandaic, Arabic Extended-A,
 * plus the Arabic/Hebrew presentation form blocks.
 */
const RTL_STRONG = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

/** Latin, Latin Extended, IPA, Greek, Cyrillic, Armenian. */
const LTR_STRONG = /[A-Za-z\u00C0-\u02FF\u0370-\u058F\u1E00-\u1FFF]/;

/** Anything with a `measureText` — both canvas contexts and test doubles. */
export interface TextMeasurer {
  measureText(text: string): { width: number };
}

/**
 * Build the canvas font shorthand for a stored font id.
 *
 * The Arabic companion and emoji font are appended as fallbacks so mixed-script
 * text resolves per-codepoint. Weight is explicit so Skia and the browser pick
 * the same face.
 */
export function buildFontSpec(fontName: string, sizePx: number): string {
  const latin = getLatinFont(fontName);
  const arabic = ARABIC_FONTS[latin.arabic];
  return `${latin.weight} ${sizePx}px "${latin.family}", "${arabic.family}", "${EMOJI_FONT.family}"`;
}

/**
 * Resolve a paragraph's base direction from its first strong character
 * (Unicode Bidi Algorithm rules P2/P3). Neutrals — digits, spaces,
 * punctuation — are skipped.
 */
export function baseDirection(text: string): "ltr" | "rtl" {
  for (const ch of text) {
    if (RTL_STRONG.test(ch)) return "rtl";
    if (LTR_STRONG.test(ch)) return "ltr";
  }
  return "ltr";
}

let graphemeSegmenter: Intl.Segmenter | undefined;

function graphemes(text: string): string[] {
  graphemeSegmenter ??= new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return Array.from(graphemeSegmenter.segment(text), (s) => s.segment);
}

/**
 * Truncate to `maxWidth`, cutting only on grapheme boundaries so surrogate
 * pairs, ZWJ emoji sequences, and Arabic combining marks stay intact.
 *
 * Callers must set `ctx.direction` before calling: measurement has to happen
 * under the same direction as the eventual draw.
 */
export function fitText(ctx: TextMeasurer, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;

  const parts = graphemes(text);
  let lo = 0;
  let hi = parts.length;

  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ctx.measureText(parts.slice(0, mid).join("") + ELLIPSIS).width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }

  return parts.slice(0, lo).join("") + ELLIPSIS;
}

/** Convert `#rgb` or `#rrggbb` to an rgba() string. Unparseable input yields transparent black. */
export function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.trim().replace(/^#/, "");
  const full = raw.length === 3 ? raw.replace(/./g, (c) => c + c) : raw;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) return `rgba(0, 0, 0, ${alpha})`;

  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface VariableMember {
  username: string;
  displayName: string;
}

export interface VariableGuild {
  name: string;
  memberCount: number;
}

/** Substitute `{user}`-style placeholders in image subtitle text. */
export function replaceImageVariables(
  text: string,
  member: VariableMember,
  guild: VariableGuild,
): string {
  return text
    .replaceAll("{user.displayname}", member.displayName)
    .replaceAll("{user.name}", member.username)
    .replaceAll("{user}", member.username)
    .replaceAll("{server}", guild.name)
    .replaceAll("{membercount}", guild.memberCount.toLocaleString());
}
