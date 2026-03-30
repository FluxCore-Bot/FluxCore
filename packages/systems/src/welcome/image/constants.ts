import type { WelcomeImageSettings, FontDefinition } from "./types.js";

/** Default welcome image settings (used when first enabling images) */
export const DEFAULT_WELCOME_IMAGE_SETTINGS: WelcomeImageSettings = {
  template: "starter",
  background: {
    type: "color",
    color: "#1a1a2e",
  },
  overlay: {
    enabled: true,
    color: "#000000",
    opacity: 0.5,
  },
  avatar: {
    shape: "circle",
    borderColor: "#a3a6ff",
    borderWidth: 4,
    glowEnabled: false,
    glowColor: "#a3a6ff",
  },
  title: {
    font: "SpaceGrotesk",
    color: "#ffffff",
    size: 36,
  },
  subtitle: {
    font: "Inter",
    color: "#a3a6ff",
    size: 20,
    text: "Welcome to {server}!",
  },
  accentColor: "#a3a6ff",
  sendMode: "with",
};

/** Default farewell image settings */
export const DEFAULT_FAREWELL_IMAGE_SETTINGS: WelcomeImageSettings = {
  ...DEFAULT_WELCOME_IMAGE_SETTINGS,
  subtitle: {
    font: "Inter",
    color: "#6b7280",
    size: 20,
    text: "Goodbye, {user.name}!",
  },
  accentColor: "#6b7280",
};

/** Available fonts shipped with the system */
export const AVAILABLE_FONTS: FontDefinition[] = [
  {
    name: "Inter",
    displayName: "Inter",
    category: "sans-serif",
    file: "Inter-SemiBold.ttf",
    weight: 600,
  },
  {
    name: "SpaceGrotesk",
    displayName: "Space Grotesk",
    category: "sans-serif",
    file: "SpaceGrotesk-Bold.ttf",
    weight: 700,
  },
  {
    name: "JetBrainsMono",
    displayName: "JetBrains Mono",
    category: "monospace",
    file: "JetBrainsMono-Bold.ttf",
    weight: 700,
  },
  {
    name: "Poppins",
    displayName: "Poppins",
    category: "rounded",
    file: "Poppins-SemiBold.ttf",
    weight: 600,
  },
  {
    name: "PlayfairDisplay",
    displayName: "Playfair Display",
    category: "serif",
    file: "PlayfairDisplay-Bold.ttf",
    weight: 700,
  },
  {
    name: "Outfit",
    displayName: "Outfit",
    category: "sans-serif",
    file: "Outfit-SemiBold.ttf",
    weight: 600,
  },
  {
    name: "Orbitron",
    displayName: "Orbitron",
    category: "display",
    file: "Orbitron-Bold.ttf",
    weight: 700,
  },
  {
    name: "BebasNeue",
    displayName: "Bebas Neue",
    category: "display",
    file: "BebasNeue-Regular.ttf",
    weight: 400,
  },
];

/** Max background image upload size (3 MB) */
export const MAX_BACKGROUND_SIZE = 3 * 1024 * 1024;

/** Allowed background image MIME types */
export const ALLOWED_BACKGROUND_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Canvas output format */
export const OUTPUT_FORMAT = "image/png" as const;

/** Preset background names (built-in gradient backgrounds) */
export const PRESET_BACKGROUNDS = [
  "midnight",
  "ocean",
  "sunset",
  "forest",
  "nebula",
  "ember",
] as const;

export type PresetBackground = (typeof PRESET_BACKGROUNDS)[number];

/** Gradient definitions for preset backgrounds */
export const PRESET_GRADIENTS: Record<PresetBackground, [string, string, string?]> = {
  midnight: ["#0f0c29", "#302b63", "#24243e"],
  ocean: ["#141e30", "#243b55"],
  sunset: ["#1a0a2e", "#6b2fa0", "#d4418e"],
  forest: ["#0a1a0a", "#1b4332", "#2d6a4f"],
  nebula: ["#16082b", "#4a1a7a", "#1a0a3e"],
  ember: ["#1a0a0a", "#7a1a1a", "#3e1a0a"],
};

/** Image variables for text replacement (subset of welcome variables for image context) */
export const IMAGE_VARIABLES: Record<string, string> = {
  "{user}": "username",
  "{user.name}": "username",
  "{user.displayname}": "displayName",
  "{server}": "guildName",
  "{membercount}": "memberCount",
};
