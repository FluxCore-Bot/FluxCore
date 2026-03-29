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

const mockHandleRolePanelReaction = vi.fn().mockResolvedValue(undefined);
vi.mock("@fluxcore/systems/rolePanel/handler", () => ({
  handleRolePanelReaction: (...args: unknown[]) => mockHandleRolePanelReaction(...args),
}));

const mockHandleStarboardReaction = vi.fn().mockResolvedValue(undefined);
vi.mock("@fluxcore/systems/starboard/handler", () => ({
  handleStarboardReaction: (...args: unknown[]) => mockHandleStarboardReaction(...args),
}));

const eventModule = await import("../../src/events/messageReactionRemove.js");
const event = eventModule.default;

function createMockReaction({ isPartial = false } = {}) {
  return {
    partial: isPartial,
    fetch: vi.fn().mockResolvedValue(undefined),
    emoji: { name: "\u2B50" },
  };
}

function createMockUser({ bot = false } = {}) {
  return { bot, id: "user-1" };
}

describe("messageReactionRemove event", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has correct event metadata", () => {
    expect(event.name).toBe("messageReactionRemove");
  });

  it("calls both role panel and starboard handlers", async () => {
    const reaction = createMockReaction();
    const user = createMockUser();

    await event.execute(reaction as never, user as never);

    expect(mockHandleRolePanelReaction).toHaveBeenCalledWith(reaction, user, false);
    expect(mockHandleStarboardReaction).toHaveBeenCalledWith(reaction, user);
  });

  it("fetches partial reactions before handling", async () => {
    const reaction = createMockReaction({ isPartial: true });
    const user = createMockUser();

    await event.execute(reaction as never, user as never);

    expect(reaction.fetch).toHaveBeenCalled();
    expect(mockHandleRolePanelReaction).toHaveBeenCalled();
    expect(mockHandleStarboardReaction).toHaveBeenCalled();
  });

  it("returns early if partial fetch fails", async () => {
    const reaction = createMockReaction({ isPartial: true });
    reaction.fetch.mockRejectedValueOnce(new Error("Message deleted"));
    const user = createMockUser();

    await event.execute(reaction as never, user as never);

    expect(mockHandleRolePanelReaction).not.toHaveBeenCalled();
    expect(mockHandleStarboardReaction).not.toHaveBeenCalled();
  });

  it("does not throw when one handler errors", async () => {
    mockHandleRolePanelReaction.mockRejectedValueOnce(new Error("DB error"));
    const reaction = createMockReaction();
    const user = createMockUser();

    await expect(event.execute(reaction as never, user as never)).resolves.not.toThrow();
    expect(mockHandleStarboardReaction).toHaveBeenCalled();
  });
});
