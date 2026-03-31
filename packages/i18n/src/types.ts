/** Supported language definition */
export interface Language {
  /** ISO 639-1 code (e.g. "en", "ar", "fr") */
  code: string;
  /** Native name (e.g. "العربية", "Fran\u00e7ais") */
  name: string;
  /** English name for reference */
  englishName: string;
  /** Text direction */
  dir: "ltr" | "rtl";
}

/** i18n namespace identifiers */
export type Namespace = "common" | "errors";

/** Error response with i18n key */
export interface I18nError {
  /** i18n key for the error message (e.g. "errors:not_authenticated") */
  errorKey: string;
  /** Fallback English message */
  error: string;
  /** Optional interpolation values */
  params?: Record<string, string | number>;
}
