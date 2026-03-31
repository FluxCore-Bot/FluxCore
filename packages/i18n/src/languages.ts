import type { Language } from "./types.js";

/**
 * All supported languages.
 * RTL languages: Arabic, Hebrew, Persian, Urdu
 */
export const languages: Language[] = [
  { code: "en", name: "English", englishName: "English", dir: "ltr" },
  { code: "ar", name: "\u0627\u0644\u0639\u0631\u0628\u064a\u0629", englishName: "Arabic", dir: "rtl" },
  { code: "he", name: "\u05e2\u05d1\u05e8\u05d9\u05ea", englishName: "Hebrew", dir: "rtl" },
  { code: "fa", name: "\u0641\u0627\u0631\u0633\u06cc", englishName: "Persian", dir: "rtl" },
  { code: "ur", name: "\u0627\u0631\u062f\u0648", englishName: "Urdu", dir: "rtl" },
  { code: "fr", name: "Fran\u00e7ais", englishName: "French", dir: "ltr" },
  { code: "de", name: "Deutsch", englishName: "German", dir: "ltr" },
  { code: "es", name: "Espa\u00f1ol", englishName: "Spanish", dir: "ltr" },
  { code: "pt", name: "Portugu\u00eas", englishName: "Portuguese", dir: "ltr" },
  { code: "it", name: "Italiano", englishName: "Italian", dir: "ltr" },
  { code: "nl", name: "Nederlands", englishName: "Dutch", dir: "ltr" },
  { code: "pl", name: "Polski", englishName: "Polish", dir: "ltr" },
  { code: "cs", name: "\u010ce\u0161tina", englishName: "Czech", dir: "ltr" },
  { code: "sk", name: "Sloven\u010dina", englishName: "Slovak", dir: "ltr" },
  { code: "ro", name: "Rom\u00e2n\u0103", englishName: "Romanian", dir: "ltr" },
  { code: "bg", name: "\u0411\u044a\u043b\u0433\u0430\u0440\u0441\u043a\u0438", englishName: "Bulgarian", dir: "ltr" },
  { code: "el", name: "\u0395\u03bb\u03bb\u03b7\u03bd\u03b9\u03ba\u03ac", englishName: "Greek", dir: "ltr" },
  { code: "tr", name: "T\u00fcrk\u00e7e", englishName: "Turkish", dir: "ltr" },
  { code: "ru", name: "\u0420\u0443\u0441\u0441\u043a\u0438\u0439", englishName: "Russian", dir: "ltr" },
  { code: "uk", name: "\u0423\u043a\u0440\u0430\u0457\u043d\u0441\u044c\u043a\u0430", englishName: "Ukrainian", dir: "ltr" },
  { code: "ja", name: "\u65e5\u672c\u8a9e", englishName: "Japanese", dir: "ltr" },
  { code: "ko", name: "\ud55c\uad6d\uc5b4", englishName: "Korean", dir: "ltr" },
  { code: "zh-CN", name: "\u7b80\u4f53\u4e2d\u6587", englishName: "Chinese (Simplified)", dir: "ltr" },
  { code: "zh-TW", name: "\u7e41\u9ad4\u4e2d\u6587", englishName: "Chinese (Traditional)", dir: "ltr" },
  { code: "th", name: "\u0e44\u0e17\u0e22", englishName: "Thai", dir: "ltr" },
  { code: "vi", name: "Ti\u1ebfng Vi\u1ec7t", englishName: "Vietnamese", dir: "ltr" },
  { code: "id", name: "Bahasa Indonesia", englishName: "Indonesian", dir: "ltr" },
  { code: "ms", name: "Bahasa Melayu", englishName: "Malay", dir: "ltr" },
  { code: "hi", name: "\u0939\u093f\u0928\u094d\u0926\u0940", englishName: "Hindi", dir: "ltr" },
  { code: "bn", name: "\u09ac\u09be\u0982\u09b2\u09be", englishName: "Bengali", dir: "ltr" },
  { code: "ta", name: "\u0ba4\u0bae\u0bbf\u0bb4\u0bcd", englishName: "Tamil", dir: "ltr" },
  { code: "fil", name: "Filipino", englishName: "Filipino", dir: "ltr" },
  { code: "sv", name: "Svenska", englishName: "Swedish", dir: "ltr" },
  { code: "no", name: "Norsk", englishName: "Norwegian", dir: "ltr" },
  { code: "da", name: "Dansk", englishName: "Danish", dir: "ltr" },
  { code: "fi", name: "Suomi", englishName: "Finnish", dir: "ltr" },
  { code: "hu", name: "Magyar", englishName: "Hungarian", dir: "ltr" },
  { code: "hr", name: "Hrvatski", englishName: "Croatian", dir: "ltr" },
  { code: "sr", name: "\u0421\u0440\u043f\u0441\u043a\u0438", englishName: "Serbian", dir: "ltr" },
  { code: "lt", name: "Lietuvi\u0173", englishName: "Lithuanian", dir: "ltr" },
  { code: "lv", name: "Latvie\u0161u", englishName: "Latvian", dir: "ltr" },
  { code: "et", name: "Eesti", englishName: "Estonian", dir: "ltr" },
  { code: "sl", name: "Sloven\u0161\u010dina", englishName: "Slovenian", dir: "ltr" },
  { code: "sw", name: "Kiswahili", englishName: "Swahili", dir: "ltr" },
  { code: "af", name: "Afrikaans", englishName: "Afrikaans", dir: "ltr" },
  { code: "ca", name: "Catal\u00e0", englishName: "Catalan", dir: "ltr" },
  { code: "eu", name: "Euskara", englishName: "Basque", dir: "ltr" },
  { code: "gl", name: "Galego", englishName: "Galician", dir: "ltr" },
];

/** Language codes for RTL languages */
export const rtlLanguages = new Set(
  languages.filter((l) => l.dir === "rtl").map((l) => l.code),
);

/** Check if a language code is RTL */
export function isRtl(code: string): boolean {
  return rtlLanguages.has(code);
}

/** Get language definition by code, or undefined if not found */
export function getLanguage(code: string): Language | undefined {
  return languages.find((l) => l.code === code);
}

/** All supported language codes */
export const supportedLanguageCodes = languages.map((l) => l.code);

/** Default/fallback language */
export const defaultLanguage = "en";
