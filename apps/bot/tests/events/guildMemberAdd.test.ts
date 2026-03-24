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

const mockGetLogConfig = vi.fn().mockResolvedValue(null);
vi.mock("@fluxcore/systems/logging/config", () => ({
  getLogConfig: (...args: unknown[]) => mockGetLogConfig(...args),
}));

const mockCreateLogEntry = vi.fn().mockResolvedValue(undefined);
vi.mock("@fluxcore/systems/logging/persistence", () => ({
  createLogEntry: (...args: unknown[]) => mockCreateLogEntry(...args),
}));

const mockSendLogEmbed = vi.fn().mockResolvedValue(undefined);
vi.mock("@fluxcore/systems/logging/sender", () => ({
  sendLogEmbed: (...args: unknown[]) => mockSendLogEmbed(...args),
}));

const mockFormatMemberJoin = vi.fn().mockReturnValue({ data: {} });
vi.mock("@fluxcore/systems/logging/formatter", () => ({
  formatMemberJoin: (...args: unknown[]) => mockFormatMemberJoin(...args),
}));

const guildMemberAddModule = await import("../../src/events/guildMemberAdd.js");
const event = guildMemberAddModule.default;

function createMockMember({
  id = "user-1",
  isBot = false,
  guildId = "guild-1",
  memberCount = 100,
} = {}) {
  return {
    id,
    user: {
      id,
      bot: isBot,
      tag: "User#0001",
      createdTimestamp: Date.now() - 365 * 24 * 60 * 60 * 1000,
      displayAvatarURL: () => "https://example.com/avatar.png",
    },
    guild: { id: guildId, memberCount },
  };
}

describe("guildMemberAdd event", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has correct event metadata", () => {
    expect(event.name).toBe("guildMemberAdd");
  });

  it("skips when member is a bot", async () => {
    const member = createMockMember({ isBot: true });
    await event.execute(member as never);

    expect(mockGetLogConfig).not.toHaveBeenCalled();
    expect(mockSendLogEmbed).not.toHaveBeenCalled();
  });

  it("skips when logging is disabled", async () => {
    mockGetLogConfig.mockResolvedValueOnce(null);
    const member = createMockMember();
    await event.execute(member as never);

    expect(mockGetLogConfig).toHaveBeenCalledWith("guild-1", "member");
    expect(mockSendLogEmbed).not.toHaveBeenCalled();
  });

  it("skips when config is not enabled", async () => {
    mockGetLogConfig.mockResolvedValueOnce({ enabled: false, channelId: "log-ch" });
    const member = createMockMember();
    await event.execute(member as never);

    expect(mockSendLogEmbed).not.toHaveBeenCalled();
  });

  it("sends embed and persists log entry on valid event", async () => {
    mockGetLogConfig.mockResolvedValueOnce({
      enabled: true,
      channelId: "log-ch",
      ignoredChannels: [],
      ignoredRoles: [],
    });
    const member = createMockMember();
    await event.execute(member as never);

    expect(mockFormatMemberJoin).toHaveBeenCalledWith(member);
    expect(mockSendLogEmbed).toHaveBeenCalledWith(
      member.guild,
      "log-ch",
      expect.anything(),
    );
    expect(mockCreateLogEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        guildId: "guild-1",
        category: "member",
        eventType: "memberJoin",
        targetId: "user-1",
      }),
    );
  });

  it("includes account age in log entry content", async () => {
    mockGetLogConfig.mockResolvedValueOnce({
      enabled: true,
      channelId: "log-ch",
      ignoredChannels: [],
      ignoredRoles: [],
    });
    const member = createMockMember();
    await event.execute(member as never);

    const logEntryCall = mockCreateLogEntry.mock.calls[0][0];
    expect(logEntryCall.content).toHaveProperty("accountAgeDays");
    expect(logEntryCall.content.accountAgeDays).toBeGreaterThan(0);
    expect(logEntryCall.content).toHaveProperty("memberCount", 100);
  });
});
