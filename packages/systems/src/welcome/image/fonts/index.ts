import { join, dirname } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { GlobalFonts } from "@napi-rs/canvas";
import { AVAILABLE_FONTS } from "../constants.js";
import type { FontDefinition } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

let fontsRegistered = false;

/**
 * Resolve the fonts/files directory.
 * In dev (tsx): src/welcome/image/fonts/ → files/ is a sibling
 * In dist:     dist/welcome/image/fonts/ → files/ is a sibling (copied by build script)
 */
function getFontsDir(): string {
  const candidate = join(__dirname, "files");
  if (existsSync(candidate)) return candidate;

  // Fallback: walk up to find src/welcome/image/fonts/files
  const srcCandidate = join(__dirname, "..", "..", "..", "..", "src", "welcome", "image", "fonts", "files");
  if (existsSync(srcCandidate)) return srcCandidate;

  return candidate; // Will fail at registration time with a clear error
}

/**
 * Register all bundled fonts with the canvas engine.
 * Safe to call multiple times — only registers once.
 */
export function registerFonts(): void {
  if (fontsRegistered) return;

  const fontsDir = getFontsDir();
  for (const font of AVAILABLE_FONTS) {
    const fontPath = join(fontsDir, font.file);
    if (existsSync(fontPath)) {
      GlobalFonts.registerFromPath(fontPath, font.name);
    }
  }

  fontsRegistered = true;
}

/**
 * Get a font family string for canvas context.
 * Falls back to "Inter" if the requested font is not found.
 */
export function getFontFamily(name: string): string {
  const font = AVAILABLE_FONTS.find((f) => f.name === name);
  return font ? font.name : "Inter";
}

/**
 * Get all available fonts for the dashboard UI.
 */
export function getAvailableFonts(): FontDefinition[] {
  return [...AVAILABLE_FONTS];
}

/**
 * Check if a font name is valid/registered.
 */
export function isValidFont(name: string): boolean {
  return AVAILABLE_FONTS.some((f) => f.name === name);
}
