import { describe, it, expect, vi } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    logLevel: "info",
  },
}));

import {
  successEmbed,
  errorEmbed,
  infoEmbed,
  warnEmbed,
} from "@fluxcore/utils";

describe("embed builders", () => {
  it("creates success embed with correct color", () => {
    const embed = successEmbed("Test Title", "Test description");
    const json = embed.toJSON();
    expect(json.title).toBe("Test Title");
    expect(json.description).toBe("Test description");
    expect(json.color).toBe(0x57f287);
  });

  it("creates error embed with correct color", () => {
    const embed = errorEmbed("Error", "Something failed");
    const json = embed.toJSON();
    expect(json.title).toBe("Error");
    expect(json.description).toBe("Something failed");
    expect(json.color).toBe(0xed4245);
  });

  it("creates info embed with correct color", () => {
    const embed = infoEmbed("Info");
    const json = embed.toJSON();
    expect(json.title).toBe("Info");
    expect(json.description).toBeUndefined();
    expect(json.color).toBe(0x5865f2);
  });

  it("creates warn embed with correct color", () => {
    const embed = warnEmbed("Warning", "Be careful");
    const json = embed.toJSON();
    expect(json.title).toBe("Warning");
    expect(json.color).toBe(0xfee75c);
  });

  it("omits description when not provided", () => {
    const embed = successEmbed("Title Only");
    const json = embed.toJSON();
    expect(json.description).toBeUndefined();
  });

  it("includes timestamp on all embeds", () => {
    const embeds = [
      successEmbed("S"),
      errorEmbed("E"),
      infoEmbed("I"),
      warnEmbed("W"),
    ];
    for (const embed of embeds) {
      expect(embed.toJSON().timestamp).toBeDefined();
    }
  });
});