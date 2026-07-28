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

import { ExtendedClient } from "../../../src/shared/client/ExtendedClient.js";
import { Collection, Partials } from "discord.js";

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

  // Without partials, discord.js drops any gateway event whose primary
  // structure is not already cached. The bot only caches messages seen since
  // its last restart, so reactionAdded / reactionRemoved / messageDeleted
  // never reached a handler for an older message — which silently breaks
  // every reaction-role automation attached to a pinned rules message.
  it("enables the partials the reaction and message-delete triggers need", () => {
    const client = new ExtendedClient();

    const partials = client.options.partials ?? [];
    expect(partials).toContain(Partials.Message);
    expect(partials).toContain(Partials.Reaction);
    expect(partials).toContain(Partials.Channel);
    expect(partials).toContain(Partials.User);

    client.destroy();
  });
});