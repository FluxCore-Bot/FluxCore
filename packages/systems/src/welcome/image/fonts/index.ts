import { join, dirname } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { GlobalFonts } from "@napi-rs/canvas";
import { LATIN_FONTS, ARABIC_FONTS, EMOJI_FONT } from "./manifest.js";
import { AVAILABLE_FONTS } from "../constants.js";
import type { FontDefinition } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

let fontsRegistered = false;

/**
 * Resolve the fonts/files directory.
 * In dev (tsx): src/welcome/image/fonts/ → files/ is a sibling
 * In dist:     dist/welcome/image/fonts/ → files/ is a sibling (copied by build script)
 *
 * Exported so the dashboard can serve the exact same bytes the bot renders with.
 */
export function getFontsDir(): string {
  const candidate = join(__dirname, "files");
  if (existsSync(candidate)) return candidate;

  const srcCandidate = join(
    __dirname, "..", "..", "..", "..", "src", "welcome", "image", "fonts", "files",
  );
  if (existsSync(srcCandidate)) return srcCandidate;

  return candidate;
}

/** Register every bundled font. Safe to call repeatedly — registers once. */
export function registerFonts(): void {
  if (fontsRegistered) return;

  const dir = getFontsDir();
  const all = [
    ...LATIN_FONTS.map((f) => ({ family: f.family, file: f.file })),
    ...Object.values(ARABIC_FONTS).map((f) => ({ family: f.family, file: f.file })),
    { family: EMOJI_FONT.family, file: EMOJI_FONT.file },
  ];

  for (const font of all) {
    const path = join(dir, font.file);
    if (existsSync(path)) GlobalFonts.registerFromPath(path, font.family);
  }

  fontsRegistered = true;
}

/** All picker-selectable fonts for the dashboard UI. */
export function getAvailableFonts(): FontDefinition[] {
  return [...AVAILABLE_FONTS];
}

/** Whether a stored font id is known. */
export function isValidFont(name: string): boolean {
  return AVAILABLE_FONTS.some((f) => f.name === name);
}
