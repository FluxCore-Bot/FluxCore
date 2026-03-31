// Types
export type { Language, Namespace, I18nError } from "./types.js";

// Language registry
export {
  languages,
  rtlLanguages,
  isRtl,
  getLanguage,
  supportedLanguageCodes,
  defaultLanguage,
} from "./languages.js";
