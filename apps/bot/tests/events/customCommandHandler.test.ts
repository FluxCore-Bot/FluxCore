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
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockGetCustomCommands = vi.fn().mockResolvedValue([]);
vi.mock("@fluxcore/systems/customCommands/persistence", () => ({
  getCustomCommands: (...args: unknown[]) => mockGetCustomCommands(...args),
}));

const mockMatchesTrigger = vi.fn().mockReturnValue(false);
const mockIsAllowed = vi.fn().mockReturnValue(true);
vi.mock("@fluxcore/systems/customCommands/matcher", () => ({
  matchesTrigger: (...args: unknown[]) => mockMatchesTrigger(...args),
  isAllowed: (...args: unknown[]) => mockIsAllowed(...args),
}));

const mockExecuteCustomCommand = vi.fn().mockResolvedValue(undefined);
vi.mock("@fluxcore/systems/customCommands/executor", () => ({
  executeCustomCommand: (...args: unknown[]) => mockExecuteCustomCommand(...args),
}));

const mockIsOnCooldown = vi.fn().mockReturnValue({ onCooldown: false, remainingMs: 0 });
const mockSetCooldown = vi.fn();
vi.mock("@fluxcore/systems", () => ({
  isOnCooldown: (...args: unknown[]) => mockIsOnCooldown(...args),
  setCooldown: (...args: unknown[]) => mockSetCooldown(...args),
}));

const eventModule = await import("../../src/events/customCommandHandler.js");
const event = eventModule.default;

function makeCommand(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    guildId: "guild-1",
    name: "hello",
    triggerType: "command",
    response: { type: "text", content: "Hi!" },
    actions: [],
    enabled: true,
    cooldown: 0,
    allowedRoles: [],
    allowedChannels: [],
    deletesTrigger: false,
    dmResponse: false,
    createdBy: "user-1",
    createdAt: new Date(),
    ...overrides,
  };
}

function createMockMessage({
  content = "!hello",
  authorId = "user-1",
  guildId = "guild-1",
  channelId = "ch-1",
  isBot = false,
} = {}) {
  const roleCache = new Map([["role-1", { id: "role-1" }]]);
  return {
    content,
    author: { id: authorId, bot: isBot },
    guild: { id: guildId },
    member: {
      roles: {
        cache: {
          map: (fn: (r: { id: string }) => string) =>
            [...roleCache.values()].map(fn),
        },
      },
    },
    channelId,
    channel: { send: vi.fn() },
  };
}

describe("customCommandHandler event", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has correct event metadata", () => {
    expect(event.name).toBe("messageCreate");
  });

  it("skips when message has no guild", async () => {
    const message = createMockMessage();
    (message as Record<string, unknown>).guild = null;
    await event.execute(message as never);
    expect(mockGetCustomCommands).not.toHaveBeenCalled();
  });

  it("skips when author is a bot", async () => {
    const message = createMockMessage({ isBot: true });
    await event.execute(message as never);
    expect(mockGetCustomCommands).not.toHaveBeenCalled();
  });

  it("skips when no custom commands exist", async () => {
    mockGetCustomCommands.mockResolvedValueOnce([]);
    const message = createMockMessage();
    await event.execute(message as never);
    expect(mockExecuteCustomCommand).not.toHaveBeenCalled();
  });

  it("skips disabled commands", async () => {
    const cmd = makeCommand({ enabled: false });
    mockGetCustomCommands.mockResolvedValueOnce([cmd]);
    const message = createMockMessage();
    await event.execute(message as never);
    expect(mockMatchesTrigger).not.toHaveBeenCalled();
  });

  it("skips when trigger does not match", async () => {
    const cmd = makeCommand();
    mockGetCustomCommands.mockResolvedValueOnce([cmd]);
    mockMatchesTrigger.mockReturnValueOnce(false);
    const message = createMockMessage();
    await event.execute(message as never);
    expect(mockExecuteCustomCommand).not.toHaveBeenCalled();
  });

  it("skips when not allowed (role/channel restriction)", async () => {
    const cmd = makeCommand();
    mockGetCustomCommands.mockResolvedValueOnce([cmd]);
    mockMatchesTrigger.mockReturnValueOnce(true);
    mockIsAllowed.mockReturnValueOnce(false);
    const message = createMockMessage();
    await event.execute(message as never);
    expect(mockExecuteCustomCommand).not.toHaveBeenCalled();
  });

  it("executes command when trigger matches and is allowed", async () => {
    const cmd = makeCommand();
    mockGetCustomCommands.mockResolvedValueOnce([cmd]);
    mockMatchesTrigger.mockReturnValueOnce(true);
    mockIsAllowed.mockReturnValueOnce(true);
    const message = createMockMessage();
    await event.execute(message as never);
    expect(mockExecuteCustomCommand).toHaveBeenCalledWith(cmd, message);
  });

  it("checks cooldown and skips if on cooldown", async () => {
    const cmd = makeCommand({ cooldown: 30 });
    mockGetCustomCommands.mockResolvedValueOnce([cmd]);
    mockMatchesTrigger.mockReturnValueOnce(true);
    mockIsAllowed.mockReturnValueOnce(true);
    mockIsOnCooldown.mockReturnValueOnce({ onCooldown: true, remainingMs: 5000 });
    const message = createMockMessage();
    await event.execute(message as never);
    expect(mockExecuteCustomCommand).not.toHaveBeenCalled();
  });

  it("sets cooldown after executing command with cooldown", async () => {
    const cmd = makeCommand({ cooldown: 30 });
    mockGetCustomCommands.mockResolvedValueOnce([cmd]);
    mockMatchesTrigger.mockReturnValueOnce(true);
    mockIsAllowed.mockReturnValueOnce(true);
    mockIsOnCooldown.mockReturnValueOnce({ onCooldown: false, remainingMs: 0 });
    const message = createMockMessage();
    await event.execute(message as never);
    expect(mockSetCooldown).toHaveBeenCalledWith("cc_1", "user-1", 30);
  });

  it("only executes the first matching command", async () => {
    const cmd1 = makeCommand({ id: 1, name: "hello" });
    const cmd2 = makeCommand({ id: 2, name: "hello2" });
    mockGetCustomCommands.mockResolvedValueOnce([cmd1, cmd2]);
    mockMatchesTrigger.mockReturnValueOnce(true);
    mockIsAllowed.mockReturnValueOnce(true);
    const message = createMockMessage();
    await event.execute(message as never);
    expect(mockExecuteCustomCommand).toHaveBeenCalledTimes(1);
    expect(mockExecuteCustomCommand).toHaveBeenCalledWith(cmd1, message);
  });

  it("handles getCustomCommands errors gracefully", async () => {
    mockGetCustomCommands.mockRejectedValueOnce(new Error("DB error"));
    const message = createMockMessage();
    await event.execute(message as never);
    expect(mockExecuteCustomCommand).not.toHaveBeenCalled();
  });
});
