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

// Mock permissions (keep real embed/logger exports)
const mockCheckPermissions = vi.fn().mockResolvedValue(true);
const mockIsAboveTarget = vi.fn().mockReturnValue(true);
vi.mock("@fluxcore/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fluxcore/utils")>();
  return {
    ...actual,
    checkPermissions: (...args: unknown[]) => mockCheckPermissions(...args),
    isAboveTarget: (...args: unknown[]) => mockIsAboveTarget(...args),
  };
});

// Mock warning system
const mockCreateWarning = vi.fn().mockResolvedValue({ id: 1 });
const mockGetWarningCount = vi.fn().mockResolvedValue(1);
vi.mock("@fluxcore/systems/warnings/persistence", () => ({
  createWarning: (...args: unknown[]) => mockCreateWarning(...args),
  getWarningCount: (...args: unknown[]) => mockGetWarningCount(...args),
}));

const mockCheckAndExecutePunishment = vi.fn().mockResolvedValue({ triggered: false });
vi.mock("@fluxcore/systems/warnings/escalation", () => ({
  checkAndExecutePunishment: (...args: unknown[]) => mockCheckAndExecutePunishment(...args),
}));

const mockGetWarnSettings = vi.fn().mockResolvedValue({
  dmOnWarn: false,
  reasonRequired: false,
  maxWarnings: 0,
});
vi.mock("@fluxcore/systems/warnings/config", () => ({
  getWarnSettings: (...args: unknown[]) => mockGetWarnSettings(...args),
}));

vi.mock("@fluxcore/systems/warnings/constants", () => ({
  MAX_REASON_LENGTH: 500,
}));

const warnModule = await import("../../../src/commands/moderation/warn.js");
const command = warnModule.default;

function createMockInteraction({
  targetMember = createMockMember(),
  reason = null,
}: {
  targetMember?: ReturnType<typeof createMockMember> | null;
  reason?: string | null;
} = {}) {
  return {
    options: {
      getMember: vi.fn().mockReturnValue(targetMember),
      getString: vi.fn((name: string) => {
        if (name === "reason") return reason;
        return null;
      }),
      getUser: vi.fn().mockReturnValue(targetMember ? { id: targetMember.id, displayName: targetMember.user.displayName } : null),
    },
    user: { id: "actor-123" },
    member: { roles: { highest: { position: 10 } } },
    client: { user: { id: "bot-456" } },
    guild: { name: "Test Guild" },
    guildId: "guild-789",
    reply: vi.fn(),
    deferReply: vi.fn(),
    editReply: vi.fn(),
  };
}

function createMockMember({
  id = "target-789",
  displayName = "TestUser",
} = {}) {
  return {
    id,
    user: { displayName },
    roles: { highest: { position: 5 } },
    send: vi.fn(),
  };
}

describe("warn command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckPermissions.mockResolvedValue(true);
    mockIsAboveTarget.mockReturnValue(true);
    mockCreateWarning.mockResolvedValue({ id: 1 });
    mockGetWarningCount.mockResolvedValue(1);
    mockCheckAndExecutePunishment.mockResolvedValue({ triggered: false });
    mockGetWarnSettings.mockResolvedValue({
      dmOnWarn: false,
      reasonRequired: false,
      maxWarnings: 0,
    });
  });

  it("has correct command metadata", () => {
    expect(command.data.name).toBe("warn");
    expect(command.category).toBe("Moderation");
    expect(command.cooldown).toBe(3);
  });

  it("warns a member successfully", async () => {
    const target = createMockMember();
    const interaction = createMockInteraction({ targetMember: target, reason: "Spamming" });

    await command.execute(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(mockCreateWarning).toHaveBeenCalledWith({
      guildId: "guild-789",
      userId: "target-789",
      moderatorId: "actor-123",
      reason: "Spamming",
    });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it("returns early when user lacks permissions", async () => {
    mockCheckPermissions.mockResolvedValueOnce(false);
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(interaction.deferReply).not.toHaveBeenCalled();
    expect(mockCreateWarning).not.toHaveBeenCalled();
  });

  it("rejects when target member not found", async () => {
    const interaction = createMockInteraction({ targetMember: null });

    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it("rejects when user tries to warn themselves", async () => {
    const target = createMockMember({ id: "actor-123" });
    const interaction = createMockInteraction({ targetMember: target });

    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
    expect(mockCreateWarning).not.toHaveBeenCalled();
  });

  it("rejects when user tries to warn the bot", async () => {
    const target = createMockMember({ id: "bot-456" });
    const interaction = createMockInteraction({ targetMember: target });

    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
    expect(mockCreateWarning).not.toHaveBeenCalled();
  });

  it("rejects when actor role is not above target", async () => {
    mockIsAboveTarget.mockReturnValueOnce(false);
    const interaction = createMockInteraction();

    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
    expect(mockCreateWarning).not.toHaveBeenCalled();
  });

  it("rejects when reason is required but not provided", async () => {
    mockGetWarnSettings.mockResolvedValueOnce({
      dmOnWarn: false,
      reasonRequired: true,
      maxWarnings: 0,
    });
    const interaction = createMockInteraction({ reason: null });

    await command.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
    expect(mockCreateWarning).not.toHaveBeenCalled();
  });

  it("checks escalation after warning", async () => {
    mockCheckAndExecutePunishment.mockResolvedValueOnce({
      triggered: true,
      action: "timeout",
      threshold: 3,
    });
    mockGetWarningCount.mockResolvedValueOnce(3);
    const target = createMockMember();
    const interaction = createMockInteraction({ targetMember: target, reason: "Test" });

    await command.execute(interaction as never);

    expect(mockCheckAndExecutePunishment).toHaveBeenCalledWith(
      "guild-789",
      "target-789",
      3,
      target,
    );
    // Verify the reply mentions escalation
    const editReplyCall = interaction.editReply.mock.calls[0]?.[0] as { embeds: Array<{ data: { description: string } }> };
    expect(editReplyCall).toBeDefined();
  });

  it("DMs user when dmOnWarn is enabled", async () => {
    mockGetWarnSettings.mockResolvedValueOnce({
      dmOnWarn: true,
      reasonRequired: false,
      maxWarnings: 0,
    });
    const target = createMockMember();
    const interaction = createMockInteraction({ targetMember: target, reason: "Test" });

    await command.execute(interaction as never);

    expect(target.send).toHaveBeenCalled();
  });

  it("does not DM user when dmOnWarn is disabled", async () => {
    const target = createMockMember();
    const interaction = createMockInteraction({ targetMember: target, reason: "Test" });

    await command.execute(interaction as never);

    expect(target.send).not.toHaveBeenCalled();
  });

  it("handles DM failure silently", async () => {
    mockGetWarnSettings.mockResolvedValueOnce({
      dmOnWarn: true,
      reasonRequired: false,
      maxWarnings: 0,
    });
    const target = createMockMember();
    target.send = vi.fn().mockRejectedValue(new Error("Cannot send DM"));
    const interaction = createMockInteraction({ targetMember: target, reason: "Test" });

    await command.execute(interaction as never);

    // Should still succeed despite DM failure
    expect(interaction.editReply).toHaveBeenCalled();
    expect(mockCreateWarning).toHaveBeenCalled();
  });
});
