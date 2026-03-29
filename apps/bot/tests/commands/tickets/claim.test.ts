import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    guildId: undefined,
    logLevel: "info",
  },
}));

vi.mock("@fluxcore/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fluxcore/utils")>();
  return {
    ...actual,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
});

const mockGetTicketByChannel = vi.fn().mockResolvedValue(null);
const mockClaimTicket = vi.fn().mockResolvedValue({});
vi.mock("@fluxcore/systems/tickets/persistence", () => ({
  getTicketByChannel: (...args: unknown[]) => mockGetTicketByChannel(...args),
  claimTicket: (...args: unknown[]) => mockClaimTicket(...args),
}));

const mockGetTicketSettings = vi.fn().mockResolvedValue({
  guildId: "guild-1",
  staffRoleIds: [],
  transcriptChannelId: null,
  maxOpenPerUser: 3,
  autoCloseHours: 0,
  namingFormat: "ticket-{number}",
  ticketCounter: 0,
});
vi.mock("@fluxcore/systems/tickets/config", () => ({
  getTicketSettings: (...args: unknown[]) => mockGetTicketSettings(...args),
}));

const claimModule = await import("../../../src/commands/tickets/claim.js");
const command = claimModule.default;

function createMockInteraction({
  channelId = "channel-1",
  guildId = "guild-1" as string | null,
  memberRoles = new Map<string, unknown>(),
} = {}) {
  return {
    options: {},
    user: { id: "user-1", displayName: "TestUser" },
    guildId,
    guild: { name: "Test Guild" },
    channelId,
    member: {
      roles: { cache: memberRoles },
    },
    reply: vi.fn(),
    deferReply: vi.fn(),
    editReply: vi.fn(),
    replied: false,
    deferred: false,
  };
}

describe("ticket-claim command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTicketByChannel.mockResolvedValue(null);
  });

  it("has correct command metadata", () => {
    expect(command.data.name).toBe("ticket-claim");
    expect(command.category).toBe("Tickets");
  });

  it("rejects when used outside a guild", async () => {
    const interaction = createMockInteraction({ guildId: null });
    await command.execute(interaction as never);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
  });

  it("rejects when channel is not a ticket", async () => {
    mockGetTicketByChannel.mockResolvedValueOnce(null);
    const interaction = createMockInteraction();
    await command.execute(interaction as never);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
  });

  it("rejects when ticket is already closed", async () => {
    mockGetTicketByChannel.mockResolvedValueOnce({
      id: 1,
      status: "closed",
      channelId: "channel-1",
    });
    const interaction = createMockInteraction();
    await command.execute(interaction as never);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
  });

  it("rejects when ticket is already claimed", async () => {
    mockGetTicketByChannel.mockResolvedValueOnce({
      id: 1,
      status: "claimed",
      channelId: "channel-1",
      claimedBy: "other-user",
    });
    const interaction = createMockInteraction();
    await command.execute(interaction as never);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
  });

  it("claims ticket when staff has permission", async () => {
    mockGetTicketByChannel.mockResolvedValueOnce({
      id: 1,
      status: "open",
      channelId: "channel-1",
      claimedBy: null,
    });
    mockClaimTicket.mockResolvedValueOnce({ id: 1, status: "claimed", claimedBy: "user-1" });

    const interaction = createMockInteraction();
    await command.execute(interaction as never);

    expect(mockClaimTicket).toHaveBeenCalledWith(1, "user-1");
    expect(interaction.reply).toHaveBeenCalled();
  });

  it("rejects when user is not staff", async () => {
    mockGetTicketByChannel.mockResolvedValueOnce({
      id: 1,
      status: "open",
      channelId: "channel-1",
      claimedBy: null,
    });
    mockGetTicketSettings.mockResolvedValueOnce({
      guildId: "guild-1",
      staffRoleIds: ["staff-role-1"],
      transcriptChannelId: null,
      maxOpenPerUser: 3,
      autoCloseHours: 0,
      namingFormat: "ticket-{number}",
      ticketCounter: 0,
    });

    const interaction = createMockInteraction({ memberRoles: new Map() });
    await command.execute(interaction as never);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
    expect(mockClaimTicket).not.toHaveBeenCalled();
  });
});
