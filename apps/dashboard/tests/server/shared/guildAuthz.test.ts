import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetGuildOwnerId = vi.fn();
const mockGetGuildMember = vi.fn();
const mockGetGuildRoles = vi.fn();
vi.mock("../../../src/server/shared/discordApi.js", () => ({
  getGuildOwnerId: (...a: unknown[]) => mockGetGuildOwnerId(...a),
  getGuildMember: (...a: unknown[]) => mockGetGuildMember(...a),
  getGuildRoles: (...a: unknown[]) => mockGetGuildRoles(...a),
}));

const { getGuildAuthority } = await import(
  "../../../src/server/shared/guildAuthz.js"
);

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
