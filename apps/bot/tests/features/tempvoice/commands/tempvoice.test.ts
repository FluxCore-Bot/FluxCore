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

const mockAddGuildConfig = vi.fn().mockResolvedValue({
  id: 1,
  hubChannelId: "channel-123",
  categoryId: "category-456",
  nameTemplate: "{user}'s Channel",
});
const mockRemoveGuildConfig = vi.fn().mockResolvedValue(true);
const mockGetGuildConfigs = vi.fn().mockReturnValue([]);
const mockGetConfigByHubChannel = vi.fn().mockReturnValue(undefined);
vi.mock("@fluxcore/systems/tempVoice/config", () => ({
  addGuildConfig: (...args: unknown[]) => mockAddGuildConfig(...args),
  removeGuildConfig: (...args: unknown[]) => mockRemoveGuildConfig(...args),
  getGuildConfigs: (...args: unknown[]) => mockGetGuildConfigs(...args),
  getConfigByHubChannel: (...args: unknown[]) =>
    mockGetConfigByHubChannel(...args),
}));

vi.mock("@fluxcore/systems/tempVoice/constants", () => ({
  DEFAULT_NAME_TEMPLATE: "{user}'s Channel",
  MAX_TEMPVOICE_CONFIGS_PER_GUILD: 10,
}));

const tempvoiceModule = await import(
  "../../../../src/features/tempvoice/commands/tempvoice.js"
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
    mockGetGuildConfigs.mockReturnValue([]);
    mockGetConfigByHubChannel.mockReturnValue(undefined);
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

    expect(mockAddGuildConfig).toHaveBeenCalledWith("guild-789", {
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

    expect(mockAddGuildConfig).toHaveBeenCalledWith("guild-789", {
      hubChannelId: "channel-123",
      categoryId: "category-456",
      nameTemplate: "{user}'s Room",
    });
  });

  it("returns early on setup when user lacks permissions", async () => {
    mockCheckPermissions.mockResolvedValueOnce(false);
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(mockAddGuildConfig).not.toHaveBeenCalled();
  });

  it("returns early on setup when bot lacks permissions", async () => {
    mockCheckBotPermissions.mockResolvedValueOnce(false);
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(mockAddGuildConfig).not.toHaveBeenCalled();
  });

  it("rejects setup when hub channel is already configured", async () => {
    mockGetConfigByHubChannel.mockReturnValueOnce({
      id: 1,
      hubChannelId: "channel-123",
      categoryId: "category-456",
      nameTemplate: "{user}'s Channel",
    });
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(mockAddGuildConfig).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        ephemeral: true,
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Already Configured",
            }),
          }),
        ]),
      }),
    );
  });

  it("rejects setup when config limit reached", async () => {
    mockGetGuildConfigs.mockReturnValueOnce(
      Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        hubChannelId: `hub-${i}`,
        categoryId: null,
        nameTemplate: "{user}'s Channel",
      })),
    );
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(mockAddGuildConfig).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        ephemeral: true,
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Limit Reached",
            }),
          }),
        ]),
      }),
    );
  });

  // Remove subcommand
  it("removes temp voice config successfully", async () => {
    mockGetConfigByHubChannel.mockReturnValueOnce({
      id: 1,
      hubChannelId: "channel-123",
      categoryId: "category-456",
      nameTemplate: "{user}'s Channel",
    });
    const interaction = createMockInteraction({ subcommand: "remove" });

    await command.execute(interaction as never);

    expect(mockRemoveGuildConfig).toHaveBeenCalledWith("guild-789", 1);
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

  it("handles remove when channel is not a hub", async () => {
    mockGetConfigByHubChannel.mockReturnValueOnce(undefined);
    const interaction = createMockInteraction({ subcommand: "remove" });

    await command.execute(interaction as never);

    expect(mockRemoveGuildConfig).not.toHaveBeenCalled();
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

  // List subcommand
  it("shows config list when configs exist", async () => {
    mockGetGuildConfigs.mockReturnValueOnce([
      {
        id: 1,
        hubChannelId: "channel-123",
        nameTemplate: "{user}'s Channel",
        categoryId: "category-456",
      },
      {
        id: 2,
        hubChannelId: "channel-456",
        nameTemplate: "{user}'s Room",
        categoryId: null,
      },
    ]);
    const interaction = createMockInteraction({ subcommand: "list" });

    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        ephemeral: true,
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Temp Voice Configurations (2)",
            }),
          }),
        ]),
      }),
    );
  });

  it("shows no configurations message when empty", async () => {
    mockGetGuildConfigs.mockReturnValueOnce([]);
    const interaction = createMockInteraction({ subcommand: "list" });

    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        ephemeral: true,
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "No Configurations",
            }),
          }),
        ]),
      }),
    );
  });
});
