import { describe, it, expect, beforeEach, vi } from "vitest";

describe("BOT_SYNC_SECRET", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.DISCORD_TOKEN = "x";
    process.env.CLIENT_ID = "y";
    process.env.LAVALINK_PASSWORD = "z";
    delete process.env.BOT_SYNC_SECRET;
  });

  it("auto-generates in development", async () => {
    process.env.NODE_ENV = "development";
    const { config } = await import("../src/index");
    expect(config.botSyncSecret).toMatch(/^[0-9a-f]{64}$/);
  });

  it("throws in production when unset", async () => {
    process.env.NODE_ENV = "production";
    await expect(import("../src/index")).rejects.toThrow(/BOT_SYNC_SECRET/);
  });

  it("uses provided value in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.BOT_SYNC_SECRET = "a".repeat(64);
    const { config } = await import("../src/index");
    expect(config.botSyncSecret).toBe("a".repeat(64));
  });

  it("rejects too-short values in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.BOT_SYNC_SECRET = "tooshort";
    await expect(import("../src/index")).rejects.toThrow(/at least 32/);
  });
});
