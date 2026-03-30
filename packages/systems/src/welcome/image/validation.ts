import { z } from "zod";

export const backgroundSettingsSchema = z.object({
  type: z.enum(["color", "image", "preset"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#1a1a2e"),
  imageKey: z.string().optional(),
  preset: z.string().optional(),
});

export const overlaySettingsSchema = z.object({
  enabled: z.boolean().default(true),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#000000"),
  opacity: z.number().min(0).max(1).default(0.5),
});

export const avatarSettingsSchema = z.object({
  shape: z.enum(["circle", "rounded", "square"]).default("circle"),
  borderColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#a3a6ff"),
  borderWidth: z.number().min(0).max(12).default(4),
  glowEnabled: z.boolean().default(false),
  glowColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#a3a6ff"),
});

export const textSettingsSchema = z.object({
  font: z.string().default("SpaceGrotesk"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#ffffff"),
  size: z.number().min(12).max(72).default(36),
});

export const welcomeImageSettingsSchema = z.object({
  template: z.string().default("starter"),
  background: backgroundSettingsSchema.default({ type: "color", color: "#1a1a2e" }),
  overlay: overlaySettingsSchema.default({ enabled: true, color: "#000000", opacity: 0.5 }),
  avatar: avatarSettingsSchema.default({ shape: "circle", borderColor: "#a3a6ff", borderWidth: 4, glowEnabled: false, glowColor: "#a3a6ff" }),
  title: textSettingsSchema.default({
    font: "SpaceGrotesk",
    color: "#ffffff",
    size: 36,
  }),
  subtitle: textSettingsSchema
    .extend({
      text: z.string().max(200).default("Welcome to {server}!"),
    })
    .default({
      font: "Inter",
      color: "#a3a6ff",
      size: 20,
      text: "Welcome to {server}!",
    }),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#a3a6ff"),
  sendMode: z.enum(["with", "before", "only"]).default("with"),
});
