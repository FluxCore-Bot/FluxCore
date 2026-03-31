import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import HttpBackend from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";
import { supportedLanguageCodes, defaultLanguage } from "./languages.js";

/**
 * Initialize i18next for the React client.
 * Loads translations from the server via HTTP backend.
 */
export async function initClientI18n(): Promise<typeof i18next> {
  await i18next
    .use(HttpBackend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      supportedLngs: supportedLanguageCodes,
      fallbackLng: defaultLanguage,
      defaultNS: "common",
      ns: [
        "common", "errors", "landing",
        "overview", "rules", "tempvoice", "music", "settings", "logs",
        "moderation", "warnings", "welcome", "roles", "leveling",
        "scheduled", "security", "tickets", "giveaways", "suggestions",
        "starboard", "commands", "permissions",
      ],

      detection: {
        order: ["localStorage", "navigator"],
        lookupLocalStorage: "fluxcore-language",
        caches: ["localStorage"],
      },

      backend: {
        loadPath: "/api/i18n/{{lng}}/{{ns}}",
      },

      interpolation: {
        escapeValue: false, // React already escapes
      },

      react: {
        useSuspense: true,
      },
    });

  return i18next;
}

export { i18next };
