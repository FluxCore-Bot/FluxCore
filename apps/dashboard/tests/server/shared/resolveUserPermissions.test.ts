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

const { resolveUserPermissions, safeParsePermissions } = await import(
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

  it("calls getGuildAuthority with (guildId, userId) — the reverse of its own argument order", async () => {
    // resolveUserPermissions(userId, guildId) and getGuildAuthority(guildId, userId)
    // have inverted parameter orders, both string, so a swap would type-check
    // silently. This pins the call so a future swap fails a test instead of
    // silently authorizing (or denying) the wrong guild/user pair.
    const guild = `g-arg-order-${counter}`;
    mockGetGuildAuthority.mockResolvedValue({ isOwner: true, isAdmin: true, isMember: true });

    await resolveUserPermissions("user-1", guild);

    expect(mockGetGuildAuthority).toHaveBeenCalledWith(guild, "user-1");
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

  it("tolerates a role whose permissions column is syntactically valid JSON but not an array", async () => {
    // The bug this guards: JSON.parse('"5"') succeeds (returns the string "5"),
    // and an unchecked `as string[]` cast would hand that back to a caller that
    // iterates it — a string iterates per character, a number would throw a
    // TypeError, either way turning a bad DB row into a 500 that locks the
    // requesting user out of the guild instead of resolving to no permissions.
    const guild = `g-non-array-json-${counter}`;
    mockGetGuildAuthority.mockResolvedValue({ isOwner: false, isAdmin: false, isMember: true });
    mockFindAssignments.mockResolvedValue([
      { roleId: "role-1", role: { id: "role-1", permissions: "5" } },
    ]);

    const resolved = await resolveUserPermissions("user-1", guild);

    expect(resolved.permissions.size).toBe(0);
  });
});

describe("safeParsePermissions", () => {
  it("returns the array for valid JSON string arrays", () => {
    expect(safeParsePermissions('["moderation.*", "tickets.list.view"]')).toEqual([
      "moderation.*",
      "tickets.list.view",
    ]);
  });

  it("falls back to an empty array for malformed JSON", () => {
    expect(safeParsePermissions("not json")).toEqual([]);
  });

  it("falls back to an empty array for syntactically valid JSON that is not an array", () => {
    expect(safeParsePermissions("5")).toEqual([]);
    expect(safeParsePermissions('"a string"')).toEqual([]);
    expect(safeParsePermissions('{"a": 1}')).toEqual([]);
    expect(safeParsePermissions("null")).toEqual([]);
  });

  it("filters out non-string elements rather than returning them uncast", () => {
    expect(safeParsePermissions('["moderation.*", 5, null, {"a":1}]')).toEqual(["moderation.*"]);
  });
});
