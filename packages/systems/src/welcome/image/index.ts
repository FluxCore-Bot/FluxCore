// Main renderer
export { generateWelcomeImage } from "./renderer.js";
export type { GenerateImageOptions } from "./renderer.js";

// Types
export {
  type WelcomeImageSettings,
  type RenderInput,
  type TemplateLayout,
  type FontDefinition,
  type StorageAdapter,
  type BackgroundSettings,
  type OverlaySettings,
  type AvatarSettings,
  type TextSettings,
  farewellImageSettingsDefaults,
} from "./types.js";

// Validation (Zod schemas)
export { welcomeImageSettingsSchema } from "./validation.js";

// Constants
export {
  DEFAULT_WELCOME_IMAGE_SETTINGS,
  DEFAULT_FAREWELL_IMAGE_SETTINGS,
  AVAILABLE_FONTS,
  MAX_BACKGROUND_SIZE,
  ALLOWED_BACKGROUND_TYPES,
  PRESET_BACKGROUNDS,
  PRESET_GRADIENTS,
} from "./constants.js";

// Templates
export {
  getTemplate,
  getAllTemplates,
  isValidTemplate,
} from "./templates/index.js";

// Fonts
export {
  registerFonts,
  getAvailableFonts,
  isValidFont,
} from "./fonts/index.js";

// Shared render core (browser-safe — no @napi-rs/canvas import)
export { drawCard } from "./core/draw.js";
export type { Ctx2D, GradientLike, RenderBackend } from "./core/types.js";
export {
  buildFontSpec,
  baseDirection,
  fitText,
  hexToRgba,
  replaceImageVariables,
} from "./core/text.js";
export {
  LATIN_FONTS,
  ARABIC_FONTS,
  EMOJI_FONT,
  getLatinFont,
  type LatinFont,
  type ArabicFont,
  type ArabicFontKey,
} from "./fonts/manifest.js";
export { getFontsDir } from "./fonts/index.js";

// Sanitization
export { sanitizeDisplayName } from "./sanitize.js";

// Storage
export {
  createStorageAdapter,
  LocalStorageAdapter,
  type StorageConfig,
  type LocalStorageConfig,
} from "./storage/index.js";
