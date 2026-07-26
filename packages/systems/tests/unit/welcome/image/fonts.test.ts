import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  LATIN_FONTS,
  ARABIC_FONTS,
  EMOJI_FONT,
  getLatinFont,
} from "../../../../src/welcome/image/fonts/manifest.js";
import { getFontsDir, registerFonts } from "../../../../src/welcome/image/fonts/index.js";

describe("font manifest", () => {
  it("ships every declared Latin font file", () => {
    const dir = getFontsDir();
    for (const font of LATIN_FONTS) {
      expect(existsSync(join(dir, font.file)), `missing ${font.file}`).toBe(true);
    }
  });

  it("ships every declared Arabic and emoji font file", () => {
    const dir = getFontsDir();
    for (const font of Object.values(ARABIC_FONTS)) {
      expect(existsSync(join(dir, font.file)), `missing ${font.file}`).toBe(true);
    }
    expect(existsSync(join(dir, EMOJI_FONT.file))).toBe(true);
  });

  it("gives every Latin font a resolvable Arabic companion", () => {
    for (const font of LATIN_FONTS) {
      expect(ARABIC_FONTS[font.arabic], `${font.name} -> ${font.arabic}`).toBeDefined();
    }
  });

  it("uses space-free family names identical to the font id", () => {
    for (const font of LATIN_FONTS) {
      expect(font.family).toBe(font.name);
      expect(font.family).not.toMatch(/\s/);
    }
  });

  it("falls back to Inter for an unknown font name", () => {
    expect(getLatinFont("NopeNotAFont").name).toBe("Inter");
  });

  it("registers every family with the canvas engine", async () => {
    const { GlobalFonts } = await import("@napi-rs/canvas");
    registerFonts();
    const families = new Set(GlobalFonts.families.map((f) => f.family));
    for (const font of LATIN_FONTS) expect(families.has(font.family)).toBe(true);
    for (const font of Object.values(ARABIC_FONTS)) expect(families.has(font.family)).toBe(true);
    expect(families.has(EMOJI_FONT.family)).toBe(true);
  });
});
