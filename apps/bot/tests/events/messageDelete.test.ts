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
const mockIsIgnored = vi.fn().mockReturnValue(false);
vi.mock("@fluxcore/systems/logging/config", () => ({
  getLogConfig: (...args: unknown[]) => mockGetLogConfig(...args),
  isIgnored: (...args: unknown[]) => mockIsIgnored(...args),
}));

const mockCreateLogEntry = vi.fn().mockResolvedValue(undefined);
vi.mock("@fluxcore/systems/logging/persistence", () => ({
  createLogEntry: (...args: unknown[]) => mockCreateLogEntry(...args),
}));

const mockSendLogEmbed = vi.fn().mockResolvedValue(undefined);
vi.mock("@fluxcore/systems/logging/sender", () => ({
  sendLogEmbed: (...args: unknown[]) => mockSendLogEmbed(...args),
}));

const mockFormatMessageDelete = vi.fn().mockReturnValue({ data: {} });
vi.mock("@fluxcore/systems/logging/formatter", () => ({
  formatMessageDelete: (...args: unknown[]) => mockFormatMessageDelete(...args),
}));

const messageDeleteModule = await import("../../src/events/messageDelete.js");
const event = messageDeleteModule.default;

function createMockMessage({
  guildId = "guild-1",
  hasGuild = true,
  isBot = false,
  channelId = "channel-1",
  authorId = "user-1",
  content = "test message",
} = {}) {
  return {
    guild: hasGuild ? { id: guildId } : null,
    author: { id: authorId, bot: isBot, tag: "User#0001", displayAvatarURL: () => "https://example.com/avatar.png" },
    channelId,
    id: "msg-1",
    content,
    member: { roles: { cache: new Map() } },
    attachments: new Map(),
  };
}

describe("messageDelete event", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has correct event metadata", () => {
    expect(event.name).toBe("messageDelete");
  });

  it("skips when no guild", async () => {
    const message = createMockMessage({ hasGuild: false });
    await event.execute(message as never);

    expect(mockGetLogConfig).not.toHaveBeenCalled();
    expect(mockSendLogEmbed).not.toHaveBeenCalled();
  });

  it("skips when author is bot", async () => {
    const message = createMockMessage({ isBot: true });
    await event.execute(message as never);

    expect(mockGetLogConfig).not.toHaveBeenCalled();
    expect(mockSendLogEmbed).not.toHaveBeenCalled();
  });

  it("skips when logging is disabled for this category", async () => {
    mockGetLogConfig.mockResolvedValueOnce(null);
    const message = createMockMessage();
    await event.execute(message as never);

    expect(mockGetLogConfig).toHaveBeenCalledWith("guild-1", "message");
    expect(mockSendLogEmbed).not.toHaveBeenCalled();
  });

  it("skips when config exists but enabled is false", async () => {
    mockGetLogConfig.mockResolvedValueOnce({ enabled: false, channelId: "log-ch" });
    const message = createMockMessage();
    await event.execute(message as never);

    expect(mockSendLogEmbed).not.toHaveBeenCalled();
  });

  it("skips when channel is ignored", async () => {
    mockGetLogConfig.mockResolvedValueOnce({
      enabled: true,
      channelId: "log-ch",
      ignoredChannels: ["channel-1"],
      ignoredRoles: [],
    });
    mockIsIgnored.mockReturnValueOnce(true);
    const message = createMockMessage();
    await event.execute(message as never);

    expect(mockSendLogEmbed).not.toHaveBeenCalled();
  });

  it("sends embed and persists log entry on valid event", async () => {
    mockGetLogConfig.mockResolvedValueOnce({
      enabled: true,
      channelId: "log-ch",
      ignoredChannels: [],
      ignoredRoles: [],
    });
    mockIsIgnored.mockReturnValueOnce(false);
    const message = createMockMessage();
    await event.execute(message as never);

    expect(mockFormatMessageDelete).toHaveBeenCalledWith(message);
    expect(mockSendLogEmbed).toHaveBeenCalledWith(
      message.guild,
      "log-ch",
      expect.anything(),
    );
    expect(mockCreateLogEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        guildId: "guild-1",
        category: "message",
        eventType: "messageDelete",
        targetId: "user-1",
      }),
    );
  });
});
