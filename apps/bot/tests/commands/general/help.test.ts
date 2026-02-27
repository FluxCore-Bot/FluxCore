import { describe, it, expect, vi } from "vitest";
import { Collection } from "discord.js";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    guildId: undefined,
    logLevel: "info",
  },
}));

const helpModule = await import("../../../src/commands/general/help.js");
const command = helpModule.default;

function createMockCommand(name: string, description: string, category: string, cooldown?: number) {
  return {
    data: { name, description },
    category,
    cooldown,
    execute: vi.fn(),
  };
}

function createMockInteraction(commands: Collection<string, unknown>) {
  return {
    client: { commands },
    reply: vi.fn(),
  };
}

describe("help command", () => {
  it("has correct command metadata", () => {
    expect(command.data.name).toBe("help");
    expect(command.category).toBe("General");
    expect(command.cooldown).toBe(10);
  });

  it("replies with categorized commands", async () => {
    const commands = new Collection<string, unknown>();
    commands.set("ping", createMockCommand("ping", "Shows latency", "General", 5));
    commands.set("ban", createMockCommand("ban", "Ban a user", "Moderation", 5));

    const interaction = createMockInteraction(commands);
    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({ title: "Commands" }),
          }),
        ]),
      }),
    );
  });

  it("handles empty command list", async () => {
    const commands = new Collection<string, unknown>();
    const interaction = createMockInteraction(commands);

    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalled();
  });

  it("groups commands by category", async () => {
    const commands = new Collection<string, unknown>();
    commands.set("ping", createMockCommand("ping", "Latency", "General"));
    commands.set("help", createMockCommand("help", "Help", "General"));
    commands.set("ban", createMockCommand("ban", "Ban", "Moderation"));

    const interaction = createMockInteraction(commands);
    await command.execute(interaction as never);

    const embed = interaction.reply.mock.calls[0][0].embeds[0];
    const fields = embed.toJSON().fields;
    const fieldNames = fields.map((f: { name: string }) => f.name);
    expect(fieldNames).toContain("General");
    expect(fieldNames).toContain("Moderation");
  });
});