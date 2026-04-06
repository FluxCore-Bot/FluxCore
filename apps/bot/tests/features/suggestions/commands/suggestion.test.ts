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
  };
});

const mockGetSuggestionSettings = vi.fn();
vi.mock("@fluxcore/systems/suggestions/config", () => ({
  getSuggestionSettings: (...args: unknown[]) => mockGetSuggestionSettings(...args),
}));

const mockGetSuggestion = vi.fn();
const mockUpdateSuggestionStatus = vi.fn();
vi.mock("@fluxcore/systems/suggestions/persistence", () => ({
  getSuggestion: (...args: unknown[]) => mockGetSuggestion(...args),
  updateSuggestionStatus: (...args: unknown[]) => mockUpdateSuggestionStatus(...args),
}));

vi.mock("@fluxcore/systems/suggestions/constants", () => ({
  STATUS_COLORS: { pending: 0xffa500, approved: 0x57f287, denied: 0xed4245, implemented: 0x5865f2 },
  STATUS_LABELS: { pending: "Pending", approved: "Approved", denied: "Denied", implemented: "Implemented" },
}));

vi.mock("@fluxcore/systems/suggestions/types", () => ({}));

const suggestionModule = await import("../../../../src/features/suggestions/commands/suggestion.js");
const command = suggestionModule.default;

function createMockInteraction({
  guildId = "guild-123",
  subcommand = "approve",
  suggestionId = 42,
  reason = null as string | null,
}: {
  guildId?: string | null;
  subcommand?: string;
  suggestionId?: number;
  reason?: string | null;
} = {}) {
  const mockEdit = vi.fn();
  const mockFetch = vi.fn().mockResolvedValue({
    edit: mockEdit,
  });

  const mockChannel = {
    id: "channel-789",
    type: 0,
    messages: { fetch: mockFetch },
  };

  const mockUserSend = vi.fn();

  return {
    options: {
      getSubcommand: vi.fn().mockReturnValue(subcommand),
      getInteger: vi.fn().mockReturnValue(suggestionId),
      getString: vi.fn().mockReturnValue(reason),
    },
    user: {
      id: "mod-222",
      displayName: "ModUser",
    },
    guildId,
    guild: {
      name: "Test Guild",
      channels: {
        cache: {
          get: vi.fn().mockReturnValue(mockChannel),
        },
      },
    },
    client: {
      users: {
        fetch: vi.fn().mockResolvedValue({
          send: mockUserSend,
        }),
      },
    },
    member: {
      permissions: {
        has: vi.fn().mockReturnValue(true),
      },
    },
    reply: vi.fn(),
    deferReply: vi.fn(),
    editReply: vi.fn(),
    _mockEdit: mockEdit,
    _mockUserSend: mockUserSend,
  };
}

describe("suggestion command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSuggestionSettings.mockResolvedValue({
      guildId: "guild-123",
      enabled: true,
      channelId: "channel-789",
      dmOnStatusChange: true,
      anonymousMode: false,
    });
    mockGetSuggestion.mockResolvedValue({
      id: 42,
      guildId: "guild-123",
      userId: "user-111",
      messageId: "msg-456",
      content: "Add a music channel",
      status: "pending",
      createdAt: new Date(),
    });
    mockUpdateSuggestionStatus.mockResolvedValue({
      id: 42,
      guildId: "guild-123",
      userId: "user-111",
      status: "approved",
      statusBy: "mod-222",
    });
  });

  it("has correct command metadata", () => {
    expect(command.data.name).toBe("suggestion");
    expect(command.category).toBe("Suggestions");
  });

  it("rejects when used outside a guild", async () => {
    const interaction = createMockInteraction({ guildId: null });
    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it("approves a suggestion on happy path", async () => {
    const interaction = createMockInteraction({ subcommand: "approve", reason: "Great idea" });
    await command.execute(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(mockGetSuggestion).toHaveBeenCalledWith(42, "guild-123");
    expect(mockUpdateSuggestionStatus).toHaveBeenCalledWith(
      42,
      "guild-123",
      "approved",
      "mod-222",
      "Great idea",
    );
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it("denies a suggestion", async () => {
    const interaction = createMockInteraction({ subcommand: "deny", reason: "Not feasible" });
    await command.execute(interaction as never);

    expect(mockUpdateSuggestionStatus).toHaveBeenCalledWith(
      42,
      "guild-123",
      "denied",
      "mod-222",
      "Not feasible",
    );
  });

  it("marks a suggestion as implemented", async () => {
    const interaction = createMockInteraction({ subcommand: "implement" });
    await command.execute(interaction as never);

    expect(mockUpdateSuggestionStatus).toHaveBeenCalledWith(
      42,
      "guild-123",
      "implemented",
      "mod-222",
      undefined,
    );
  });

  it("returns not found for non-existent suggestion", async () => {
    mockGetSuggestion.mockResolvedValueOnce(null);

    const interaction = createMockInteraction();
    await command.execute(interaction as never);

    expect(interaction.editReply).toHaveBeenCalled();
    expect(mockUpdateSuggestionStatus).not.toHaveBeenCalled();
  });

  it("handles errors gracefully", async () => {
    mockGetSuggestion.mockRejectedValueOnce(new Error("DB error"));

    const interaction = createMockInteraction();
    await command.execute(interaction as never);

    expect(interaction.editReply).toHaveBeenCalled();
  });
});
