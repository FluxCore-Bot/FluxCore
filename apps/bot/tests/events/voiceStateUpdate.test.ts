import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    guildId: undefined,
    logLevel: "info",
  },
}));

const mockGetConfigByHubChannel = vi.fn().mockReturnValue(undefined);
vi.mock("@fluxcore/systems/tempVoice/config", () => ({
  getConfigByHubChannel: (...args: unknown[]) =>
    mockGetConfigByHubChannel(...args),
}));

const mockCreateTempChannel = vi.fn().mockResolvedValue(undefined);
const mockIsTrackedChannel = vi.fn().mockReturnValue(false);
const mockUntrackChannel = vi.fn();
vi.mock("../../src/features/tempvoice/system/manager.js", () => ({
  createTempChannel: (...args: unknown[]) => mockCreateTempChannel(...args),
  isTrackedChannel: (...args: unknown[]) => mockIsTrackedChannel(...args),
  untrackChannel: (...args: unknown[]) => mockUntrackChannel(...args),
}));

const voiceModule = await import("../../src/events/voiceStateUpdate.js");
const event = voiceModule.default;

function createMockVoiceState({
  channelId = null as string | null,
  member = { id: "user-123" },
  guildId = "guild-789",
  channel = null as { members: { size: number }; id: string; name: string; delete: ReturnType<typeof vi.fn> } | null,
} = {}) {
  return {
    channelId,
    member,
    channel,
    id: member?.id,
    guild: { id: guildId },
  };
}

describe("voiceStateUpdate event", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has correct event metadata", () => {
    expect(event.name).toBe("voiceStateUpdate");
  });

  it("creates temp channel when user joins hub channel", async () => {
    const hubConfig = {
      id: 1,
      hubChannelId: "hub-channel",
      nameTemplate: "{user}'s Channel",
      categoryId: null,
    };
    mockGetConfigByHubChannel.mockReturnValueOnce(hubConfig);

    const oldState = createMockVoiceState({ channelId: null });
    const newState = createMockVoiceState({
      channelId: "hub-channel",
      member: { id: "user-123" },
    });

    await event.execute(oldState as never, newState as never);

    expect(mockGetConfigByHubChannel).toHaveBeenCalledWith("hub-channel");
    expect(mockCreateTempChannel).toHaveBeenCalledWith(
      newState.member,
      newState.guild,
      hubConfig,
    );
  });

  it("does not create channel when joining non-hub channel", async () => {
    mockGetConfigByHubChannel.mockReturnValueOnce(undefined);

    const oldState = createMockVoiceState({ channelId: null });
    const newState = createMockVoiceState({ channelId: "other-channel" });

    await event.execute(oldState as never, newState as never);

    expect(mockCreateTempChannel).not.toHaveBeenCalled();
  });

  it("does not create channel when no config exists", async () => {
    const oldState = createMockVoiceState({ channelId: null });
    const newState = createMockVoiceState({ channelId: "hub-channel" });

    await event.execute(oldState as never, newState as never);

    expect(mockCreateTempChannel).not.toHaveBeenCalled();
  });

  it("deletes empty tracked channel when user leaves", async () => {
    mockIsTrackedChannel.mockReturnValueOnce(true);
    const mockChannel = {
      id: "temp-channel",
      name: "User's Channel",
      members: { size: 0 },
      delete: vi.fn().mockResolvedValue(undefined),
    };

    const oldState = createMockVoiceState({
      channelId: "temp-channel",
      channel: mockChannel,
    });
    const newState = createMockVoiceState({ channelId: null });

    await event.execute(oldState as never, newState as never);

    expect(mockUntrackChannel).toHaveBeenCalledWith("temp-channel");
    expect(mockChannel.delete).toHaveBeenCalledWith("Temp voice channel empty");
  });

  it("does not delete tracked channel with members", async () => {
    mockIsTrackedChannel.mockReturnValueOnce(true);
    const mockChannel = {
      id: "temp-channel",
      name: "User's Channel",
      members: { size: 1 },
      delete: vi.fn(),
    };

    const oldState = createMockVoiceState({
      channelId: "temp-channel",
      channel: mockChannel,
    });
    const newState = createMockVoiceState({ channelId: null });

    await event.execute(oldState as never, newState as never);

    expect(mockChannel.delete).not.toHaveBeenCalled();
  });

  it("does not delete untracked channel", async () => {
    const oldState = createMockVoiceState({ channelId: "some-channel" });
    const newState = createMockVoiceState({ channelId: null });

    await event.execute(oldState as never, newState as never);

    expect(mockUntrackChannel).not.toHaveBeenCalled();
  });

  it("handles channel delete failure gracefully", async () => {
    mockIsTrackedChannel.mockReturnValueOnce(true);
    const mockChannel = {
      id: "temp-channel",
      name: "User's Channel",
      members: { size: 0 },
      delete: vi.fn().mockRejectedValue(new Error("Delete failed")),
    };

    const oldState = createMockVoiceState({
      channelId: "temp-channel",
      channel: mockChannel,
    });
    const newState = createMockVoiceState({ channelId: null });

    // Should not throw
    await expect(
      event.execute(oldState as never, newState as never),
    ).resolves.not.toThrow();
  });

  it("ignores when user moves within same channel", async () => {
    const oldState = createMockVoiceState({ channelId: "channel-1" });
    const newState = createMockVoiceState({ channelId: "channel-1" });

    await event.execute(oldState as never, newState as never);

    expect(mockCreateTempChannel).not.toHaveBeenCalled();
    expect(mockIsTrackedChannel).not.toHaveBeenCalled();
  });
});
