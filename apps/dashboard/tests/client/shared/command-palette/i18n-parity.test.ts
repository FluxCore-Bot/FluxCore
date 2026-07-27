import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const LOCALES_DIR = join(__dirname, "../../../../../../packages/i18n/src/locales");

type LocaleTree = { [key: string]: string | LocaleTree };

function isLocaleTree(value: unknown): value is LocaleTree {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function paletteBlock(lang: string): LocaleTree {
  const raw = readFileSync(join(LOCALES_DIR, lang, "common.json"), "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (!isLocaleTree(parsed) || !isLocaleTree(parsed.palette)) {
    throw new Error(`${lang}/common.json has no palette object`);
  }
  return parsed.palette;
}

function placeholderOf(lang: string): string {
  const value = paletteBlock(lang).placeholder;
  if (typeof value !== "string") {
    throw new Error(`${lang} palette.placeholder is not a string`);
  }
  return value;
}

function flatten(tree: LocaleTree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return typeof v === "string" ? [path] : flatten(v, path);
  });
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
    const value = placeholderOf(lang);
    expect(value).toBeTruthy();
    expect(value).not.toBe(placeholderOf("en"));
  });

  it.each(langs)("%s never interpolates a variable named count", (lang) => {
    const json = JSON.stringify(paletteBlock(lang));
    expect(json).not.toMatch(/\{\{\s*count\s*\}\}/);
  });
});
