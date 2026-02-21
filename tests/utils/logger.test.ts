import { describe, it, expect, vi, beforeEach } from "vitest";

describe("logger", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("creates a logger instance", async () => {
    vi.stubEnv("DISCORD_TOKEN", "test-token");
    vi.stubEnv("CLIENT_ID", "test-client-id");
    vi.stubEnv("LOG_LEVEL", "debug");

    const { logger } = await import("../../src/utils/logger.js");
    expect(logger).toBeDefined();
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
  });

  it("respects log level filtering", async () => {
    vi.stubEnv("DISCORD_TOKEN", "test-token");
    vi.stubEnv("CLIENT_ID", "test-client-id");
    vi.stubEnv("LOG_LEVEL", "error");

    // Import first (dotenv may log during import)
    const { logger } = await import("../../src/utils/logger.js");

    // Spy AFTER import to avoid dotenv noise
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    logger.debug("should not appear");
    logger.info("should not appear");
    logger.warn("should not appear");
    expect(consoleSpy).not.toHaveBeenCalled();

    logger.error("should appear");
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("logs error stack when provided", async () => {
    vi.stubEnv("DISCORD_TOKEN", "test-token");
    vi.stubEnv("CLIENT_ID", "test-client-id");
    vi.stubEnv("LOG_LEVEL", "error");

    // Import first (dotenv may log during import)
    const { logger } = await import("../../src/utils/logger.js");

    // Spy AFTER import to avoid dotenv noise
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const error = new Error("test error");
    logger.error("test message", error);

    // Called once for the message and once for the stack
    expect(consoleSpy).toHaveBeenCalledTimes(2);

    consoleSpy.mockRestore();
  });
});
