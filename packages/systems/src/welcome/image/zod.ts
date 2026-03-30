/**
 * Re-export Zod schemas for use in API route validation.
 */
export { welcomeImageSettingsSchema } from "./validation.js";
export {
  DEFAULT_WELCOME_IMAGE_SETTINGS,
  DEFAULT_FAREWELL_IMAGE_SETTINGS,
  MAX_BACKGROUND_SIZE,
  ALLOWED_BACKGROUND_TYPES,
} from "./constants.js";
