import { describe, it, expect } from "vitest";
import { welcomeImageSettingsSchema } from "../../../../src/welcome/image/validation.js";
import {
  DEFAULT_WELCOME_IMAGE_SETTINGS,
  DEFAULT_FAREWELL_IMAGE_SETTINGS,
} from "../../../../src/welcome/image/constants.js";

describe("welcomeImageSettingsSchema", () => {
  it("parses valid settings", () => {
    const result = welcomeImageSettingsSchema.safeParse(DEFAULT_WELCOME_IMAGE_SETTINGS);
    expect(result.success).toBe(true);
  });

  it("parses farewell defaults", () => {
    const result = welcomeImageSettingsSchema.safeParse(DEFAULT_FAREWELL_IMAGE_SETTINGS);
    expect(result.success).toBe(true);
  });

  it("applies defaults for empty object", () => {
    const result = welcomeImageSettingsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.template).toBe("starter");
      expect(result.data.background.type).toBe("color");
      expect(result.data.overlay.enabled).toBe(true);
      expect(result.data.avatar.shape).toBe("circle");
      expect(result.data.sendMode).toBe("with");
    }
  });

  it("rejects invalid hex colors", () => {
    const result = welcomeImageSettingsSchema.safeParse({
      accentColor: "not-a-color",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid send mode", () => {
    const result = welcomeImageSettingsSchema.safeParse({
      sendMode: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects avatar shape outside enum", () => {
    const result = welcomeImageSettingsSchema.safeParse({
      avatar: { shape: "triangle" },
    });
    expect(result.success).toBe(false);
  });

  it("clamps overlay opacity to 0-1", () => {
    const result = welcomeImageSettingsSchema.safeParse({
      overlay: { opacity: 1.5 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects subtitle text over 200 chars", () => {
    const result = welcomeImageSettingsSchema.safeParse({
      subtitle: { text: "a".repeat(201) },
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid custom settings", () => {
    const result = welcomeImageSettingsSchema.safeParse({
      template: "neon",
      background: { type: "preset", color: "#000000", preset: "midnight" },
      overlay: { enabled: false, color: "#000000", opacity: 0 },
      avatar: {
        shape: "rounded",
        borderColor: "#ff0000",
        borderWidth: 8,
        glowEnabled: true,
        glowColor: "#ff0000",
      },
      title: { font: "Orbitron", color: "#00ff00", size: 48 },
      subtitle: { font: "Poppins", color: "#0000ff", size: 24, text: "Welcome!" },
      accentColor: "#ff00ff",
      sendMode: "before",
    });
    expect(result.success).toBe(true);
  });
});
