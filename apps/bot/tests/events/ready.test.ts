import { describe, it, expect, vi, beforeEach } from "vitest";
import { Collection } from "discord.js";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    guildId: undefined,
    logLevel: "info",
  },
}));

const mockAuditPermissions = vi.fn();
vi.mock("../../src/shared/systems/permissionAudit.js", () => ({
  auditPermissions: (...args: unknown[]) => mockAuditPermissions(...args),
}));

const mockLoadTempVoiceConfig = vi.fn().mockResolvedValue(undefined);
const mockGetAllConfiguredGuildIds = vi.fn().mockReturnValue([]);
vi.mock("@fluxcore/systems/tempVoice/config", () => ({
  loadTempVoiceConfig: () => mockLoadTempVoiceConfig(),
  getAllConfiguredGuildIds: () => mockGetAllConfiguredGuildIds(),
}));

const mockReconcileOnStartup = vi.fn().mockResolvedValue(undefined);
vi.mock("../../src/features/tempvoice/system/manager.js", () => ({
  reconcileOnStartup: (...args: unknown[]) => mockReconcileOnStartup(...args),
}));

const mockLoadActionGuildSettings = vi.fn().mockResolvedValue(undefined);
vi.mock("@fluxcore/systems/actions/config", () => ({
  loadActionGuildSettings: () => mockLoadActionGuildSettings(),
  getGuildSettingsOrDefault: vi.fn(),
}));

const mockLoadAllRules = vi.fn().mockResolvedValue(undefined);
vi.mock("@fluxcore/systems/actions/cache", () => ({
  loadAllRules: () => mockLoadAllRules(),
  getRulesForGuild: vi.fn().mockReturnValue([]),
  getRulesForEvent: vi.fn().mockReturnValue([]),
}));

const mockStartCacheSyncPolling = vi.fn().mockResolvedValue(undefined);
vi.mock("@fluxcore/systems/actions/cacheSync", () => ({
  startCacheSyncPolling: () => mockStartCacheSyncPolling(),
  stopCacheSyncPolling: vi.fn(),
}));

const mockRegisterActionEventListeners = vi.fn();
vi.mock("../../src/features/automation/system/eventBridge.js", () => ({
  registerActionEventListeners: (...args: unknown[]) =>
    mockRegisterActionEventListeners(...args),
}));

const mockStartSyncServer = vi.fn();
vi.mock("../../src/features/automation/system/syncServer.js", () => ({
  startSyncServer: () => mockStartSyncServer(),
  stopSyncServer: vi.fn(),
}));

const mockStartReminderPolling = vi.fn();
vi.mock("../../src/shared/systems/reminders.js", () => ({
  startReminderPolling: (...args: unknown[]) =>
    mockStartReminderPolling(...args),
}));

const readyModule = await import("../../src/events/ready.js");
const event = readyModule.default;

function createMockClient({
  guildIds = [] as string[],
} = {}) {
  const guilds = new Collection<string, unknown>();
  for (const id of guildIds) {
    guilds.set(id, { id, name: `Guild ${id}` });
  }
  return {
    user: { displayName: "TestBot" },
    guilds: { cache: guilds },
  };
}

describe("ready event", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has correct event metadata", () => {
    expect(event.name).toBe("ready");
    expect(event.once).toBe(true);
  });

  it("calls auditPermissions on startup", async () => {
    const client = createMockClient();
    await event.execute(client as never);

    expect(mockAuditPermissions).toHaveBeenCalledWith(client);
  });

  it("loads temp voice config and reconciles", async () => {
    mockGetAllConfiguredGuildIds.mockReturnValueOnce(["guild-1"]);
    const client = createMockClient({ guildIds: ["guild-1"] });

    await event.execute(client as never);

    expect(mockLoadTempVoiceConfig).toHaveBeenCalled();
    expect(mockReconcileOnStartup).toHaveBeenCalled();
  });

  it("handles reconcile failure gracefully", async () => {
    mockGetAllConfiguredGuildIds.mockReturnValueOnce(["guild-1"]);
    mockReconcileOnStartup.mockRejectedValueOnce(new Error("Failed"));
    const client = createMockClient({ guildIds: ["guild-1"] });

    // Should not throw
    await expect(event.execute(client as never)).resolves.not.toThrow();
  });

  it("initializes action system", async () => {
    const client = createMockClient();
    await event.execute(client as never);

    expect(mockLoadActionGuildSettings).toHaveBeenCalled();
    expect(mockLoadAllRules).toHaveBeenCalled();
    expect(mockRegisterActionEventListeners).toHaveBeenCalledWith(client);
    expect(mockStartCacheSyncPolling).toHaveBeenCalled();
    expect(mockStartSyncServer).toHaveBeenCalled();
  });

  it("handles action system init failure gracefully", async () => {
    mockLoadActionGuildSettings.mockRejectedValueOnce(new Error("DB error"));
    const client = createMockClient();

    await expect(event.execute(client as never)).resolves.not.toThrow();
  });

  it("starts reminder polling", async () => {
    const client = createMockClient();
    await event.execute(client as never);

    expect(mockStartReminderPolling).toHaveBeenCalledWith(client);
  });
});
