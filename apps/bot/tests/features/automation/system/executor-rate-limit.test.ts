import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    guildId: undefined,
    logLevel: "info",
  },
}));

vi.mock("@fluxcore/utils", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { getRulesForEventMock, executorMock, logExecutionMock } = vi.hoisted(
  () => ({
    getRulesForEventMock: vi.fn(),
    executorMock: vi.fn().mockResolvedValue(undefined),
    logExecutionMock: vi.fn().mockResolvedValue(undefined),
  }),
);

vi.mock("@fluxcore/systems/actions/cache", () => ({
  getRulesForEvent: (...args: unknown[]) => getRulesForEventMock(...args),
}));

vi.mock("@fluxcore/systems/actions/config", () => ({
  getGuildSettingsOrDefault: () => ({
    globalEnabled: true,
    maxRules: 25,
    logChannelId: null,
  }),
}));

vi.mock("@fluxcore/systems/actions/persistence", () => ({
  logExecution: (...args: unknown[]) => logExecutionMock(...args),
}));

vi.mock("../../../../src/features/automation/system/registry.js", () => ({
  getExecutor: () => executorMock,
}));

import type { Client } from "discord.js";

const { processEvent } = await import(
  "../../../../src/features/automation/system/executor.js"
);

type TestEventContext = {
  eventType: string;
  guildId: string;
  timestamp: string;
};

const fakeClient = {} as Client;

function makeRule(eventType: string, id = 1) {
  return {
    id,
    guildId: "g-rl",
    name: `r-${eventType}-${id}`,
    enabled: true,
    eventType,
    actions: [{ type: "addRole", roleId: "r" }],
    conditions: {},
    priority: 0,
    createdBy: "u",
  };
}

function ctx(guildId: string, eventType: string): TestEventContext {
  return {
    eventType,
    guildId,
    timestamp: new Date().toISOString(),
  };
}

describe("processEvent rate limiting", () => {
  beforeEach(() => {
    executorMock.mockClear();
    getRulesForEventMock.mockReset();
    logExecutionMock.mockClear();
  });

  it("does not let one event type starve another", async () => {
    const guildId = `guild-starve-${Date.now()}`;
    getRulesForEventMock.mockImplementation((_g: string, ev: string) => [
      makeRule(ev),
    ]);

    // Burn through the messageCreate budget
    for (let i = 0; i < 80; i++) {
      await processEvent(fakeClient, ctx(guildId, "messageCreated") as never);
    }

    const messageCreateExecCount = executorMock.mock.calls.length;
    expect(messageCreateExecCount).toBeLessThanOrEqual(60);
    expect(messageCreateExecCount).toBeGreaterThan(0);

    // Now memberJoin must still be allowed: separate bucket
    executorMock.mockClear();
    await processEvent(fakeClient, ctx(guildId, "memberJoin") as never);

    expect(executorMock).toHaveBeenCalledTimes(1);
  });

  it("enforces the per-(guild, eventType) cap independently per guild", async () => {
    const a = `guild-a-${Date.now()}`;
    const b = `guild-b-${Date.now()}`;
    getRulesForEventMock.mockImplementation((_g: string, ev: string) => [
      makeRule(ev),
    ]);

    for (let i = 0; i < 70; i++) {
      await processEvent(fakeClient, ctx(a, "messageCreated"));
    }
    const aCount = executorMock.mock.calls.length;
    expect(aCount).toBeLessThanOrEqual(60);

    executorMock.mockClear();
    await processEvent(fakeClient, ctx(b, "messageCreated"));
    expect(executorMock).toHaveBeenCalledTimes(1);
  });
});
