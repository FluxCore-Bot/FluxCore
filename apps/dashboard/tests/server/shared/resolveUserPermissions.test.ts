import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockGetGuildOwnerId = vi.fn();
vi.mock("../../../src/server/shared/discordApi.js", () => ({
  getGuildOwnerId: (...a: unknown[]) => mockGetGuildOwnerId(...a),
}));

const mockIsUserGuildAdmin = vi.fn();
vi.mock("../../../src/server/shared/guildAuthz.js", () => ({
  isUserGuildAdmin: (...a: unknown[]) => mockIsUserGuildAdmin(...a),
}));

const mockFindGuildSettings = vi.fn();
const mockFindRoleAssignments = vi.fn();
const mockFindDefaultRoles = vi.fn();
const mockFindUserPerms = vi.fn();
vi.mock("@fluxcore/database", () => ({
  getPrisma: () => ({
    dashboardGuildSettings: { findUnique: (...a: unknown[]) => mockFindGuildSettings(...a) },
    dashboardRoleAssignment: { findMany: (...a: unknown[]) => mockFindRoleAssignments(...a) },
    dashboardRole: { findMany: (...a: unknown[]) => mockFindDefaultRoles(...a) },
    dashboardUserPermission: { findMany: (...a: unknown[]) => mockFindUserPerms(...a) },
  }),
}));

const { resolveUserPermissions } = await import(
  "../../../src/server/shared/permissions.js"
);

// Unique guild per test so the 60s permission cache never leaks across cases.
let counter = 0;

describe("resolveUserPermissions (live authorization)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    counter++;
    mockGetGuildOwnerId.mockResolvedValue("someone-else");
    mockIsUserGuildAdmin.mockResolvedValue(false);
    mockFindGuildSettings.mockResolvedValue(null);
    mockFindRoleAssignments.mockResolvedValue([]);
    mockFindDefaultRoles.mockResolvedValue([]);
    mockFindUserPerms.mockResolvedValue([]);
  });

  it("grants full access to the guild owner", async () => {
    const guild = `g-owner-${counter}`;
    mockGetGuildOwnerId.mockResolvedValueOnce("user-1");

    const res = await resolveUserPermissions("user-1", guild);

    expect(res.isOwner).toBe(true);
    expect(res.isGuildAdmin).toBe(true);
    expect(res.permissions.has("*")).toBe(true);
    // Owner short-circuits — no live role computation needed.
    expect(mockIsUserGuildAdmin).not.toHaveBeenCalled();
  });

  it("denies a user whose Discord admin was revoked (empty set)", async () => {
    const guild = `g-revoked-${counter}`;
    mockIsUserGuildAdmin.mockResolvedValueOnce(false);

    const res = await resolveUserPermissions("user-1", guild);

    expect(res.isOwner).toBe(false);
    expect(res.isGuildAdmin).toBe(false);
    expect(res.permissions.size).toBe(0);
  });

  it("grants full access to a live admin in legacy mode", async () => {
    const guild = `g-legacy-${counter}`;
    mockIsUserGuildAdmin.mockResolvedValueOnce(true);
    mockFindGuildSettings.mockResolvedValueOnce({ requirePermissions: false });

    const res = await resolveUserPermissions("user-1", guild);

    expect(res.isGuildAdmin).toBe(true);
    expect(res.permissions.has("*")).toBe(true);
  });

  it("resolves role-based permissions for a live admin in RBAC mode", async () => {
    const guild = `g-rbac-${counter}`;
    mockIsUserGuildAdmin.mockResolvedValueOnce(true);
    mockFindGuildSettings.mockResolvedValueOnce({ requirePermissions: true });
    mockFindRoleAssignments.mockResolvedValueOnce([
      { roleId: "r1", role: { id: "r1", permissions: JSON.stringify(["actions.rules.manage"]) } },
    ]);

    const res = await resolveUserPermissions("user-1", guild);

    expect(res.isGuildAdmin).toBe(true);
    expect(res.permissions.has("actions.rules.manage")).toBe(true);
    expect(res.permissions.has("*")).toBe(false);
  });
});
