import { describe, it, expect, vi, beforeEach } from "vitest";

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

vi.mock("@fluxcore/systems/logging/config", () => ({
  getLogConfig: vi.fn().mockResolvedValue(null),
}));
vi.mock("@fluxcore/systems/logging/persistence", () => ({
  createLogEntry: vi.fn(),
}));
vi.mock("@fluxcore/systems/logging/sender", () => ({
  sendLogEmbed: vi.fn(),
}));
vi.mock("@fluxcore/systems/logging/formatter", () => ({
  formatMemberJoin: vi.fn(),
}));

vi.mock("@fluxcore/systems/antiraid/config", () => ({
  getAntiRaidConfig: vi.fn().mockResolvedValue({ enabled: false }),
}));
vi.mock("@fluxcore/systems/antiraid/tracker", () => ({ recordJoin: vi.fn() }));
vi.mock("@fluxcore/systems/antiraid/actions", () => ({
  executeRaidAction: vi.fn(),
  lockdownGuild: vi.fn(),
}));
vi.mock("@fluxcore/systems/antiraid/persistence", () => ({
  createRaidEvent: vi.fn(),
}));

vi.mock("@fluxcore/systems/welcome/config", () => ({
  getWelcomeConfig: vi.fn().mockResolvedValue({
    autoRoleIds: [],
    welcomeEnabled: true,
    welcomeChannelId: "ch-welcome",
    welcomeMessage: "hi",
    welcomeImageEnabled: true,
    welcomeImageConfig: { sendMode: "with" },
    dmEnabled: false,
    dmMessage: "",
  }),
}));

vi.mock("@fluxcore/systems/welcome/builder", () => ({
  buildWelcomeEmbed: vi.fn().mockReturnValue({
    setImage: vi.fn().mockReturnThis(),
  }),
}));

const generateWelcomeImage = vi
  .fn()
  .mockResolvedValue(Buffer.from("image"));
vi.mock("@fluxcore/systems/welcome/image", () => ({
  generateWelcomeImage: (...args: unknown[]) => generateWelcomeImage(...args),
  createStorageAdapter: vi.fn().mockReturnValue({}),
  sanitizeDisplayName: (raw: string, maxLen: number): string => {
    const BIDI_OVERRIDES = /[\u202A-\u202E\u2066-\u2069]/g;
    const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/g;
    const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
    const WHITESPACE_RUN = /\s+/g;
    if (typeof raw !== "string") return "Unknown";
    let out = raw
      .normalize("NFC")
      .replace(BIDI_OVERRIDES, "")
      .replace(ZERO_WIDTH, "")
      .replace(CONTROL_CHARS, "")
      .replace(WHITESPACE_RUN, " ")
      .trim();
    if (out.length === 0) return "Unknown";
    if (out.length > maxLen) out = out.slice(0, maxLen);
    return out;
  },
}));

const event = (
  await import("../../src/events/guildMemberAdd.js")
).default;

describe("guildMemberAdd: sanitizes hostile names before canvas render", () => {
  beforeEach(() => {
    generateWelcomeImage.mockClear();
  });

  it("strips RTL override and zero-width from username/displayName/guild.name", async () => {
    const sentChannel = {
      isTextBased: () => true,
      send: vi.fn().mockResolvedValue(undefined),
    };
    const member = {
      id: "m1",
      user: {
        bot: false,
        username: "\u202Eevil\u202Duser",
        createdTimestamp: Date.now() - 10 * 86_400_000,
        displayAvatarURL: () => "https://cdn/avatar.png",
        tag: "tag",
      },
      displayName: "a\u200B".repeat(100),
      guild: {
        id: "g1",
        name: "Server\u202Ename",
        memberCount: 5,
        channels: { cache: { get: () => sentChannel } },
        iconURL: () => null,
        members: { me: null },
        roles: { cache: new Map() },
      },
      roles: { cache: new Map(), add: vi.fn() },
      send: vi.fn(),
    } as never;

    await event.execute(member);

    expect(generateWelcomeImage).toHaveBeenCalledTimes(1);
    const call = generateWelcomeImage.mock.calls[0][0];
    expect(call.member.username).toBe("eviluser");
    expect(call.member.displayName).not.toContain("\u200B");
    expect(call.member.displayName.length).toBeLessThanOrEqual(80);
    expect(call.guild.name).toBe("Servername");
  });
});
