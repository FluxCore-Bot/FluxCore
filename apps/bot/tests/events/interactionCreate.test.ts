import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the config module
vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    guildId: undefined,
    logLevel: "info",
  },
}));

// Mock cooldown system (subpath import used by the event)
const mockIsOnCooldown = vi.fn().mockReturnValue({ onCooldown: false, remainingMs: 0 });
const mockSetCooldown = vi.fn();
vi.mock("@fluxcore/systems/cooldown", () => ({
  isOnCooldown: (...args: unknown[]) => mockIsOnCooldown(...args),
  setCooldown: (...args: unknown[]) => mockSetCooldown(...args),
}));

// Mock local imports that have deep dependency chains
vi.mock("../../src/features/tempvoice/system/interactions.js", () => ({
  handleTempVoiceButton: vi.fn(),
  handleTempVoiceModal: vi.fn(),
  handleTempVoiceUserSelect: vi.fn(),
  handleTempVoiceStringSelect: vi.fn(),
}));
vi.mock("../../src/features/general/commands/actions.js", () => ({
  handleActionsAutocomplete: vi.fn(),
}));

import { Collection } from "discord.js";

function createMockCommand({
  name = "test",
  cooldown,
  execute = vi.fn(),
}: {
  name?: string;
  cooldown?: number;
  execute?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    data: { name },
    execute,
    cooldown,
    category: "Test",
  };
}

function createMockInteraction({
  commandName = "test",
  isChatInput = true,
} = {}) {
  return {
    isAutocomplete: () => false,
    isButton: () => false,
    isModalSubmit: () => false,
    isUserSelectMenu: () => false,
    isStringSelectMenu: () => false,
    isChatInputCommand: () => isChatInput,
    commandName,
    user: { id: "user-123" },
    client: {
      commands: new Collection(),
    },
    reply: vi.fn(),
    followUp: vi.fn(),
    replied: false,
    deferred: false,
  };
}

// We need to test the event handler's execute function
const eventModule = await import("../../src/events/interactionCreate.js");
const event = eventModule.default;

describe("interactionCreate event", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsOnCooldown.mockReturnValue({ onCooldown: false, remainingMs: 0 });
  });

  it("has correct event name", () => {
    expect(event.name).toBe("interactionCreate");
  });

  it("ignores non-chat-input interactions", async () => {
    const interaction = createMockInteraction({ isChatInput: false });
    await event.execute(interaction as never);
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it("returns early for unknown commands", async () => {
    const interaction = createMockInteraction({ commandName: "nonexistent" });
    (interaction.client.commands as Collection<string, unknown>).clear();
    await event.execute(interaction as never);
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it("executes a command successfully", async () => {
    const execute = vi.fn();
    const command = createMockCommand({ execute });
    const interaction = createMockInteraction();
    (interaction.client.commands as Collection<string, unknown>).set(
      "test",
      command,
    );

    await event.execute(interaction as never);
    expect(execute).toHaveBeenCalledWith(interaction);
  });

  it("checks cooldown before executing", async () => {
    mockIsOnCooldown.mockReturnValue({ onCooldown: true, remainingMs: 5000 });

    const execute = vi.fn();
    const command = createMockCommand({ execute, cooldown: 10 });
    const interaction = createMockInteraction();
    (interaction.client.commands as Collection<string, unknown>).set(
      "test",
      command,
    );

    await event.execute(interaction as never);

    expect(mockIsOnCooldown).toHaveBeenCalledWith("test", "user-123");
    expect(execute).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
  });

  it("sets cooldown after successful execution", async () => {
    const execute = vi.fn();
    const command = createMockCommand({ execute, cooldown: 10 });
    const interaction = createMockInteraction();
    (interaction.client.commands as Collection<string, unknown>).set(
      "test",
      command,
    );

    await event.execute(interaction as never);

    expect(mockSetCooldown).toHaveBeenCalledWith("test", "user-123", 10);
  });

  it("does not set cooldown when command has no cooldown", async () => {
    const execute = vi.fn();
    const command = createMockCommand({ execute });
    const interaction = createMockInteraction();
    (interaction.client.commands as Collection<string, unknown>).set(
      "test",
      command,
    );

    await event.execute(interaction as never);

    expect(mockSetCooldown).not.toHaveBeenCalled();
  });

  it("catches command errors and sends error reply", async () => {
    const execute = vi.fn().mockRejectedValue(new Error("test error"));
    const command = createMockCommand({ execute });
    const interaction = createMockInteraction();
    (interaction.client.commands as Collection<string, unknown>).set(
      "test",
      command,
    );

    await event.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
  });

  it("uses followUp when interaction already replied", async () => {
    const execute = vi.fn().mockRejectedValue(new Error("test error"));
    const command = createMockCommand({ execute });
    const interaction = createMockInteraction();
    interaction.replied = true;
    (interaction.client.commands as Collection<string, unknown>).set(
      "test",
      command,
    );

    await event.execute(interaction as never);

    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it("handles error when error reply itself fails", async () => {
    const execute = vi.fn().mockRejectedValue(new Error("command error"));
    const command = createMockCommand({ execute });
    const interaction = createMockInteraction();
    interaction.reply = vi.fn().mockRejectedValue(new Error("reply error"));
    (interaction.client.commands as Collection<string, unknown>).set(
      "test",
      command,
    );

    // Should not throw -- the inner try/catch should handle it
    await expect(event.execute(interaction as never)).resolves.not.toThrow();
  });
});
