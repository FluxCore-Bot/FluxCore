import { describe, it, expect, vi } from "vitest";

// Mock config to avoid needing real env vars
vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    guildId: undefined,
    logLevel: "info",
  },
}));

import { ExtendedClient } from "../../src/client/ExtendedClient.js";
import { Collection } from "discord.js";

describe("ExtendedClient", () => {
  it("instantiates without errors", () => {
    const client = new ExtendedClient();
    expect(client).toBeDefined();
    client.destroy();
  });

  it("has a commands collection", () => {
    const client = new ExtendedClient();
    expect(client.commands).toBeInstanceOf(Collection);
    expect(client.commands.size).toBe(0);
    client.destroy();
  });
});