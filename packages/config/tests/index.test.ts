import { describe, it, expect, beforeEach, vi } from "vitest";

describe("lavalink password", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.DISCORD_TOKEN = "x";
    process.env.CLIENT_ID = "y";
    process.env.BOT_SYNC_SECRET = "a".repeat(64);
    delete process.env.NODE_ENV;
  });

  it("throws when LAVALINK_PASSWORD is unset", async () => {
    delete process.env.LAVALINK_PASSWORD;
    await expect(import("../src/index")).rejects.toThrow(/LAVALINK_PASSWORD/);
  });

  it("uses the env value when present", async () => {
    process.env.LAVALINK_PASSWORD = "from-env";
    const { config } = await import("../src/index");
    expect(config.lavalinkPassword).toBe("from-env");
  });
});
