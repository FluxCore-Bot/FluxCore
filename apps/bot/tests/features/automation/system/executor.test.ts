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
vi.mock("../../../../src/features/automation/system/registry.js", () => ({
  getExecutor: vi.fn((type: string) => {
    if (type === "sendMessage") return mockSendMessageExecutor;
    if (type === "unknownAction") return null;
    return mockSendMessageExecutor;
  }),
}));

const { processEvent } = await import(
  "../../../../src/features/automation/system/executor.js"
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

/**
 * Filters used to be guarded on the presence of their own datum
 * (`conditions.excludeRoleIds?.length && context.member`), so a filter the
 * event context could not answer was skipped rather than failed. The rule then
 * fired on exactly the users and channels it had been configured to skip, while
 * the dashboard showed the filter as active. Every case below is a rule that
 * must NOT fire.
 */
describe("action executor - filters fail closed", () => {
  const memberlessContext = {
    eventType: "memberBanned" as const,
    guildId: "guild-123",
    guildName: "Test Guild",
    userId: "user-456",
    userName: "TestUser",
    userTag: "TestUser#0001",
    userMention: "<@user-456>",
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
  });

  function ruleWith(conditions: Record<string, string[]>) {
    return [
      { name: "filtered", enabled: true, conditions, actions: [{ type: "sendMessage" }] },
    ];
  }

  it("does not fire an exclude-role filter when the event carries no member", async () => {
    mockGetRulesForEvent.mockReturnValueOnce(ruleWith({ excludeRoleIds: ["staff"] }));

    await processEvent({} as never, memberlessContext);

    expect(mockSendMessageExecutor).not.toHaveBeenCalled();
  });

  it("does not fire an include-role filter when the event carries no member", async () => {
    mockGetRulesForEvent.mockReturnValueOnce(ruleWith({ roleIds: ["verified"] }));

    await processEvent({} as never, memberlessContext);

    expect(mockSendMessageExecutor).not.toHaveBeenCalled();
  });

  it("does not fire a channel filter when the event carries no channel", async () => {
    mockGetRulesForEvent.mockReturnValueOnce(ruleWith({ channelIds: ["general"] }));

    await processEvent({} as never, memberlessContext);

    expect(mockSendMessageExecutor).not.toHaveBeenCalled();
  });

  it("does not fire an exclude-channel filter when the event carries no channel", async () => {
    mockGetRulesForEvent.mockReturnValueOnce(ruleWith({ excludeChannelIds: ["general"] }));

    await processEvent({} as never, memberlessContext);

    expect(mockSendMessageExecutor).not.toHaveBeenCalled();
  });

  it("does not fire a user filter when the event carries no user", async () => {
    mockGetRulesForEvent.mockReturnValueOnce(ruleWith({ userIds: ["someone"] }));

    await processEvent({} as never, {
      eventType: "channelCreated" as const,
      guildId: "guild-123",
      guildName: "Test Guild",
      channelId: "channel-789",
      memberCount: 100,
      timestamp: new Date().toISOString(),
    });

    expect(mockSendMessageExecutor).not.toHaveBeenCalled();
  });

  it("still fires when the filter is satisfiable and matches", async () => {
    const withMember = {
      ...memberlessContext,
      member: { roles: { cache: new Map([["verified", {}]]) } },
    };
    mockGetRulesForEvent.mockReturnValueOnce(ruleWith({ roleIds: ["verified"] }));

    await processEvent({} as never, withMember as never);

    expect(mockSendMessageExecutor).toHaveBeenCalled();
  });

  it("still skips when the filter is satisfiable and does not match", async () => {
    const withMember = {
      ...memberlessContext,
      member: { roles: { cache: new Map([["other", {}]]) } },
    };
    mockGetRulesForEvent.mockReturnValueOnce(ruleWith({ roleIds: ["verified"] }));

    await processEvent({} as never, withMember as never);

    expect(mockSendMessageExecutor).not.toHaveBeenCalled();
  });

  it("leaves unfiltered rules alone", async () => {
    mockGetRulesForEvent.mockReturnValueOnce(ruleWith({}));

    await processEvent({} as never, memberlessContext);

    expect(mockSendMessageExecutor).toHaveBeenCalled();
  });
});

describe("action executor - the log tells the truth", () => {
  const ctx = {
    eventType: "memberJoin" as const,
    guildId: "guild-123",
    guildName: "Test Guild",
    userId: "user-456",
    memberCount: 100,
    timestamp: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGuildSettingsOrDefault.mockReturnValue({ globalEnabled: true, maxRules: 25 });
  });

  // The step-mode branch warned about an unknown action type and then fell
  // through to the success log, so a rule referencing a removed action type
  // reported a clean 100% success rate forever.
  it("does not log success for an unknown action type in step mode", async () => {
    mockGetRulesForEvent.mockReturnValueOnce([
      {
        name: "unknown-step",
        enabled: true,
        conditions: {},
        actions: [],
        entryStepId: "s0",
        steps: [{ id: "s0", type: "action", action: { type: "unknownAction" }, next: null }],
      },
    ]);

    await processEvent({} as never, ctx);

    expect(mockLogExecution).not.toHaveBeenCalledWith(
      expect.anything(), expect.anything(), true, expect.anything(),
    );
  });

  it("logs a failure for an unknown action type in step mode", async () => {
    mockGetRulesForEvent.mockReturnValueOnce([
      {
        name: "unknown-step",
        enabled: true,
        conditions: {},
        actions: [],
        entryStepId: "s0",
        steps: [{ id: "s0", type: "action", action: { type: "unknownAction" }, next: null }],
      },
    ]);

    await processEvent({} as never, ctx);

    expect(mockLogExecution).toHaveBeenCalledWith(
      expect.anything(), "unknownAction", false, expect.stringMatching(/unknown action type/i),
    );
  });
});

/**
 * Condition steps read `getContextValue(condition.field)` and bail when it is
 * undefined — BEFORE looking at the operator. hasRole/notHasRole do not consume
 * the field at all, so the canonical "if member has @Verified" branch always
 * took the else path on memberJoin (whose context has no channelId, the
 * default field).
 */
describe("action executor - role operators ignore the unrelated field", () => {
  const memberWithRole = {
    eventType: "memberJoin" as const,
    guildId: "guild-123",
    guildName: "Test Guild",
    userId: "user-456",
    memberCount: 100,
    timestamp: new Date().toISOString(),
    member: { roles: { cache: new Map([["verified", {}]]) } },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGuildSettingsOrDefault.mockReturnValue({ globalEnabled: true, maxRules: 25 });
  });

  function branchRule(operator: string) {
    return [
      {
        name: "branch",
        enabled: true,
        conditions: {},
        actions: [],
        entryStepId: "cond",
        steps: [
          {
            id: "cond",
            type: "condition",
            // channelId is the default field and memberJoin never populates it.
            condition: { field: "channelId", operator, value: "verified" },
            thenNext: "yes",
            elseNext: null,
          },
          { id: "yes", type: "action", action: { type: "sendMessage" }, next: null },
        ],
      },
    ];
  }

  it("takes the then-branch when the member has the role", async () => {
    mockGetRulesForEvent.mockReturnValueOnce(branchRule("hasRole"));

    await processEvent({} as never, memberWithRole as never);

    expect(mockSendMessageExecutor).toHaveBeenCalled();
  });

  it("takes the else-branch when the member lacks the role", async () => {
    mockGetRulesForEvent.mockReturnValueOnce(branchRule("hasRole"));

    await processEvent({} as never, {
      ...memberWithRole,
      member: { roles: { cache: new Map() } },
    } as never);

    expect(mockSendMessageExecutor).not.toHaveBeenCalled();
  });

  it("notHasRole takes the then-branch when the member lacks the role", async () => {
    mockGetRulesForEvent.mockReturnValueOnce(branchRule("notHasRole"));

    await processEvent({} as never, {
      ...memberWithRole,
      member: { roles: { cache: new Map() } },
    } as never);

    expect(mockSendMessageExecutor).toHaveBeenCalled();
  });
});
