import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetGuildOwnerId = vi.fn();
const mockGetGuildMember = vi.fn();
const mockGetGuildRoles = vi.fn();
vi.mock("../../../src/server/shared/discordApi.js", () => ({
  getGuildOwnerId: (...a: unknown[]) => mockGetGuildOwnerId(...a),
  getGuildMember: (...a: unknown[]) => mockGetGuildMember(...a),
  getGuildRoles: (...a: unknown[]) => mockGetGuildRoles(...a),
}));

const { isUserGuildAdmin } = await import(
  "../../../src/server/shared/guildAuthz.js"
);

const GUILD = "guild-1";
const ADMINISTRATOR = BigInt(0x8);
const MANAGE_GUILD = BigInt(0x20);
const SEND_MESSAGES = BigInt(0x800);

describe("isUserGuildAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGuildOwnerId.mockResolvedValue("owner-x");
    mockGetGuildMember.mockResolvedValue({ roles: [] });
    mockGetGuildRoles.mockResolvedValue([]);
  });

  it("grants the guild owner", async () => {
    mockGetGuildOwnerId.mockResolvedValueOnce("user-1");
    expect(await isUserGuildAdmin(GUILD, "user-1")).toBe(true);
    // Owner short-circuits before member/role lookups.
    expect(mockGetGuildMember).not.toHaveBeenCalled();
  });

  it("grants a member whose role has Administrator", async () => {
    mockGetGuildMember.mockResolvedValueOnce({ roles: ["role-admin"] });
    mockGetGuildRoles.mockResolvedValueOnce([
      { id: GUILD, name: "@everyone", color: 0, permissions: "0" },
      {
        id: "role-admin",
        name: "Admin",
        color: 0,
        permissions: ADMINISTRATOR.toString(),
      },
    ]);
    expect(await isUserGuildAdmin(GUILD, "user-1")).toBe(true);
  });

  it("grants a member whose role has Manage Server", async () => {
    mockGetGuildMember.mockResolvedValueOnce({ roles: ["role-mod"] });
    mockGetGuildRoles.mockResolvedValueOnce([
      { id: GUILD, name: "@everyone", color: 0, permissions: "0" },
      {
        id: "role-mod",
        name: "Mod",
        color: 0,
        permissions: MANAGE_GUILD.toString(),
      },
    ]);
    expect(await isUserGuildAdmin(GUILD, "user-1")).toBe(true);
  });

  it("grants when @everyone itself has Manage Server", async () => {
    mockGetGuildMember.mockResolvedValueOnce({ roles: [] });
    mockGetGuildRoles.mockResolvedValueOnce([
      {
        id: GUILD,
        name: "@everyone",
        color: 0,
        permissions: MANAGE_GUILD.toString(),
      },
    ]);
    expect(await isUserGuildAdmin(GUILD, "user-1")).toBe(true);
  });

  it("denies a member with only non-admin permissions", async () => {
    mockGetGuildMember.mockResolvedValueOnce({ roles: ["role-basic"] });
    mockGetGuildRoles.mockResolvedValueOnce([
      { id: GUILD, name: "@everyone", color: 0, permissions: "0" },
      {
        id: "role-basic",
        name: "Member",
        color: 0,
        permissions: SEND_MESSAGES.toString(),
      },
    ]);
    expect(await isUserGuildAdmin(GUILD, "user-1")).toBe(false);
  });

  it("denies a user who is not a member of the guild (revoked/left)", async () => {
    mockGetGuildMember.mockResolvedValueOnce(null);
    expect(await isUserGuildAdmin(GUILD, "user-1")).toBe(false);
    // No point computing roles if they aren't even a member.
    expect(mockGetGuildRoles).not.toHaveBeenCalled();
  });
});
