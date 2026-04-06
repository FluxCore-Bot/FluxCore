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
vi.mock("@fluxcore/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fluxcore/utils")>();
  return {
    ...actual,
    checkPermissions: (...args: unknown[]) => mockCheckPermissions(...args),
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
});

const mockCreateGiveaway = vi.fn().mockResolvedValue({
  id: 1,
  guildId: "guild-789",
  channelId: "channel-123",
  messageId: null,
  hostId: "actor-123",
  prize: "Test Prize",
  winners: 1,
  endsAt: new Date(Date.now() + 3600000),
  ended: false,
  winnerIds: [],
  entrantIds: [],
  requiredRoleIds: [],
  createdAt: new Date(),
});
const mockGetGiveaway = vi.fn();
const mockGetActiveGiveaways = vi.fn().mockResolvedValue([]);
const mockEndGiveaway = vi.fn();
const mockGetActiveGiveawayCount = vi.fn().mockResolvedValue(0);
const mockSetGiveawayMessageId = vi.fn().mockResolvedValue(undefined);
vi.mock("@fluxcore/systems/giveaways/persistence", () => ({
  createGiveaway: (...args: unknown[]) => mockCreateGiveaway(...args),
  getGiveaway: (...args: unknown[]) => mockGetGiveaway(...args),
  getActiveGiveaways: (...args: unknown[]) => mockGetActiveGiveaways(...args),
  endGiveaway: (...args: unknown[]) => mockEndGiveaway(...args),
  getActiveGiveawayCount: (...args: unknown[]) => mockGetActiveGiveawayCount(...args),
  setGiveawayMessageId: (...args: unknown[]) => mockSetGiveawayMessageId(...args),
}));

const mockSelectWinners = vi.fn().mockReturnValue(["winner-1"]);
const mockRerollWinners = vi.fn().mockReturnValue(["winner-2"]);
vi.mock("@fluxcore/systems/giveaways/winner", () => ({
  selectWinners: (...args: unknown[]) => mockSelectWinners(...args),
  rerollWinners: (...args: unknown[]) => mockRerollWinners(...args),
}));

vi.mock("@fluxcore/systems/giveaways/embed", () => ({
  buildGiveawayEmbed: vi.fn().mockReturnValue({ toJSON: () => ({}) }),
  buildEndedGiveawayEmbed: vi.fn().mockReturnValue({ toJSON: () => ({}) }),
  buildGiveawayButton: vi.fn().mockReturnValue({ toJSON: () => ({}) }),
}));

vi.mock("@fluxcore/systems/giveaways/constants", () => ({
  MAX_WINNERS: 20,
  MAX_PRIZE_LENGTH: 256,
  MAX_ACTIVE_GIVEAWAYS: 25,
  GIVEAWAY_BUTTON_PREFIX: "gw_enter_",
}));

const giveawayModule = await import("../../../../src/features/giveaways/commands/giveaway.js");
const command = giveawayModule.default;

function createMockInteraction({
  subcommand = "list",
  prize = "Test Prize",
  duration = "1h",
  winners = 1,
  id = 1,
}: {
  subcommand?: string;
  prize?: string;
  duration?: string;
  winners?: number;
  id?: number;
} = {}) {
  const mockSend = vi.fn().mockResolvedValue({ id: "msg-123" });
  return {
    options: {
      getSubcommand: vi.fn().mockReturnValue(subcommand),
      getString: vi.fn((name: string) => {
        if (name === "prize") return prize;
        if (name === "duration") return duration;
        return null;
      }),
      getInteger: vi.fn((name: string) => {
        if (name === "winners") return winners;
        if (name === "id") return id;
        return null;
      }),
      getRole: vi.fn().mockReturnValue(null),
    },
    user: { id: "actor-123" },
    member: { permissions: { has: vi.fn().mockReturnValue(true) } },
    guildId: "guild-789",
    channelId: "channel-123",
    channel: { send: mockSend },
    guild: {
      name: "Test Guild",
      channels: {
        cache: {
          get: vi.fn().mockReturnValue({
            send: mockSend,
            messages: { fetch: vi.fn().mockResolvedValue({ edit: vi.fn() }) },
          }),
        },
      },
    },
    reply: vi.fn(),
    deferReply: vi.fn(),
    editReply: vi.fn(),
  };
}

describe("giveaway command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckPermissions.mockResolvedValue(true);
    mockGetActiveGiveawayCount.mockResolvedValue(0);
  });

  it("has correct command metadata", () => {
    expect(command.data.name).toBe("giveaway");
    expect(command.category).toBe("Giveaways");
  });

  it("returns early when user lacks permissions", async () => {
    mockCheckPermissions.mockResolvedValueOnce(false);
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it("rejects when used outside a guild", async () => {
    const interaction = createMockInteraction();
    (interaction as Record<string, unknown>).guildId = null;

    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
  });

  describe("start subcommand", () => {
    it("creates a giveaway successfully", async () => {
      const interaction = createMockInteraction({
        subcommand: "start",
        prize: "Nitro",
        duration: "1h",
        winners: 2,
      });

      await command.execute(interaction as never);

      expect(interaction.deferReply).toHaveBeenCalled();
      expect(mockCreateGiveaway).toHaveBeenCalledWith(
        expect.objectContaining({
          guildId: "guild-789",
          prize: "Nitro",
          winners: 2,
        }),
      );
      expect(interaction.editReply).toHaveBeenCalled();
    });

    it("rejects invalid duration format", async () => {
      const interaction = createMockInteraction({
        subcommand: "start",
        duration: "invalid",
      });

      await command.execute(interaction as never);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ ephemeral: true }),
      );
      expect(mockCreateGiveaway).not.toHaveBeenCalled();
    });

    it("rejects when max active giveaways reached", async () => {
      mockGetActiveGiveawayCount.mockResolvedValueOnce(25);
      const interaction = createMockInteraction({
        subcommand: "start",
        duration: "1h",
      });

      await command.execute(interaction as never);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ ephemeral: true }),
      );
      expect(mockCreateGiveaway).not.toHaveBeenCalled();
    });
  });

  describe("end subcommand", () => {
    it("ends a giveaway successfully", async () => {
      mockGetGiveaway.mockResolvedValueOnce({
        id: 1,
        guildId: "guild-789",
        channelId: "channel-123",
        messageId: "msg-123",
        ended: false,
        prize: "Test",
        entrantIds: ["user-1"],
        winnerIds: [],
        requiredRoleIds: [],
        winners: 1,
      });
      mockEndGiveaway.mockResolvedValueOnce({
        id: 1,
        ended: true,
        winnerIds: ["winner-1"],
        entrantIds: ["user-1"],
        prize: "Test",
      });

      const interaction = createMockInteraction({ subcommand: "end", id: 1 });
      await command.execute(interaction as never);

      expect(mockSelectWinners).toHaveBeenCalled();
      expect(mockEndGiveaway).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalled();
    });

    it("returns error for non-existent giveaway", async () => {
      mockGetGiveaway.mockResolvedValueOnce(null);

      const interaction = createMockInteraction({ subcommand: "end", id: 999 });
      await command.execute(interaction as never);

      expect(interaction.editReply).toHaveBeenCalled();
      expect(mockEndGiveaway).not.toHaveBeenCalled();
    });

    it("returns warning for already ended giveaway", async () => {
      mockGetGiveaway.mockResolvedValueOnce({
        id: 1,
        ended: true,
      });

      const interaction = createMockInteraction({ subcommand: "end", id: 1 });
      await command.execute(interaction as never);

      expect(interaction.editReply).toHaveBeenCalled();
      expect(mockEndGiveaway).not.toHaveBeenCalled();
    });
  });

  describe("reroll subcommand", () => {
    it("rerolls a giveaway successfully", async () => {
      mockGetGiveaway.mockResolvedValueOnce({
        id: 1,
        guildId: "guild-789",
        channelId: "channel-123",
        messageId: "msg-123",
        ended: true,
        prize: "Test",
        entrantIds: ["user-1", "user-2"],
        winnerIds: ["user-1"],
        requiredRoleIds: [],
        winners: 1,
      });
      mockEndGiveaway.mockResolvedValueOnce({
        id: 1,
        ended: true,
        winnerIds: ["winner-2"],
        entrantIds: ["user-1", "user-2"],
        prize: "Test",
      });

      const interaction = createMockInteraction({ subcommand: "reroll", id: 1 });
      await command.execute(interaction as never);

      expect(mockRerollWinners).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalled();
    });

    it("returns error when giveaway not ended", async () => {
      mockGetGiveaway.mockResolvedValueOnce({
        id: 1,
        ended: false,
      });

      const interaction = createMockInteraction({ subcommand: "reroll", id: 1 });
      await command.execute(interaction as never);

      expect(interaction.editReply).toHaveBeenCalled();
      expect(mockRerollWinners).not.toHaveBeenCalled();
    });
  });

  describe("list subcommand", () => {
    it("lists active giveaways", async () => {
      mockGetActiveGiveaways.mockResolvedValueOnce([
        {
          id: 1,
          prize: "Nitro",
          winners: 1,
          endsAt: new Date(Date.now() + 3600000),
          entrantIds: ["u1", "u2"],
        },
      ]);

      const interaction = createMockInteraction({ subcommand: "list" });
      await command.execute(interaction as never);

      expect(interaction.editReply).toHaveBeenCalled();
    });

    it("shows message when no active giveaways", async () => {
      mockGetActiveGiveaways.mockResolvedValueOnce([]);

      const interaction = createMockInteraction({ subcommand: "list" });
      await command.execute(interaction as never);

      expect(interaction.editReply).toHaveBeenCalled();
    });
  });
});
