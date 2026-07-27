/**
 * URL prefix the dashboard serves the font files under, shared by the
 * Fastify static route and the browser's FontFace loader. The files are
 * cached immutable for a year at stable filenames, so replacing a TTF in
 * place would strand returning browsers on the old font — bump the version
 * segment instead whenever a font file changes.
 */
export const FONT_URL_PREFIX = "/fonts/welcome/v1/";

export type FontCategory = "sans-serif" | "serif" | "display" | "monospace" | "rounded";

export type ArabicFontKey = "NotoSansArabic" | "Tajawal" | "Amiri" | "NotoKufiArabic";

export interface ArabicFont {
  family: string;
  file: string;
  weight: number;
}

export interface LatinFont {
  /** Stable id persisted in guild config JSON. */
  name: string;
  /** Label shown in the dashboard font picker. */
  displayName: string;
  category: FontCategory;
  /** Canvas family string — identical on client and server. */
  family: string;
  file: string;
  weight: number;
  arabic: ArabicFontKey;
}

export const ARABIC_FONTS: Record<ArabicFontKey, ArabicFont> = {
  NotoSansArabic: { family: "NotoSansArabic", file: "NotoSansArabic-Bold.ttf", weight: 700 },
  Tajawal: { family: "Tajawal", file: "Tajawal-Bold.ttf", weight: 700 },
  Amiri: { family: "Amiri", file: "Amiri-Bold.ttf", weight: 700 },
  NotoKufiArabic: { family: "NotoKufiArabic", file: "NotoKufiArabic-Bold.ttf", weight: 700 },
};

export const EMOJI_FONT: ArabicFont = {
  family: "NotoColorEmoji",
  file: "Noto-COLRv1.ttf",
  weight: 400,
};

export const LATIN_FONTS: LatinFont[] = [
  { name: "Inter", displayName: "Inter", category: "sans-serif", family: "Inter", file: "Inter-SemiBold.ttf", weight: 600, arabic: "NotoSansArabic" },
  { name: "SpaceGrotesk", displayName: "Space Grotesk", category: "sans-serif", family: "SpaceGrotesk", file: "SpaceGrotesk-Bold.ttf", weight: 700, arabic: "NotoSansArabic" },
  { name: "JetBrainsMono", displayName: "JetBrains Mono", category: "monospace", family: "JetBrainsMono", file: "JetBrainsMono-Bold.ttf", weight: 700, arabic: "NotoSansArabic" },
  { name: "Poppins", displayName: "Poppins", category: "rounded", family: "Poppins", file: "Poppins-SemiBold.ttf", weight: 600, arabic: "Tajawal" },
  { name: "PlayfairDisplay", displayName: "Playfair Display", category: "serif", family: "PlayfairDisplay", file: "PlayfairDisplay-Bold.ttf", weight: 700, arabic: "Amiri" },
  { name: "Outfit", displayName: "Outfit", category: "sans-serif", family: "Outfit", file: "Outfit-SemiBold.ttf", weight: 600, arabic: "NotoSansArabic" },
  { name: "Orbitron", displayName: "Orbitron", category: "display", family: "Orbitron", file: "Orbitron-Bold.ttf", weight: 700, arabic: "NotoKufiArabic" },
  { name: "BebasNeue", displayName: "Bebas Neue", category: "display", family: "BebasNeue", file: "BebasNeue-Regular.ttf", weight: 400, arabic: "NotoKufiArabic" },
];

const BY_NAME = new Map(LATIN_FONTS.map((f) => [f.name, f]));

/** Resolve a stored font id. Falls back to Inter for unknown names. */
export function getLatinFont(name: string): LatinFont {
  return BY_NAME.get(name) ?? LATIN_FONTS[0]!;
}
