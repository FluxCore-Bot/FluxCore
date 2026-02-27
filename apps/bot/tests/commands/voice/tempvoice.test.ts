import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    guildId: undefined,
    logLevel: "info",
  },
}));

const mockCheckPermissions = vi.fn().mockResolvedValue(true);
const mockCheckBotPermissions = vi.fn().mockResolvedValue(true);
vi.mock("@fluxcore/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fluxcore/utils")>();
  return {
    ...actual,
    checkPermissions: (...args: unknown[]) => mockCheckPermissions(...args),
    checkBotPermissions: (...args: unknown[]) =>
      mockCheckBotPermissions(...args),
  };
});

const mockSetGuildConfig = vi.fn().mockResolvedValue(undefined);
const mockRemoveGuildConfig = vi.fn().mockResolvedValue(true);
const mockGetGuildConfig = vi.fn().mockReturnValue(null);
vi.mock("@fluxcore/systems/tempVoice/config", () => ({
  setGuildConfig: (...args: unknown[]) => mockSetGuildConfig(...args),
  removeGuildConfig: (...args: unknown[]) => mockRemoveGuildConfig(...args),
  getGuildConfig: (...args: unknown[]) => mockGetGuildConfig(...args),
}));

vi.mock("@fluxcore/systems/tempVoice/constants", () => ({
  DEFAULT_NAME_TEMPLATE: "{user}'s Channel",
}));

const tempvoiceModule = await import(
  "../../../src/commands/voice/tempvoice.js"
);
const command = tempvoiceModule.default;

function createMockInteraction({
  subcommand = "setup",
  channel = { id: "channel-123", parentId: "category-456" },
  nameTemplate = null as string | null,
} = {}) {
  return {
    guildId: "guild-789",
    options: {
      getSubcommand: vi.fn().mockReturnValue(subcommand),
      getChannel: vi.fn().mockReturnValue(channel),
      getString: vi.fn().mockReturnValue(nameTemplate),
    },
    reply: vi.fn(),
  };
}

describe("tempvoice command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckPermissions.mockResolvedValue(true);
    mockCheckBotPermissions.mockResolvedValue(true);
    mockGetGuildConfig.mockReturnValue(null);
    mockRemoveGuildConfig.mockResolvedValue(true);
  });

  it("has correct command metadata", () => {
    expect(command.data.name).toBe("tempvoice");
    expect(command.category).toBe("Voice");
    expect(command.cooldown).toBe(5);
  });

  // Setup subcommand
  it("sets up a temp voice hub successfully", async () => {
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(mockSetGuildConfig).toHaveBeenCalledWith("guild-789", {
      hubChannelId: "channel-123",
      categoryId: "category-456",
      nameTemplate: "{user}'s Channel",
    });
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        ephemeral: true,
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Temp Voice Configured",
            }),
          }),
        ]),
      }),
    );
  });

  it("uses custom name template when provided", async () => {
    const interaction = createMockInteraction({ nameTemplate: "{user}'s Room" });

    await command.execute(interaction as never);

    expect(mockSetGuildConfig).toHaveBeenCalledWith("guild-789", {
      hubChannelId: "channel-123",
      categoryId: "category-456",
      nameTemplate: "{user}'s Room",
    });
  });

  it("returns early on setup when user lacks permissions", async () => {
    mockCheckPermissions.mockResolvedValueOnce(false);
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(mockSetGuildConfig).not.toHaveBeenCalled();
  });

  it("returns early on setup when bot lacks permissions", async () => {
    mockCheckBotPermissions.mockResolvedValueOnce(false);
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(mockSetGuildConfig).not.toHaveBeenCalled();
  });

  // Remove subcommand
  it("removes temp voice config successfully", async () => {
    const interaction = createMockInteraction({ subcommand: "remove" });

    await command.execute(interaction as never);

    expect(mockRemoveGuildConfig).toHaveBeenCalledWith("guild-789");
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Configuration Removed",
            }),
          }),
        ]),
      }),
    );
  });

  it("handles remove when no config exists", async () => {
    mockRemoveGuildConfig.mockResolvedValueOnce(false);
    const interaction = createMockInteraction({ subcommand: "remove" });

    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        ephemeral: true,
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Not Configured",
            }),
          }),
        ]),
      }),
    );
  });

  // Status subcommand
  it("shows status when configured", async () => {
    mockGetGuildConfig.mockReturnValueOnce({
      hubChannelId: "channel-123",
      nameTemplate: "{user}'s Channel",
      categoryId: "category-456",
    });
    const interaction = createMockInteraction({ subcommand: "status" });

    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        ephemeral: true,
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Temp Voice Status",
            }),
          }),
        ]),
      }),
    );
  });

  it("shows not configured status when no config", async () => {
    const interaction = createMockInteraction({ subcommand: "status" });

    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        ephemeral: true,
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Not Configured",
            }),
          }),
        ]),
      }),
    );
  });
});
