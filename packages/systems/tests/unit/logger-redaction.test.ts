import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: { logLevel: "debug" },
}));

import { logger, redactSensitive } from "../../../utils/src/logger.js";

describe("redactSensitive", () => {
  it("redacts Bearer tokens", () => {
    expect(redactSensitive("Authorization: Bearer abc.def.ghi")).toBe(
      "Authorization: Bearer [REDACTED]",
    );
  });

  it("redacts Basic auth headers", () => {
    expect(redactSensitive("Authorization: Basic dXNlcjpwYXNz")).toBe(
      "Authorization: Basic [REDACTED]",
    );
  });

  it("redacts Discord bot tokens (MFA-format)", () => {
    const tok =
      "MTAxNzg5NjU0MzIxMDk4NzY1NA.GabCde.fghIjkLmnOpqrStuvwxyz0123456789ABCDEF";
    const out = redactSensitive(`Logging in with ${tok}`);
    expect(out).toContain("[REDACTED]");
    expect(out).not.toContain(tok);
  });

  it("redacts Discord webhook URLs", () => {
    const url =
      "https://discord.com/api/webhooks/1234567890/abcdefgHIJKLMNOPqrstuvwxyz";
    expect(redactSensitive(`POST to ${url}`)).toBe(
      "POST to https://discord.com/api/webhooks/[REDACTED]",
    );
  });

  it("redacts versioned Discord webhook URLs", () => {
    const url =
      "https://discord.com/api/v10/webhooks/1234567890/abcdefgHIJKLMNOPqrstuvwxyz";
    expect(redactSensitive(url)).toBe(
      "https://discord.com/api/webhooks/[REDACTED]",
    );
  });

  it("redacts query parameters that look secret", () => {
    expect(
      redactSensitive("https://api.example.com/x?code=abc123&keep=ok"),
    ).toBe("https://api.example.com/x?code=[REDACTED]&keep=ok");
    expect(
      redactSensitive("https://api.example.com/x?client_secret=xyz"),
    ).toBe("https://api.example.com/x?client_secret=[REDACTED]");
    expect(
      redactSensitive("https://api.example.com/x?token=abc&api_key=def"),
    ).toBe(
      "https://api.example.com/x?token=[REDACTED]&api_key=[REDACTED]",
    );
  });

  it("leaves benign strings alone", () => {
    expect(redactSensitive("hello world")).toBe("hello world");
  });

  it("returns empty input unchanged", () => {
    expect(redactSensitive("")).toBe("");
  });
});

describe("logger redaction", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("redacts secrets in info messages", () => {
    logger.info("Authorization: Bearer secret123");
    const printed = logSpy.mock.calls
      .map((c: unknown[]) => c.join(" "))
      .join("\n");
    expect(printed).not.toContain("secret123");
    expect(printed).toContain("[REDACTED]");
  });

  it("redacts secrets in error stacks", () => {
    const err = new Error("failed");
    err.stack = "Error: failed\n    at fn (https://x.example/?token=leak)";
    logger.error("oops", err);
    const printed = logSpy.mock.calls
      .map((c: unknown[]) => c.join(" "))
      .join("\n");
    expect(printed).not.toContain("leak");
    expect(printed).toContain("[REDACTED]");
  });

  it("redacts webhook URLs in warn messages", () => {
    logger.warn(
      "fired https://discord.com/api/webhooks/111/aaaBBBcccDDDeee",
    );
    const printed = logSpy.mock.calls
      .map((c: unknown[]) => c.join(" "))
      .join("\n");
    expect(printed).not.toContain("aaaBBBcccDDDeee");
    expect(printed).toContain("[REDACTED]");
  });
});
