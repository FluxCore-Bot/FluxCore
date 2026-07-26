import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const LOCALES_DIR = join(__dirname, "../../../../../../packages/i18n/src/locales");

function paletteBlock(lang: string): Record<string, unknown> {
  const raw = readFileSync(join(LOCALES_DIR, lang, "common.json"), "utf8");
  return JSON.parse(raw).palette;
}

function flatten(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    flatten(v, prefix ? `${prefix}.${k}` : k),
  );
}

const langs = readdirSync(LOCALES_DIR);
const englishKeys = flatten(paletteBlock("en")).sort();

describe("palette i18n", () => {
  it("covers all 48 locales", () => {
    expect(langs).toHaveLength(48);
  });

  it.each(langs)("%s has the same palette keys as en", (lang) => {
    expect(flatten(paletteBlock(lang)).sort()).toEqual(englishKeys);
  });

  it.each(langs)("%s translates the placeholder rather than copying English", (lang) => {
    if (lang === "en") return;
    const value = (paletteBlock(lang) as { placeholder: string }).placeholder;
    expect(value).toBeTruthy();
    expect(value).not.toBe((paletteBlock("en") as { placeholder: string }).placeholder);
  });

  it.each(langs)("%s never interpolates a variable named count", (lang) => {
    const json = JSON.stringify(paletteBlock(lang));
    expect(json).not.toMatch(/\{\{\s*count\s*\}\}/);
  });
});
