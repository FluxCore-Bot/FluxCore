import { describe, it, expect, vi } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    guildId: undefined,
    logLevel: "info",
  },
}));

const pingModule = await import("../../../../src/features/general/commands/ping.js");
const command = pingModule.default;

function createMockInteraction() {
  const sent = {
    createdTimestamp: Date.now() + 50,
  };
  return {
    createdTimestamp: Date.now(),
    client: { ws: { ping: 42 } },
    reply: vi.fn().mockResolvedValue(sent),
    editReply: vi.fn(),
  };
}

describe("ping command", () => {
  it("has correct command metadata", () => {
    expect(command.data.name).toBe("ping");
    expect(command.category).toBe("General");
    expect(command.cooldown).toBe(5);
  });

  it("replies with pinging message then edits with latency", async () => {
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ fetchReply: true }),
    );
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({ title: "Pong!" }),
          }),
        ]),
      }),
    );
  });
});