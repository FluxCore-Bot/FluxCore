import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock config
vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    guildId: undefined,
    logLevel: "info",
  },
}));

// Mock permissions
const mockCheckPermissions = vi.fn().mockResolvedValue(true);
vi.mock("@fluxcore/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fluxcore/utils")>();
  return {
    ...actual,
    checkPermissions: (...args: unknown[]) => mockCheckPermissions(...args),
  };
});

// Mock welcome system
const mockGetWelcomeConfig = vi.fn().mockResolvedValue(null);
vi.mock("@fluxcore/systems/welcome/config", () => ({
  getWelcomeConfig: (...args: unknown[]) => mockGetWelcomeConfig(...args),
}));

const mockBuildWelcomeEmbed = vi.fn().mockReturnValue({ data: {} });
vi.mock("@fluxcore/systems/welcome/builder", () => ({
  buildWelcomeEmbed: (...args: unknown[]) => mockBuildWelcomeEmbed(...args),
}));

const welcomeModule = await import("../../../src/commands/general/welcome.js");
const command = welcomeModule.default;

function createMockInteraction() {
  const mockSend = vi.fn().mockResolvedValue(undefined);
  return {
    options: {
      getSubcommand: vi.fn().mockReturnValue("test"),
    },
    user: { id: "actor-123" },
    member: {
      id: "actor-123",
      user: {
        id: "actor-123",
        tag: "Actor#0001",
        username: "actor",
        displayAvatarURL: () => "https://example.com/avatar.png",
      },
      guild: {
        id: "guild-789",
        name: "Test Guild",
        memberCount: 50,
        iconURL: () => "https://example.com/icon.png",
        channels: {
          cache: new Map([
            ["ch-1", { id: "ch-1", isTextBased: () => true, send: mockSend }],
          ]),
        },
      },
      roles: { highest: { position: 10 } },
    },
    guild: {
      id: "guild-789",
      name: "Test Guild",
      memberCount: 50,
      iconURL: () => "https://example.com/icon.png",
      channels: {
        cache: new Map([
          ["ch-1", { id: "ch-1", isTextBased: () => true, send: mockSend }],
        ]),
      },
    },
    guildId: "guild-789",
    reply: vi.fn(),
    deferReply: vi.fn(),
    editReply: vi.fn(),
    _channelSend: mockSend,
  };
}

describe("welcome command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckPermissions.mockResolvedValue(true);
    mockGetWelcomeConfig.mockResolvedValue(null);
  });

  it("has correct command metadata", () => {
    expect(command.data.name).toBe("welcome");
    expect(command.category).toBe("General");
    expect(command.cooldown).toBe(5);
  });

  it("returns early when user lacks permissions", async () => {
    mockCheckPermissions.mockResolvedValueOnce(false);
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(interaction.deferReply).not.toHaveBeenCalled();
    expect(mockGetWelcomeConfig).not.toHaveBeenCalled();
  });

  it("shows error when welcome is not configured", async () => {
    mockGetWelcomeConfig.mockResolvedValueOnce(null);
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
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

  it("shows error when welcome is not enabled", async () => {
    mockGetWelcomeConfig.mockResolvedValueOnce({
      welcomeEnabled: false,
      welcomeChannelId: "ch-1",
      welcomeMessage: {},
    });
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
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

  it("shows error when no channel is configured", async () => {
    mockGetWelcomeConfig.mockResolvedValueOnce({
      welcomeEnabled: true,
      welcomeChannelId: null,
      welcomeMessage: {},
    });
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "No Channel",
            }),
          }),
        ]),
      }),
    );
  });

  it("shows error when channel does not exist", async () => {
    mockGetWelcomeConfig.mockResolvedValueOnce({
      welcomeEnabled: true,
      welcomeChannelId: "nonexistent-channel",
      welcomeMessage: {},
    });
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Invalid Channel",
            }),
          }),
        ]),
      }),
    );
  });

  it("sends test message on success", async () => {
    mockGetWelcomeConfig.mockResolvedValueOnce({
      welcomeEnabled: true,
      welcomeChannelId: "ch-1",
      welcomeMessage: { title: "Welcome!" },
    });
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(mockBuildWelcomeEmbed).toHaveBeenCalledWith(
      { title: "Welcome!" },
      interaction.member,
    );
    expect(interaction._channelSend).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Test Sent",
            }),
          }),
        ]),
      }),
    );
  });

  it("handles send failure gracefully", async () => {
    mockGetWelcomeConfig.mockResolvedValueOnce({
      welcomeEnabled: true,
      welcomeChannelId: "ch-1",
      welcomeMessage: { title: "Welcome!" },
    });
    const interaction = createMockInteraction();
    interaction._channelSend.mockRejectedValueOnce(new Error("Cannot send"));

    await command.execute(interaction as never);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Test Failed",
            }),
          }),
        ]),
      }),
    );
  });
});
