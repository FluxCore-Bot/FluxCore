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

const mockDeleteWarning = vi.fn().mockResolvedValue(undefined);
const mockDeleteAllWarnings = vi.fn().mockResolvedValue(5);
const mockGetWarningById = vi.fn().mockResolvedValue({
  id: 1,
  guildId: "guild-789",
  userId: "user-123",
  moderatorId: "mod-1",
  reason: "Test",
  createdAt: new Date(),
});
vi.mock("@fluxcore/systems/warnings/persistence", () => ({
  deleteWarning: (...args: unknown[]) => mockDeleteWarning(...args),
  deleteAllWarnings: (...args: unknown[]) => mockDeleteAllWarnings(...args),
  getWarningById: (...args: unknown[]) => mockGetWarningById(...args),
}));

const clearwarningsModule = await import("../../../../src/features/moderation/commands/clearwarnings.js");
const command = clearwarningsModule.default;

function createMockInteraction({
  warningId = null,
}: {
  warningId?: number | null;
} = {}) {
  return {
    options: {
      getUser: vi.fn().mockReturnValue({ id: "user-123", displayName: "TestUser" }),
      getInteger: vi.fn((name: string) => {
        if (name === "id") return warningId;
        return null;
      }),
    },
    user: { id: "actor-123" },
    guildId: "guild-789",
    reply: vi.fn(),
    deferReply: vi.fn(),
    editReply: vi.fn(),
  };
}

describe("clearwarnings command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckPermissions.mockResolvedValue(true);
    mockDeleteAllWarnings.mockResolvedValue(5);
    mockGetWarningById.mockResolvedValue({
      id: 1,
      guildId: "guild-789",
      userId: "user-123",
      moderatorId: "mod-1",
      reason: "Test",
      createdAt: new Date(),
    });
  });

  it("has correct command metadata", () => {
    expect(command.data.name).toBe("clearwarnings");
    expect(command.category).toBe("Moderation");
    expect(command.cooldown).toBe(3);
  });

  it("clears all warnings for a user", async () => {
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(mockDeleteAllWarnings).toHaveBeenCalledWith("guild-789", "user-123");
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it("deletes a specific warning by ID", async () => {
    const interaction = createMockInteraction({ warningId: 1 });

    await command.execute(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(mockGetWarningById).toHaveBeenCalledWith(1, "guild-789");
    expect(mockDeleteWarning).toHaveBeenCalledWith(1, "guild-789");
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it("rejects when specific warning not found", async () => {
    mockGetWarningById.mockResolvedValueOnce(null);
    const interaction = createMockInteraction({ warningId: 999 });

    await command.execute(interaction as never);

    expect(mockDeleteWarning).not.toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it("rejects when warning belongs to different user", async () => {
    mockGetWarningById.mockResolvedValueOnce({
      id: 1,
      guildId: "guild-789",
      userId: "other-user",
      moderatorId: "mod-1",
      reason: "Test",
      createdAt: new Date(),
    });
    const interaction = createMockInteraction({ warningId: 1 });

    await command.execute(interaction as never);

    expect(mockDeleteWarning).not.toHaveBeenCalled();
  });

  it("returns early when user lacks permissions", async () => {
    mockCheckPermissions.mockResolvedValueOnce(false);
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it("handles no warnings to clear", async () => {
    mockDeleteAllWarnings.mockResolvedValueOnce(0);
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(interaction.editReply).toHaveBeenCalled();
  });
});
