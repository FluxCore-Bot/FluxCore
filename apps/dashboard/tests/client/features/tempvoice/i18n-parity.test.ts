import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const LOCALES_DIR = join(__dirname, "../../../../../../packages/i18n/src/locales");

type LocaleTree = { [key: string]: string | LocaleTree };

function isLocaleTree(value: unknown): value is LocaleTree {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function namespace(lang: string): LocaleTree {
  const parsed: unknown = JSON.parse(
    readFileSync(join(LOCALES_DIR, lang, "tempvoice.json"), "utf8"),
  );
  if (!isLocaleTree(parsed)) throw new Error(`${lang}/tempvoice.json is not an object`);
  return parsed;
}

function flatten(tree: LocaleTree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return typeof v === "string" ? [path] : flatten(v, path);
  });
}

function valueAt(tree: LocaleTree, path: string): string {
  const found = path.split(".").reduce<string | LocaleTree | undefined>(
    (node, key) => (isLocaleTree(node) ? node[key] : undefined),
    tree,
  );
  return typeof found === "string" ? found : "";
}

const langs = readdirSync(LOCALES_DIR);
const englishKeys = flatten(namespace("en")).sort();

describe("tempvoice i18n", () => {
  it("covers all 48 locales", () => {
    expect(langs).toHaveLength(48);
  });

  it.each(langs)("%s has exactly the English key shape", (lang) => {
    expect(flatten(namespace(lang)).sort()).toEqual(englishKeys);
  });

  it.each(langs.filter((l) => l !== "en"))("%s is actually translated", (lang) => {
    const tree = namespace(lang);
    const en = namespace("en");
    // Placeholders and the default template are legitimately identical across
    // locales; every other string must differ from English.
    const allowed = new Set(["fields.templatePlaceholder", "list.counter"]);
    const untranslated = englishKeys.filter(
      (k) => !allowed.has(k) && valueAt(tree, k) === valueAt(en, k),
    );
    expect(untranslated).toEqual([]);
  });

  it.each(langs)("%s keeps every interpolation placeholder", (lang) => {
    const tree = namespace(lang);
    const en = namespace("en");
    for (const key of englishKeys) {
      const expected = [...valueAt(en, key).matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();
      const actual = [...valueAt(tree, key).matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();
      expect(actual, `${lang} ${key}`).toEqual(expected);
    }
  });

  it.each(langs)("%s never interpolates a variable named count", (lang) => {
    expect(JSON.stringify(namespace(lang))).not.toMatch(/\{\{\s*count\s*\}\}/);
  });
});
