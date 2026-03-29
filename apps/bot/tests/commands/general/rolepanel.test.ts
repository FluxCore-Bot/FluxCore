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

// Mock persistence
const mockGetRolePanels = vi.fn().mockResolvedValue([]);
const mockGetRolePanelByName = vi.fn().mockResolvedValue(null);
const mockUpdatePanelMessageId = vi.fn().mockResolvedValue(undefined);
vi.mock("@fluxcore/systems/rolePanel/persistence", () => ({
  getRolePanels: (...args: unknown[]) => mockGetRolePanels(...args),
  getRolePanelByName: (...args: unknown[]) => mockGetRolePanelByName(...args),
  updatePanelMessageId: (...args: unknown[]) => mockUpdatePanelMessageId(...args),
}));

// Mock builder
const mockBuildButtonComponents = vi.fn().mockReturnValue([]);
const mockBuildDropdownComponent = vi.fn().mockReturnValue({});
const mockBuildPanelEmbed = vi.fn().mockReturnValue({});
vi.mock("@fluxcore/systems/rolePanel/builder", () => ({
  buildButtonComponents: (...args: unknown[]) => mockBuildButtonComponents(...args),
  buildDropdownComponent: (...args: unknown[]) => mockBuildDropdownComponent(...args),
  buildPanelEmbed: (...args: unknown[]) => mockBuildPanelEmbed(...args),
}));

const rolepanelModule = await import("../../../src/commands/general/rolepanel.js");
const command = rolepanelModule.default;

function createMockPanel(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    guildId: "guild-789",
    channelId: "channel-123",
    messageId: null,
    name: "Test Panel",
    type: "button",
    mode: "toggle",
    embed: "{}",
    roles: [
      { roleId: "role-1", label: "Red", emoji: undefined, description: undefined, style: 2 },
      { roleId: "role-2", label: "Blue", emoji: undefined, description: undefined, style: 1 },
    ],
    maxRoles: null,
    minRoles: null,
    createdBy: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMockInteraction({
  panelName = "Test Panel",
  channel = null,
}: {
  panelName?: string;
  channel?: unknown;
} = {}) {
  const sentMessage = { id: "msg-999", react: vi.fn() };
  const mockChannel = {
    id: "channel-123",
    send: vi.fn().mockResolvedValue(sentMessage),
  };

  return {
    options: {
      getSubcommand: vi.fn().mockReturnValue("send"),
      getString: vi.fn((name: string) => {
        if (name === "panel_name") return panelName;
        return null;
      }),
      getChannel: vi.fn().mockReturnValue(channel),
    },
    user: { id: "actor-123" },
    member: { roles: { highest: { position: 10 } } },
    client: { user: { id: "bot-456" } },
    guild: {
      name: "Test Guild",
      channels: { cache: new Map([["channel-123", mockChannel]]) },
    },
    guildId: "guild-789",
    reply: vi.fn(),
    deferReply: vi.fn(),
    editReply: vi.fn(),
  };
}

describe("rolepanel command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckPermissions.mockResolvedValue(true);
  });

  it("has correct command metadata", () => {
    expect(command.data.name).toBe("rolepanel");
    expect(command.category).toBe("General");
    expect(command.cooldown).toBe(5);
  });

  it("returns early when user lacks permissions", async () => {
    mockCheckPermissions.mockResolvedValueOnce(false);
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(interaction.deferReply).not.toHaveBeenCalled();
    expect(mockGetRolePanelByName).not.toHaveBeenCalled();
  });

  it("sends a button panel successfully", async () => {
    const panel = createMockPanel();
    mockGetRolePanelByName.mockResolvedValueOnce(panel);

    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(mockGetRolePanelByName).toHaveBeenCalledWith("guild-789", "Test Panel");
    expect(mockBuildPanelEmbed).toHaveBeenCalledWith(panel);
    expect(mockBuildButtonComponents).toHaveBeenCalledWith(panel);
    expect(mockUpdatePanelMessageId).toHaveBeenCalledWith(1, "msg-999");
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it("replies with error when panel not found", async () => {
    mockGetRolePanelByName.mockResolvedValueOnce(null);
    const interaction = createMockInteraction({ panelName: "Nonexistent" });

    await command.execute(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Panel Not Found",
            }),
          }),
        ]),
      }),
    );
  });

  it("replies with error when panel has no roles", async () => {
    const panel = createMockPanel({ roles: [] });
    mockGetRolePanelByName.mockResolvedValueOnce(panel);
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "No Roles",
            }),
          }),
        ]),
      }),
    );
  });

  it("replies with error when target channel not found", async () => {
    const panel = createMockPanel({ channelId: "nonexistent-channel" });
    mockGetRolePanelByName.mockResolvedValueOnce(panel);
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Channel Not Found",
            }),
          }),
        ]),
      }),
    );
  });

  it("uses channel override when provided", async () => {
    const panel = createMockPanel();
    mockGetRolePanelByName.mockResolvedValueOnce(panel);

    const overrideChannel = {
      id: "channel-123",
      send: vi.fn().mockResolvedValue({ id: "msg-override" }),
    };

    const interaction = createMockInteraction({ channel: { id: "channel-123" } });
    // The override channel id matches what's in the guild cache
    interaction.guild.channels.cache.set("channel-123", overrideChannel as never);

    await command.execute(interaction as never);

    expect(mockUpdatePanelMessageId).toHaveBeenCalledWith(1, "msg-override");
  });

  it("sends dropdown panel with dropdown component", async () => {
    const panel = createMockPanel({ type: "dropdown" });
    mockGetRolePanelByName.mockResolvedValueOnce(panel);
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(mockBuildDropdownComponent).toHaveBeenCalledWith(panel);
    expect(mockBuildButtonComponents).not.toHaveBeenCalled();
  });

  it("adds reactions for reaction-type panels", async () => {
    const panel = createMockPanel({
      type: "reaction",
      roles: [
        { roleId: "role-1", label: "Red", emoji: "red_circle" },
        { roleId: "role-2", label: "Blue", emoji: "blue_circle" },
      ],
    });
    mockGetRolePanelByName.mockResolvedValueOnce(panel);

    const sentMessage = { id: "msg-react", react: vi.fn() };
    const mockChannel = {
      id: "channel-123",
      send: vi.fn().mockResolvedValue(sentMessage),
    };
    const interaction = createMockInteraction();
    interaction.guild.channels.cache.set("channel-123", mockChannel as never);

    await command.execute(interaction as never);

    expect(sentMessage.react).toHaveBeenCalledTimes(2);
    expect(sentMessage.react).toHaveBeenCalledWith("red_circle");
    expect(sentMessage.react).toHaveBeenCalledWith("blue_circle");
  });
});
