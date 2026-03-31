import i18next, { type TFunction } from "i18next";
import FsBackend from "i18next-fs-backend";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { supportedLanguageCodes, defaultLanguage } from "./languages.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Path to locale files */
export const localesPath = join(__dirname, "locales");

/** Server-side i18next instance */
let serverI18n: typeof i18next;

/**
 * Initialize i18next for server-side use.
 * Loads translations from filesystem.
 */
export async function initServerI18n(): Promise<typeof i18next> {
  serverI18n = i18next.createInstance();

  await serverI18n.use(FsBackend).init({
    supportedLngs: supportedLanguageCodes,
    fallbackLng: defaultLanguage,
    defaultNS: "common",
    ns: ["common", "errors"],
    preload: [defaultLanguage],

    backend: {
      loadPath: join(localesPath, "{{lng}}/{{ns}}.json"),
    },

    interpolation: {
      escapeValue: false,
    },
  });

  return serverI18n;
}

/**
 * Get a translation function for a specific language.
 * Used in request handlers to translate error messages.
 */
export function getTranslation(lng: string): TFunction {
  return serverI18n.getFixedT(lng);
}

/**
 * Parse the Accept-Language header and return the best matching language.
 */
export function detectLanguage(acceptLanguage: string | undefined): string {
  if (!acceptLanguage) return defaultLanguage;

  const supported = new Set(supportedLanguageCodes);
  const parts = acceptLanguage.split(",");

  for (const part of parts) {
    const [lang] = part.trim().split(";");
    const code = lang.trim().toLowerCase();

    // Exact match
    if (supported.has(code)) return code;

    // Base language match (e.g., "en-US" -> "en")
    const base = code.split("-")[0];
    if (base && supported.has(base)) return base;
  }

  return defaultLanguage;
}

export { serverI18n };
