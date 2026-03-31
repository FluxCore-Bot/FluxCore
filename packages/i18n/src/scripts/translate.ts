/**
 * Auto-translation script.
 *
 * Copies English locale files to all supported languages, marking strings
 * with a "[NEEDS TRANSLATION]" prefix so they can be identified and
 * translated later (manually or via a translation API).
 *
 * Usage:
 *   pnpm --filter @fluxcore/i18n translate
 *   pnpm --filter @fluxcore/i18n translate -- --lang fr,ar
 *   pnpm --filter @fluxcore/i18n translate -- --clean  (removes prefix markers)
 */

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = join(__dirname, "../locales");

// Languages from the registry (import would need build — just list codes here)
const ALL_LANGUAGES = [
  "ar", "he", "fa", "ur", "fr", "de", "es", "pt", "it", "nl", "pl", "cs",
  "sk", "ro", "bg", "el", "tr", "ru", "uk", "ja", "ko", "zh-CN", "zh-TW",
  "th", "vi", "id", "ms", "hi", "bn", "ta", "fil", "sv", "no", "da", "fi",
  "hu", "hr", "sr", "lt", "lv", "et", "sl", "sw", "af", "ca", "eu", "gl",
];

function prefixValues(
  obj: Record<string, unknown>,
  prefix: string,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      result[key] = `${prefix}${value}`;
    } else if (typeof value === "object" && value !== null) {
      result[key] = prefixValues(
        value as Record<string, unknown>,
        prefix,
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

function stripPrefix(
  obj: Record<string, unknown>,
  prefix: string,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string" && value.startsWith(prefix)) {
      result[key] = value.slice(prefix.length);
    } else if (typeof value === "object" && value !== null) {
      result[key] = stripPrefix(
        value as Record<string, unknown>,
        prefix,
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const cleanMode = args.includes("--clean");
  const langIdx = args.indexOf("--lang");
  const targetLangs =
    langIdx !== -1 && args[langIdx + 1]
      ? args[langIdx + 1].split(",")
      : ALL_LANGUAGES;

  const MARKER = "[NEEDS TRANSLATION] ";

  // Read all English namespace files
  const enDir = join(localesDir, "en");
  const nsFiles = await readdir(enDir);
  const namespaces: Record<string, Record<string, unknown>> = {};

  for (const file of nsFiles) {
    if (!file.endsWith(".json")) continue;
    const ns = file.replace(".json", "");
    const content = await readFile(join(enDir, file), "utf-8");
    namespaces[ns] = JSON.parse(content) as Record<string, unknown>;
  }

  for (const lang of targetLangs) {
    const langDir = join(localesDir, lang);
    await mkdir(langDir, { recursive: true });

    for (const [ns, enData] of Object.entries(namespaces)) {
      const filePath = join(langDir, `${ns}.json`);

      if (cleanMode) {
        // Remove markers from existing file
        try {
          const existing = JSON.parse(
            await readFile(filePath, "utf-8"),
          ) as Record<string, unknown>;
          const cleaned = stripPrefix(existing, MARKER);
          await writeFile(filePath, JSON.stringify(cleaned, null, 2) + "\n");
          console.log(`  Cleaned ${lang}/${ns}.json`);
        } catch {
          // File doesn't exist, skip
        }
        continue;
      }

      // Check if file already exists — merge new keys only
      let existing: Record<string, unknown> = {};
      try {
        existing = JSON.parse(
          await readFile(filePath, "utf-8"),
        ) as Record<string, unknown>;
      } catch {
        // File doesn't exist — create fresh
      }

      const merged = mergeTranslations(existing, enData, MARKER);
      await writeFile(filePath, JSON.stringify(merged, null, 2) + "\n");
      console.log(`  Generated ${lang}/${ns}.json`);
    }
  }

  console.log(
    cleanMode
      ? "\nDone! Markers removed."
      : `\nDone! Generated translations for ${targetLangs.length} languages.`,
  );
  console.log(
    "Strings marked with [NEEDS TRANSLATION] need manual or API translation.",
  );
}

/**
 * Merge English source into existing translations.
 * - Keeps already-translated values (no marker prefix).
 * - Adds new keys from English with marker prefix.
 * - Preserves existing translations for keys that still exist.
 */
function mergeTranslations(
  existing: Record<string, unknown>,
  source: Record<string, unknown>,
  marker: string,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, srcValue] of Object.entries(source)) {
    const existingValue = existing[key];

    if (typeof srcValue === "object" && srcValue !== null) {
      result[key] = mergeTranslations(
        (typeof existingValue === "object" && existingValue !== null
          ? existingValue
          : {}) as Record<string, unknown>,
        srcValue as Record<string, unknown>,
        marker,
      );
    } else if (typeof srcValue === "string") {
      if (
        typeof existingValue === "string" &&
        !existingValue.startsWith(marker)
      ) {
        // Already translated — keep it
        result[key] = existingValue;
      } else {
        // New or untranslated — mark it
        result[key] = `${marker}${srcValue}`;
      }
    } else {
      result[key] = existingValue ?? srcValue;
    }
  }

  return result;
}

main().catch((err: unknown) => {
  console.error("Translation script failed:", err);
  process.exit(1);
});
