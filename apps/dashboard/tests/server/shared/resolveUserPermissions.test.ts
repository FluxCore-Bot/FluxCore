import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: { token: "test-token", clientId: "test-client-id", logLevel: "info" },
}));

vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockGetGuildAuthority = vi.fn();
vi.mock("../../../src/server/shared/guildAuthz.js", () => ({
  getGuildAuthority: (...args: unknown[]) => mockGetGuildAuthority(...args),
  isUserGuildAdmin: vi.fn(),
}));

const mockFindGuildSettings = vi.fn();
const mockFindAssignments = vi.fn();
const mockFindDefaultRoles = vi.fn();
const mockFindUserPermissions = vi.fn();
vi.mock("@fluxcore/database", () => ({
  getPrisma: () => ({
    dashboardGuildSettings: { findUnique: mockFindGuildSettings },
    dashboardRoleAssignment: { findMany: mockFindAssignments },
    dashboardRole: { findMany: mockFindDefaultRoles },
    dashboardUserPermission: { findMany: mockFindUserPermissions },
  }),
}));

const { resolveUserPermissions } = await import(
  "../../../src/server/shared/permissions.js"
);

const TICKET_ROLE = {
  id: "role-1",
  permissions: JSON.stringify(["tickets.list.view", "tickets.list.manage"]),
};

// Unique guild per test so the 60s permission cache never leaks across cases.
let counter = 0;

describe("resolveUserPermissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    counter++;
    mockFindGuildSettings.mockResolvedValue({ requirePermissions: false });
    mockFindAssignments.mockResolvedValue([]);
    mockFindDefaultRoles.mockResolvedValue([]);
    mockFindUserPermissions.mockResolvedValue([]);
  });

  it("grants the owner everything", async () => {
    const guild = `g-owner-${counter}`;
    mockGetGuildAuthority.mockResolvedValue({ isOwner: true, isAdmin: true, isMember: true });

    const resolved = await resolveUserPermissions("user-1", guild);

    expect([...resolved.permissions]).toEqual(["*"]);
    expect(resolved.isOwner).toBe(true);
    expect(resolved.isGuildMember).toBe(true);
  });

  it("grants an admin everything in legacy mode", async () => {
    const guild = `g-legacy-${counter}`;
    mockGetGuildAuthority.mockResolvedValue({ isOwner: false, isAdmin: true, isMember: true });
    mockFindGuildSettings.mockResolvedValue({ requirePermissions: false });

    const resolved = await resolveUserPermissions("user-1", guild);

    expect([...resolved.permissions]).toEqual(["*"]);
    expect(resolved.isGuildAdmin).toBe(true);
  });

  it("restricts an admin to role grants plus default roles when the system is on", async () => {
    const guild = `g-admin-rbac-${counter}`;
    mockGetGuildAuthority.mockResolvedValue({ isOwner: false, isAdmin: true, isMember: true });
    mockFindGuildSettings.mockResolvedValue({ requirePermissions: true });
    mockFindAssignments.mockResolvedValue([{ roleId: "role-1", role: TICKET_ROLE }]);
    mockFindDefaultRoles.mockResolvedValue([
      { id: "role-2", permissions: JSON.stringify(["logging.entries.view"]) },
    ]);

    const resolved = await resolveUserPermissions("user-1", guild);

    expect([...resolved.permissions].sort()).toEqual([
      "logging.entries.view",
      "tickets.list.manage",
      "tickets.list.view",
    ]);
  });

  it("grants a non-admin member exactly their explicit grants", async () => {
    const guild = `g-member-grants-${counter}`;
    mockGetGuildAuthority.mockResolvedValue({ isOwner: false, isAdmin: false, isMember: true });
    mockFindGuildSettings.mockResolvedValue({ requirePermissions: true });
    mockFindAssignments.mockResolvedValue([{ roleId: "role-1", role: TICKET_ROLE }]);
    mockFindUserPermissions.mockResolvedValue([{ permission: "logging.entries.view" }]);

    const resolved = await resolveUserPermissions("user-1", guild);

    expect([...resolved.permissions].sort()).toEqual([
      "logging.entries.view",
      "tickets.list.view",
      "tickets.list.manage",
    ].sort());
    expect(resolved.isGuildAdmin).toBe(false);
    expect(resolved.isGuildMember).toBe(true);
  });

  it("grants a non-admin member their grants in legacy mode too", async () => {
    const guild = `g-member-legacy-${counter}`;
    mockGetGuildAuthority.mockResolvedValue({ isOwner: false, isAdmin: false, isMember: true });
    mockFindGuildSettings.mockResolvedValue({ requirePermissions: false });
    mockFindAssignments.mockResolvedValue([{ roleId: "role-1", role: TICKET_ROLE }]);

    const resolved = await resolveUserPermissions("user-1", guild);

    expect([...resolved.permissions].sort()).toEqual([
      "tickets.list.manage",
      "tickets.list.view",
    ]);
  });

  it("never applies default roles to a non-admin member", async () => {
    const guild = `g-member-no-default-${counter}`;
    mockGetGuildAuthority.mockResolvedValue({ isOwner: false, isAdmin: false, isMember: true });
    mockFindGuildSettings.mockResolvedValue({ requirePermissions: true });
    mockFindDefaultRoles.mockResolvedValue([
      { id: "role-2", permissions: JSON.stringify(["logging.entries.view"]) },
    ]);

    const resolved = await resolveUserPermissions("user-1", guild);

    expect(resolved.permissions.size).toBe(0);
  });

  it("gives a non-member nothing even with a stale grant row", async () => {
    const guild = `g-non-member-${counter}`;
    mockGetGuildAuthority.mockResolvedValue({ isOwner: false, isAdmin: false, isMember: false });
    mockFindAssignments.mockResolvedValue([{ roleId: "role-1", role: TICKET_ROLE }]);

    const resolved = await resolveUserPermissions("user-1", guild);

    expect(resolved.permissions.size).toBe(0);
    expect(resolved.isGuildMember).toBe(false);
    expect(mockFindAssignments).not.toHaveBeenCalled();
  });

  it("tolerates a role whose permissions column is not valid JSON", async () => {
    const guild = `g-bad-json-${counter}`;
    mockGetGuildAuthority.mockResolvedValue({ isOwner: false, isAdmin: false, isMember: true });
    mockFindAssignments.mockResolvedValue([
      { roleId: "role-1", role: { id: "role-1", permissions: "not json" } },
    ]);

    const resolved = await resolveUserPermissions("user-1", guild);

    expect(resolved.permissions.size).toBe(0);
  });
});
