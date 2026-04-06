import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    guildId: undefined,
    logLevel: "info",
  },
}));

const mockCreateReminder = vi.fn().mockResolvedValue(undefined);
vi.mock("@fluxcore/systems", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fluxcore/systems")>();
  return {
    ...actual,
    createReminder: (...args: unknown[]) => mockCreateReminder(...args),
  };
});

const remindModule = await import("../../../../src/features/utility/commands/remind.js");
const command = remindModule.default;

function createMockInteraction({
  duration = "10m",
  message = "Test reminder",
} = {}) {
  return {
    user: { id: "user-123" },
    channelId: "channel-456",
    guildId: "guild-789",
    options: {
      getString: vi.fn((name: string) => {
        if (name === "duration") return duration;
        if (name === "message") return message;
        return null;
      }),
    },
    reply: vi.fn(),
  };
}

describe("remind command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateReminder.mockResolvedValue(undefined);
  });

  it("has correct command metadata", () => {
    expect(command.data.name).toBe("remind");
    expect(command.category).toBe("Utility");
    expect(command.cooldown).toBe(10);
  });

  it("creates a reminder successfully", async () => {
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(mockCreateReminder).toHaveBeenCalledWith(
      "user-123",
      "Test reminder",
      600_000,
      "channel-456",
      "guild-789",
    );
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Reminder Set",
            }),
          }),
        ]),
      }),
    );
  });

  it("rejects invalid duration", async () => {
    const interaction = createMockInteraction({ duration: "invalid" });

    await command.execute(interaction as never);

    expect(mockCreateReminder).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
  });

  it("rejects duration exceeding 7 days", async () => {
    const interaction = createMockInteraction({ duration: "8d" });

    await command.execute(interaction as never);

    expect(mockCreateReminder).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        ephemeral: true,
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Error",
            }),
          }),
        ]),
      }),
    );
  });

  it("handles createReminder failure gracefully", async () => {
    mockCreateReminder.mockRejectedValueOnce(new Error("DB error"));
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        ephemeral: true,
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Error",
            }),
          }),
        ]),
      }),
    );
  });
});
