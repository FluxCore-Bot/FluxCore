import { describe, it, expect, vi } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: { token: "t", clientId: "c", guildId: undefined, logLevel: "info" },
}));

vi.mock("@fluxcore/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fluxcore/utils")>();
  return {
    ...actual,
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
  };
});

vi.mock("@fluxcore/systems/leveling/config", () => ({
  getLevelSettings: vi.fn().mockResolvedValue({
    enabled: true,
    xpPerMessage: 10,
    xpCooldownSeconds: 0,
    noXpChannels: [],
    noXpRoles: [],
    multipliers: [],
    announceEnabled: true,
    announceChannel: null,
    announceMessage: "@everyone {user} hit {level}!",
  }),
}));
vi.mock("@fluxcore/systems/leveling/persistence", () => ({
  getUserLevel: vi.fn().mockResolvedValue(null),
  addXp: vi.fn().mockResolvedValue({ leveledUp: true, newLevel: 2 }),
}));
vi.mock("@fluxcore/systems/leveling/xp", () => ({
  applyMultipliers: (xp: number) => xp,
}));
vi.mock("@fluxcore/systems/leveling/constants", () => ({ XP_RANDOMNESS: 1 }));
vi.mock("@fluxcore/systems/leveling/rewards", () => ({
  checkAndGrantRewards: vi.fn(),
}));

const event = (await import("../../src/events/messageCreate.js")).default;

describe("level-up announcement allowedMentions", () => {
  it("passes allowedMentions to channel.send when announcing in same channel", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const message = {
      guild: { id: "g1", channels: { cache: { get: () => null } } },
      author: { id: "u1", bot: false, displayName: "Alice", send: vi.fn() },
      member: { roles: { cache: new Map() } },
      channelId: "c1",
      channel: { send },
    } as never;

    await event.execute(message);

    expect(send).toHaveBeenCalledTimes(1);
    const arg = send.mock.calls[0][0] as {
      content: string;
      allowedMentions: { parse: string[]; users: string[] };
    };
    expect(typeof arg).toBe("object");
    expect(arg.content).toContain("@everyone");
    expect(arg.allowedMentions).toEqual({ parse: [], users: ["u1"] });
  });

  it("passes allowedMentions when announceChannel is configured", async () => {
    const { getLevelSettings } = await import("@fluxcore/systems/leveling/config");
    (getLevelSettings as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      enabled: true,
      xpPerMessage: 10,
      xpCooldownSeconds: 0,
      noXpChannels: [],
      noXpRoles: [],
      multipliers: [],
      announceEnabled: true,
      announceChannel: "ch-announce",
      announceMessage: "<@&modRole> {user} hit {level}!",
    });

    const announceSend = vi.fn().mockResolvedValue(undefined);
    const message = {
      guild: {
        id: "g1",
        channels: {
          cache: {
            get: (id: string) =>
              id === "ch-announce"
                ? { isTextBased: () => true, send: announceSend }
                : null,
          },
        },
      },
      author: { id: "u1", bot: false, displayName: "Alice", send: vi.fn() },
      member: { roles: { cache: new Map() } },
      channelId: "c1",
      channel: { send: vi.fn() },
    } as never;

    await event.execute(message);

    expect(announceSend).toHaveBeenCalledTimes(1);
    const arg = announceSend.mock.calls[0][0] as {
      allowedMentions: { parse: string[]; users: string[] };
    };
    expect(arg.allowedMentions).toEqual({
      parse: [],
      users: ["u1"],
    });
  });
});
