import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: { token: "t", clientId: "c", guildId: undefined, logLevel: "info" },
}));

const warn = vi.fn();
const error = vi.fn();
vi.mock("@fluxcore/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fluxcore/utils")>();
  return {
    ...actual,
    logger: { warn, error, info: vi.fn(), debug: vi.fn() },
  };
});

vi.mock("@fluxcore/systems/logging/config", () => ({
  getLogConfig: vi.fn().mockResolvedValue(null),
}));
vi.mock("@fluxcore/systems/logging/persistence", () => ({ createLogEntry: vi.fn() }));
vi.mock("@fluxcore/systems/logging/sender", () => ({ sendLogEmbed: vi.fn() }));
vi.mock("@fluxcore/systems/logging/formatter", () => ({ formatMemberJoin: vi.fn() }));

vi.mock("@fluxcore/systems/antiraid/config", () => ({
  getAntiRaidConfig: vi.fn().mockResolvedValue({ enabled: false }),
}));
vi.mock("@fluxcore/systems/antiraid/tracker", () => ({ recordJoin: vi.fn() }));
vi.mock("@fluxcore/systems/antiraid/actions", () => ({
  executeRaidAction: vi.fn(),
  lockdownGuild: vi.fn(),
}));
vi.mock("@fluxcore/systems/antiraid/persistence", () => ({ createRaidEvent: vi.fn() }));

vi.mock("@fluxcore/systems/welcome/config", () => ({
  getWelcomeConfig: vi.fn().mockResolvedValue({
    autoRoleIds: ["role-1"],
    welcomeEnabled: false,
    welcomeChannelId: null,
    welcomeMessage: "",
    welcomeImageEnabled: false,
    welcomeImageConfig: { sendMode: "with" },
    dmEnabled: false,
    dmMessage: "",
  }),
}));

vi.mock("@fluxcore/systems/welcome/builder", () => ({
  buildWelcomeEmbed: vi.fn(),
}));
vi.mock("@fluxcore/systems/welcome/image", () => ({
  generateWelcomeImage: vi.fn(),
  createStorageAdapter: vi.fn(),
  sanitizeDisplayName: (s: string) => s,
}));

import { DiscordAPIError } from "discord.js";

const event = (await import("../../src/events/guildMemberAdd.js")).default;

function mkMember(rolesAdd: ReturnType<typeof vi.fn>) {
  return {
    id: "m1",
    user: {
      bot: false,
      username: "alice",
      createdTimestamp: Date.now() - 86_400_000 * 100,
      displayAvatarURL: () => "",
      tag: "",
    },
    displayName: "Alice",
    guild: {
      id: "g1",
      name: "G",
      memberCount: 5,
      iconURL: () => null,
      members: { me: { roles: { highest: { position: 100 } } } },
      roles: {
        cache: new Map([["role-1", { position: 5, id: "role-1" }]]),
      },
      channels: { cache: { get: () => null } },
    },
    roles: { cache: new Map(), add: rolesAdd },
    send: vi.fn(),
  } as never;
}

function makeApiError(code: number, message: string): DiscordAPIError {
  const err = new DiscordAPIError(
    { message, code } as never,
    code,
    403,
    "PUT",
    "url",
    { files: [] } as never,
  );
  return err;
}

describe("auto-role failure handling", () => {
  beforeEach(() => {
    warn.mockClear();
    error.mockClear();
  });

  it("logs WARN with 'missing permissions' on Discord code 50013", async () => {
    const rolesAdd = vi.fn().mockRejectedValue(makeApiError(50013, "Missing Permissions"));
    await event.execute(mkMember(rolesAdd));
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/auto-role.*missing permissions/i),
    );
    expect(error).not.toHaveBeenCalled();
  });

  it("logs WARN with 'unknown role' on Discord code 10011", async () => {
    const rolesAdd = vi.fn().mockRejectedValue(makeApiError(10011, "Unknown Role"));
    await event.execute(mkMember(rolesAdd));
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/auto-role.*unknown role/i),
    );
    expect(error).not.toHaveBeenCalled();
  });

  it("logs ERROR for unexpected failure (e.g. 5xx)", async () => {
    const rolesAdd = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    await event.execute(mkMember(rolesAdd));
    expect(error).toHaveBeenCalled();
  });
});
