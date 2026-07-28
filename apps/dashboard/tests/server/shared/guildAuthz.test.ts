import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetGuildOwnerId = vi.fn();
const mockGetGuildMember = vi.fn();
const mockGetGuildRoles = vi.fn();
vi.mock("../../../src/server/shared/discordApi.js", () => ({
  getGuildOwnerId: (...a: unknown[]) => mockGetGuildOwnerId(...a),
  getGuildMember: (...a: unknown[]) => mockGetGuildMember(...a),
  getGuildRoles: (...a: unknown[]) => mockGetGuildRoles(...a),
}));

const { isUserGuildAdmin, getGuildAuthority } = await import(
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

describe("getGuildAuthority", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGuildOwnerId.mockResolvedValue("owner-x");
    mockGetGuildMember.mockResolvedValue({ roles: [] });
    mockGetGuildRoles.mockResolvedValue([]);
  });

  it("reports the owner as owner, admin, and member without fetching the member", async () => {
    mockGetGuildOwnerId.mockResolvedValue("user-1");

    const authority = await getGuildAuthority("guild-1", "user-1");

    expect(authority).toEqual({ isOwner: true, isAdmin: true, isMember: true });
    expect(mockGetGuildMember).not.toHaveBeenCalled();
  });

  it("reports a non-member as nothing", async () => {
    mockGetGuildOwnerId.mockResolvedValue("owner-1");
    mockGetGuildMember.mockResolvedValue(null);

    const authority = await getGuildAuthority("guild-1", "user-1");

    expect(authority).toEqual({ isOwner: false, isAdmin: false, isMember: false });
  });

  it("reports a plain member as a member but not an admin", async () => {
    mockGetGuildOwnerId.mockResolvedValue("owner-1");
    mockGetGuildMember.mockResolvedValue({ roles: ["role-1"] });
    mockGetGuildRoles.mockResolvedValue([
      { id: "guild-1", name: "@everyone", permissions: "0" },
      { id: "role-1", name: "Member", permissions: "0" },
    ]);

    const authority = await getGuildAuthority("guild-1", "user-1");

    expect(authority).toEqual({ isOwner: false, isAdmin: false, isMember: true });
  });

  it("reports a member with Manage Server as an admin", async () => {
    mockGetGuildOwnerId.mockResolvedValue("owner-1");
    mockGetGuildMember.mockResolvedValue({ roles: ["role-1"] });
    mockGetGuildRoles.mockResolvedValue([
      { id: "guild-1", name: "@everyone", permissions: "0" },
      { id: "role-1", name: "Staff", permissions: BigInt(0x20).toString() },
    ]);

    const authority = await getGuildAuthority("guild-1", "user-1");

    expect(authority).toEqual({ isOwner: false, isAdmin: true, isMember: true });
  });

  it("fetches the member only once per call", async () => {
    mockGetGuildOwnerId.mockResolvedValue("owner-1");
    mockGetGuildMember.mockResolvedValue({ roles: [] });
    mockGetGuildRoles.mockResolvedValue([
      { id: "guild-1", name: "@everyone", permissions: "0" },
    ]);

    await getGuildAuthority("guild-1", "user-1");

    expect(mockGetGuildMember).toHaveBeenCalledTimes(1);
  });
});
