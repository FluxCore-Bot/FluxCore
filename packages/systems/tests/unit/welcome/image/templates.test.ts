import { describe, it, expect } from "vitest";
import {
  getTemplate,
  getAllTemplates,
  isValidTemplate,
} from "../../../../src/welcome/image/templates/index.js";

describe("template registry", () => {
  it("returns all 6 templates", () => {
    const templates = getAllTemplates();
    expect(templates).toHaveLength(6);
    const names = templates.map((t) => t.name);
    expect(names).toContain("starter");
    expect(names).toContain("horizon");
    expect(names).toContain("neon");
    expect(names).toContain("elegant");
    expect(names).toContain("minimal");
    expect(names).toContain("aurora");
  });

  it("gets a template by name", () => {
    const template = getTemplate("neon");
    expect(template.name).toBe("neon");
    expect(template.displayName).toBe("Neon");
    expect(template.canvas.width).toBeGreaterThan(0);
    expect(template.canvas.height).toBeGreaterThan(0);
  });

  it("falls back to starter for unknown template", () => {
    const template = getTemplate("nonexistent");
    expect(template.name).toBe("starter");
  });

  it("validates template names", () => {
    expect(isValidTemplate("starter")).toBe(true);
    expect(isValidTemplate("horizon")).toBe(true);
    expect(isValidTemplate("bogus")).toBe(false);
  });

  describe("template structure", () => {
    const templates = getAllTemplates();

    for (const template of templates) {
      describe(template.name, () => {
        it("has required canvas dimensions", () => {
          expect(template.canvas.width).toBeGreaterThanOrEqual(800);
          expect(template.canvas.height).toBeGreaterThanOrEqual(300);
        });

        it("has avatar positioned within canvas", () => {
          expect(template.avatar.x).toBeGreaterThan(0);
          expect(template.avatar.x).toBeLessThanOrEqual(template.canvas.width);
          expect(template.avatar.y).toBeGreaterThan(0);
          expect(template.avatar.y).toBeLessThanOrEqual(template.canvas.height);
          expect(template.avatar.size).toBeGreaterThan(0);
        });

        it("has title positioned within canvas", () => {
          expect(template.title.x).toBeGreaterThan(0);
          expect(template.title.y).toBeGreaterThan(0);
          expect(template.title.maxWidth).toBeGreaterThan(0);
          expect(["left", "center", "right"]).toContain(template.title.align);
        });

        it("has subtitle positioned within canvas", () => {
          expect(template.subtitle.x).toBeGreaterThan(0);
          expect(template.subtitle.y).toBeGreaterThan(0);
          expect(template.subtitle.maxWidth).toBeGreaterThan(0);
        });

        it("has a display name and description", () => {
          expect(template.displayName.length).toBeGreaterThan(0);
          expect(template.description.length).toBeGreaterThan(0);
        });

        it("has decorations array", () => {
          expect(Array.isArray(template.decorations)).toBe(true);
        });
      });
    }
  });
});
