import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: { token: "t", clientId: "c", guildId: undefined, logLevel: "info" },
}));

vi.mock("@fluxcore/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fluxcore/utils")>();
  return {
    ...actual,
    checkPermissions: vi.fn().mockResolvedValue(true),
  };
});

const mockCreateRule = vi.fn();
const mockGetRuleByName = vi.fn().mockResolvedValue(null);
const mockCountRules = vi.fn().mockResolvedValue(0);
vi.mock("@fluxcore/systems/actions/persistence", () => ({
  createRule: (...a: unknown[]) => mockCreateRule(...a),
  updateRule: vi.fn(),
  deleteRule: vi.fn(),
  getRuleByName: (...a: unknown[]) => mockGetRuleByName(...a),
  countRules: (...a: unknown[]) => mockCountRules(...a),
  getRecentLogs: vi.fn(),
  notifyCacheInvalidation: vi.fn(),
}));

vi.mock("@fluxcore/systems/actions/cache", () => ({
  addRuleToCache: vi.fn(),
  removeRuleFromCache: vi.fn(),
  updateRuleInCache: vi.fn(),
  getRulesForGuild: vi.fn().mockReturnValue([]),
}));

vi.mock("@fluxcore/systems/actions/config", () => ({
  getGuildSettingsOrDefault: vi.fn().mockReturnValue({
    maxRules: 25,
    globalEnabled: true,
    logChannelId: null,
  }),
  setGuildSettings: vi.fn(),
}));

const command = (
  await import("../../../../src/features/general/commands/actions.js")
).default;

function mkInteraction(name: string) {
  const replies: unknown[] = [];
  return {
    options: {
      getSubcommand: () => "create",
      getString: (k: string, _req?: boolean) => {
        if (k === "name") return name;
        if (k === "event") return "memberJoin";
        if (k === "action-type") return "sendMessage";
        return null;
      },
      getInteger: () => null,
      getBoolean: () => null,
      getChannel: () => null,
      getRole: () => null,
    },
    user: { id: "u1" },
    guildId: "g1",
    replies,
    reply: (payload: unknown) => {
      replies.push(payload);
      return Promise.resolve();
    },
  } as never;
}

describe("/actions create — name validation", () => {
  beforeEach(() => {
    mockCreateRule.mockReset();
    mockGetRuleByName.mockResolvedValue(null);
    mockCountRules.mockResolvedValue(0);
  });

  it("rejects @everyone", async () => {
    const ix = mkInteraction("@everyone");
    await command.execute(ix);
    expect(mockCreateRule).not.toHaveBeenCalled();
    const reply = (ix as { replies: unknown[] }).replies[0];
    expect(JSON.stringify(reply)).toMatch(/Invalid Name/);
  });

  it("rejects backticks", async () => {
    const ix = mkInteraction("`evil`");
    await command.execute(ix);
    expect(mockCreateRule).not.toHaveBeenCalled();
  });

  it("rejects zero-width chars", async () => {
    const ix = mkInteraction("hi\u200Bthere");
    await command.execute(ix);
    expect(mockCreateRule).not.toHaveBeenCalled();
  });

  it("accepts a normal name", async () => {
    mockCreateRule.mockResolvedValue({
      id: 1,
      guildId: "g1",
      name: "welcome_rule",
      enabled: true,
      eventType: "memberJoin",
      actions: [],
      conditions: {},
      priority: 0,
      createdBy: "u1",
    });
    const ix = mkInteraction("welcome_rule");
    await command.execute(ix);
    expect(mockCreateRule).toHaveBeenCalledTimes(1);
  });
});
