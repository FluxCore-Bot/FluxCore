import { describe, it, expect, vi } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    guildId: undefined,
    logLevel: "info",
  },
}));

vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { resolveChannelName } = await import(
  "../../../src/features/tempvoice/system/manager"
);

describe("resolveChannelName", () => {
  it("replaces every {user} occurrence, matching the dashboard preview", () => {
    expect(resolveChannelName("{user} & {user}", "Ahmad")).toBe("Ahmad & Ahmad");
  });

  it("falls back to the default template when empty", () => {
    expect(resolveChannelName("", "Ahmad")).toBe("Ahmad's Channel");
  });
});
