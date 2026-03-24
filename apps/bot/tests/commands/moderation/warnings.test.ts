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

const mockGetWarnings = vi.fn().mockResolvedValue({
  warnings: [
    { id: 1, moderatorId: "mod-1", reason: "Spamming", createdAt: new Date() },
    { id: 2, moderatorId: "mod-2", reason: "Toxicity", createdAt: new Date() },
  ],
  total: 2,
});
vi.mock("@fluxcore/systems/warnings/persistence", () => ({
  getWarnings: (...args: unknown[]) => mockGetWarnings(...args),
}));

vi.mock("@fluxcore/systems/warnings/constants", () => ({
  WARNINGS_PER_PAGE: 10,
}));

const warningsModule = await import("../../../src/commands/moderation/warnings.js");
const command = warningsModule.default;

function createMockInteraction() {
  const message = {
    createMessageComponentCollector: vi.fn().mockReturnValue({
      on: vi.fn(),
    }),
  };
  return {
    options: {
      getUser: vi.fn().mockReturnValue({ id: "user-123", displayName: "TestUser" }),
    },
    user: { id: "actor-123" },
    guildId: "guild-789",
    reply: vi.fn(),
    deferReply: vi.fn(),
    editReply: vi.fn().mockResolvedValue(message),
  };
}

describe("warnings command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckPermissions.mockResolvedValue(true);
    mockGetWarnings.mockResolvedValue({
      warnings: [
        { id: 1, moderatorId: "mod-1", reason: "Spamming", createdAt: new Date() },
      ],
      total: 1,
    });
  });

  it("has correct command metadata", () => {
    expect(command.data.name).toBe("warnings");
    expect(command.category).toBe("Moderation");
    expect(command.cooldown).toBe(3);
  });

  it("displays warnings for a user", async () => {
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(mockGetWarnings).toHaveBeenCalledWith("guild-789", "user-123", 1, 10);
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it("returns early when user lacks permissions", async () => {
    mockCheckPermissions.mockResolvedValueOnce(false);
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(interaction.deferReply).not.toHaveBeenCalled();
    expect(mockGetWarnings).not.toHaveBeenCalled();
  });

  it("shows empty state when no warnings exist", async () => {
    mockGetWarnings.mockResolvedValueOnce({ warnings: [], total: 0 });
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(interaction.editReply).toHaveBeenCalled();
    // No pagination buttons when single page
    const call = interaction.editReply.mock.calls[0]?.[0] as { components: unknown[] };
    expect(call.components).toHaveLength(0);
  });
});
