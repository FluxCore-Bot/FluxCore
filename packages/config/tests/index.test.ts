import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("loadConfig — DASHBOARD_SESSION_SECRET", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
    process.env.DISCORD_TOKEN = "test-token";
    process.env.CLIENT_ID = "test-client-id";
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.resetModules();
  });

  it("throws in production when DASHBOARD_SESSION_SECRET is missing", async () => {
    process.env.NODE_ENV = "production";
    process.env.DASHBOARD_PUBLIC_URL = "https://dash.example.com";
    delete process.env.DASHBOARD_SESSION_SECRET;
    await expect(import("../src/index.js")).rejects.toThrow(
      /DASHBOARD_SESSION_SECRET/,
    );
  });

  it("uses provided DASHBOARD_SESSION_SECRET in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.DASHBOARD_PUBLIC_URL = "https://dash.example.com";
    process.env.DASHBOARD_SESSION_SECRET = "a".repeat(64);
    const mod = await import("../src/index.js");
    expect(mod.config.dashboardSessionSecret).toBe("a".repeat(64));
  });

  it("generates an ephemeral secret in development with a warning", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.DASHBOARD_SESSION_SECRET;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mod = await import("../src/index.js");
    expect(mod.config.dashboardSessionSecret).toMatch(/^[0-9a-f]{64}$/);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("DASHBOARD_SESSION_SECRET"),
    );
    warn.mockRestore();
  });
});

describe("loadConfig — DASHBOARD_PUBLIC_URL", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
    process.env.DISCORD_TOKEN = "t";
    process.env.CLIENT_ID = "c";
    process.env.DASHBOARD_SESSION_SECRET = "x".repeat(64);
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.resetModules();
  });

  it("throws in production when DASHBOARD_PUBLIC_URL is missing", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.DASHBOARD_PUBLIC_URL;
    await expect(import("../src/index.js")).rejects.toThrow(
      /DASHBOARD_PUBLIC_URL/,
    );
  });

  it("rejects DASHBOARD_PUBLIC_URL without https in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.DASHBOARD_PUBLIC_URL = "http://example.com";
    await expect(import("../src/index.js")).rejects.toThrow(/https/);
  });

  it("accepts a valid https URL", async () => {
    process.env.NODE_ENV = "production";
    process.env.DASHBOARD_PUBLIC_URL = "https://dash.example.com";
    const mod = await import("../src/index.js");
    expect(mod.config.dashboardPublicUrl).toBe("https://dash.example.com");
  });

  it("defaults to http://localhost:PORT in development", async () => {
    process.env.NODE_ENV = "development";
    process.env.DASHBOARD_PORT = "3000";
    delete process.env.DASHBOARD_PUBLIC_URL;
    const mod = await import("../src/index.js");
    expect(mod.config.dashboardPublicUrl).toBe("http://localhost:3000");
  });
});
