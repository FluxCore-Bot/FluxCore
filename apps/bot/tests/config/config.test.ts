import { describe, it, expect, vi, beforeEach } from "vitest";

describe("config", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("loads config from environment variables", async () => {
    vi.stubEnv("DISCORD_TOKEN", "test-token");
    vi.stubEnv("CLIENT_ID", "test-client-id");
    vi.stubEnv("LOG_LEVEL", "debug");
    vi.stubEnv("LAVALINK_PASSWORD", "test-lavalink-pw");

    const { config } = await import("@fluxcore/config");

    expect(config.token).toBe("test-token");
    expect(config.clientId).toBe("test-client-id");
    expect(config.logLevel).toBe("debug");
  });

  it("throws when DISCORD_TOKEN is missing", async () => {
    vi.stubEnv("DISCORD_TOKEN", "");
    vi.stubEnv("CLIENT_ID", "test-client-id");

    await expect(
      import("@fluxcore/config"),
    ).rejects.toThrow("DISCORD_TOKEN");
  });

  it("throws when CLIENT_ID is missing", async () => {
    vi.stubEnv("DISCORD_TOKEN", "test-token");
    vi.stubEnv("CLIENT_ID", "");

    await expect(
      import("@fluxcore/config"),
    ).rejects.toThrow("CLIENT_ID");
  });

  it("defaults log level to info", async () => {
    vi.stubEnv("DISCORD_TOKEN", "test-token");
    vi.stubEnv("CLIENT_ID", "test-client-id");
    vi.stubEnv("LOG_LEVEL", "");
    vi.stubEnv("LAVALINK_PASSWORD", "test-lavalink-pw");

    const { config } = await import("@fluxcore/config");
    expect(config.logLevel).toBe("info");
  });

  it("sets guildId to undefined when not provided", async () => {
    vi.stubEnv("DISCORD_TOKEN", "test-token");
    vi.stubEnv("CLIENT_ID", "test-client-id");
    vi.stubEnv("GUILD_ID", "");
    vi.stubEnv("LAVALINK_PASSWORD", "test-lavalink-pw");

    const { config } = await import("@fluxcore/config");
    expect(config.guildId).toBeUndefined();
  });

  it("throws for invalid LOG_LEVEL value", async () => {
    vi.stubEnv("DISCORD_TOKEN", "test-token");
    vi.stubEnv("CLIENT_ID", "test-client-id");
    vi.stubEnv("LOG_LEVEL", "trace");

    await expect(import("@fluxcore/config")).rejects.toThrow(
      "Invalid LOG_LEVEL",
    );
  });

  it("throws for uppercase LOG_LEVEL value", async () => {
    vi.stubEnv("DISCORD_TOKEN", "test-token");
    vi.stubEnv("CLIENT_ID", "test-client-id");
    vi.stubEnv("LOG_LEVEL", "INFO");

    await expect(import("@fluxcore/config")).rejects.toThrow(
      "Invalid LOG_LEVEL",
    );
  });
});