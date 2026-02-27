import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    guildId: undefined,
    logLevel: "info",
  },
}));

const mockGetGuildSettingsOrDefault = vi.fn().mockReturnValue({
  globalEnabled: true,
  maxRules: 25,
  logChannelId: null,
});
vi.mock("@fluxcore/systems/actions/config", () => ({
  getGuildSettingsOrDefault: (...args: unknown[]) =>
    mockGetGuildSettingsOrDefault(...args),
}));

const mockGetRulesForEvent = vi.fn().mockReturnValue([]);
vi.mock("@fluxcore/systems/actions/cache", () => ({
  getRulesForEvent: (...args: unknown[]) => mockGetRulesForEvent(...args),
}));

const mockLogExecution = vi.fn().mockResolvedValue(undefined);
vi.mock("@fluxcore/systems/actions/persistence", () => ({
  logExecution: (...args: unknown[]) => mockLogExecution(...args),
}));

const mockSendMessageExecutor = vi.fn().mockResolvedValue(undefined);
vi.mock("../../src/systems/actions/registry.js", () => ({
  getExecutor: vi.fn((type: string) => {
    if (type === "sendMessage") return mockSendMessageExecutor;
    if (type === "unknownAction") return null;
    return mockSendMessageExecutor;
  }),
}));

const { processEvent } = await import(
  "../../src/systems/actions/executor.js"
);

describe("action executor - processEvent", () => {
  const baseContext = {
    eventType: "memberJoin" as const,
    guildId: "guild-123",
    guildName: "Test Guild",
    userId: "user-456",
    userName: "TestUser",
    userTag: "TestUser#0001",
    userMention: "<@user-456>",
    channelId: "channel-789",
    memberCount: 100,
    timestamp: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGuildSettingsOrDefault.mockReturnValue({
      globalEnabled: true,
      maxRules: 25,
      logChannelId: null,
    });
    mockGetRulesForEvent.mockReturnValue([]);
  });

  it("does nothing when global actions are disabled", async () => {
    mockGetGuildSettingsOrDefault.mockReturnValueOnce({
      globalEnabled: false,
    });

    await processEvent({} as never, baseContext);

    expect(mockGetRulesForEvent).not.toHaveBeenCalled();
  });

  it("does nothing when no rules match the event", async () => {
    mockGetRulesForEvent.mockReturnValueOnce([]);

    await processEvent({} as never, baseContext);

    expect(mockSendMessageExecutor).not.toHaveBeenCalled();
  });

  it("executes matching enabled rules", async () => {
    mockGetRulesForEvent.mockReturnValueOnce([
      {
        name: "welcome-rule",
        enabled: true,
        eventType: "memberJoin",
        conditions: {},
        actions: [{ type: "sendMessage", channelId: "ch-1", message: "Welcome!" }],
      },
    ]);

    await processEvent({} as never, baseContext);

    expect(mockSendMessageExecutor).toHaveBeenCalled();
  });

  it("skips disabled rules", async () => {
    mockGetRulesForEvent.mockReturnValueOnce([
      {
        name: "disabled-rule",
        enabled: false,
        conditions: {},
        actions: [{ type: "sendMessage" }],
      },
    ]);

    await processEvent({} as never, baseContext);

    expect(mockSendMessageExecutor).not.toHaveBeenCalled();
  });

  it("respects channel conditions (include filter)", async () => {
    mockGetRulesForEvent.mockReturnValueOnce([
      {
        name: "channel-filter",
        enabled: true,
        conditions: { channelIds: ["other-channel"] },
        actions: [{ type: "sendMessage" }],
      },
    ]);

    await processEvent({} as never, baseContext);

    expect(mockSendMessageExecutor).not.toHaveBeenCalled();
  });

  it("respects user conditions (include filter)", async () => {
    mockGetRulesForEvent.mockReturnValueOnce([
      {
        name: "user-filter",
        enabled: true,
        conditions: { userIds: ["other-user"] },
        actions: [{ type: "sendMessage" }],
      },
    ]);

    await processEvent({} as never, baseContext);

    expect(mockSendMessageExecutor).not.toHaveBeenCalled();
  });

  it("respects exclude channel conditions", async () => {
    mockGetRulesForEvent.mockReturnValueOnce([
      {
        name: "exclude-channel",
        enabled: true,
        conditions: { excludeChannelIds: ["channel-789"] },
        actions: [{ type: "sendMessage" }],
      },
    ]);

    await processEvent({} as never, baseContext);

    expect(mockSendMessageExecutor).not.toHaveBeenCalled();
  });

  it("respects exclude user conditions", async () => {
    mockGetRulesForEvent.mockReturnValueOnce([
      {
        name: "exclude-user",
        enabled: true,
        conditions: { excludeUserIds: ["user-456"] },
        actions: [{ type: "sendMessage" }],
      },
    ]);

    await processEvent({} as never, baseContext);

    expect(mockSendMessageExecutor).not.toHaveBeenCalled();
  });

  it("handles executor failure and logs error", async () => {
    mockSendMessageExecutor.mockRejectedValueOnce(new Error("Send failed"));
    mockGetRulesForEvent.mockReturnValueOnce([
      {
        name: "failing-rule",
        enabled: true,
        conditions: {},
        actions: [{ type: "sendMessage" }],
      },
    ]);

    // Should not throw
    await expect(processEvent({} as never, baseContext)).resolves.not.toThrow();
    expect(mockLogExecution).toHaveBeenCalledWith(
      expect.anything(),
      "sendMessage",
      false,
      "Send failed",
    );
  });

  it("executes multiple actions in a rule", async () => {
    mockGetRulesForEvent.mockReturnValueOnce([
      {
        name: "multi-action",
        enabled: true,
        conditions: {},
        actions: [
          { type: "sendMessage", message: "Action 1" },
          { type: "sendMessage", message: "Action 2" },
        ],
      },
    ]);

    await processEvent({} as never, baseContext);

    expect(mockSendMessageExecutor).toHaveBeenCalledTimes(2);
  });
});
