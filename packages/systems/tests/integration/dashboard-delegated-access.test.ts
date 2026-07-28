/**
 * Integration tests: delegated dashboard access end to end.
 *
 * Exercises the real `resolveUserPermissions()` (the single function the
 * whole "dashboard access without MANAGE_GUILD" feature turns on) against a
 * REAL PostgreSQL test database. Only the Discord API layer is mocked —
 * `getGuildOwnerId` / `getGuildMember` / `getGuildRoles` — so we can drive
 * owner / admin / plain-member / non-member without hitting Discord. Every
 * DB read (roles, assignments, per-user overrides, guild settings) is real.
 *
 * These tests fail if delegated resolution breaks — unlike a test that only
 * creates rows and reads them back through Prisma, which would pass even if
 * `resolveUserPermissions` never consulted them.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { getPrisma } from "@fluxcore/database";
import { setupTestDatabase, teardownTestDatabase } from "../helpers/db.js";

const MANAGE_GUILD = BigInt(0x20);

// Mock only the Discord API layer. `resolveUserPermissions` -> `getGuildAuthority`
// -> these three functions. Everything else (Prisma, the DB) stays real.
const mockGetGuildOwnerId = vi.fn();
const mockGetGuildMember = vi.fn();
const mockGetGuildRoles = vi.fn();

vi.mock("../../../../apps/dashboard/src/server/shared/discordApi.js", () => ({
  getGuildOwnerId: (...args: unknown[]) => mockGetGuildOwnerId(...args),
  getGuildMember: (...args: unknown[]) => mockGetGuildMember(...args),
  getGuildRoles: (...args: unknown[]) => mockGetGuildRoles(...args),
}));

// Dynamic import so this module (and its transitive import of discordApi.js)
// resolves AFTER the mock above and after the const declarations it closes
// over — a static top-of-file import would be hoisted above the `const`s and
// throw a TDZ ReferenceError when the mock factory runs (vitest 4 gotcha).
const { resolveUserPermissions, invalidatePermissionCache } = await import(
  "../../../../apps/dashboard/src/server/shared/permissions.js"
);

/** A plain member with no admin-granting role bits, in a guild with no other roles. */
function mockPlainMember(guildId: string): void {
  mockGetGuildOwnerId.mockResolvedValue("owner-of-" + guildId);
  mockGetGuildMember.mockResolvedValue({ roles: [] });
  mockGetGuildRoles.mockResolvedValue([
    { id: guildId, name: "@everyone", color: 0, permissions: "0" },
  ]);
}

/** A member whose role carries Manage Server, in a guild with no other roles. */
function mockAdminMember(guildId: string): void {
  mockGetGuildOwnerId.mockResolvedValue("owner-of-" + guildId);
  mockGetGuildMember.mockResolvedValue({ roles: ["role-admin"] });
  mockGetGuildRoles.mockResolvedValue([
    { id: guildId, name: "@everyone", color: 0, permissions: "0" },
    { id: "role-admin", name: "Admin", color: 0, permissions: MANAGE_GUILD.toString() },
  ]);
}

/** A user who has left the guild (or was never in it). */
function mockNonMember(guildId: string): void {
  mockGetGuildOwnerId.mockResolvedValue("owner-of-" + guildId);
  mockGetGuildMember.mockResolvedValue(null);
  mockGetGuildRoles.mockResolvedValue([]);
}

async function cleanDashboardTables(): Promise<void> {
  const prisma = getPrisma();
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "DashboardAuditLog",
      "DashboardRoleAssignment",
      "DashboardUserPermission",
      "DashboardRole",
      "DashboardGuildSettings"
    CASCADE
  `);
}

describe("delegated dashboard access — resolveUserPermissions", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await cleanDashboardTables();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  it("resolves a non-admin member with a dashboard role assignment to exactly that role's permissions", async () => {
    const prisma = getPrisma();
    const guildId = "dda-role-assign";
    const userId = "user-1";
    mockPlainMember(guildId);

    const role = await prisma.dashboardRole.create({
      data: {
        guildId,
        name: "Ticket Staff",
        permissions: JSON.stringify(["tickets.list.view", "tickets.list.manage"]),
      },
    });
    await prisma.dashboardRoleAssignment.create({
      data: { guildId, userId, roleId: role.id, assignedBy: "owner" },
    });

    const resolved = await resolveUserPermissions(userId, guildId);

    expect(resolved.permissions).toEqual(
      new Set(["tickets.list.view", "tickets.list.manage"]),
    );
    expect(resolved.isOwner).toBe(false);
    expect(resolved.isGuildAdmin).toBe(false);
    expect(resolved.isGuildMember).toBe(true);
  });

  it("resolves a non-admin member's role assignment identically whether requirePermissions is true or false", async () => {
    const prisma = getPrisma();
    const userId = "user-2";
    const guildOff = "dda-toggle-off";
    const guildOn = "dda-toggle-on";

    for (const guildId of [guildOff, guildOn]) {
      const role = await prisma.dashboardRole.create({
        data: {
          guildId,
          name: "Support",
          permissions: JSON.stringify(["logging.entries.view"]),
        },
      });
      await prisma.dashboardRoleAssignment.create({
        data: { guildId, userId, roleId: role.id, assignedBy: "owner" },
      });
    }
    await prisma.dashboardGuildSettings.create({
      data: { guildId: guildOff, requirePermissions: false },
    });
    await prisma.dashboardGuildSettings.create({
      data: { guildId: guildOn, requirePermissions: true },
    });

    mockPlainMember(guildOff);
    const resolvedOff = await resolveUserPermissions(userId, guildOff);

    mockPlainMember(guildOn);
    const resolvedOn = await resolveUserPermissions(userId, guildOn);

    const expected = new Set(["logging.entries.view"]);
    expect(resolvedOff.permissions).toEqual(expected);
    expect(resolvedOn.permissions).toEqual(expected);
    expect(resolvedOff.isGuildAdmin).toBe(false);
    expect(resolvedOn.isGuildAdmin).toBe(false);
  });

  it("merges a per-user permission override in with the role's permissions", async () => {
    const prisma = getPrisma();
    const guildId = "dda-user-override";
    const userId = "user-3";
    mockPlainMember(guildId);

    const role = await prisma.dashboardRole.create({
      data: { guildId, name: "Support", permissions: JSON.stringify(["logging.entries.view"]) },
    });
    await prisma.dashboardRoleAssignment.create({
      data: { guildId, userId, roleId: role.id, assignedBy: "owner" },
    });
    await prisma.dashboardUserPermission.create({
      data: { guildId, userId, permission: "tickets.list.manage", grantedBy: "owner" },
    });

    const resolved = await resolveUserPermissions(userId, guildId);

    expect(resolved.permissions).toEqual(
      new Set(["logging.entries.view", "tickets.list.manage"]),
    );
  });

  it("does not apply an isDefault role to a non-admin member", async () => {
    const prisma = getPrisma();
    const guildId = "dda-default-non-admin";
    const userId = "user-4";
    mockPlainMember(guildId);

    await prisma.dashboardRole.create({
      data: {
        guildId,
        name: "Baseline",
        isDefault: true,
        permissions: JSON.stringify(["logging.entries.view"]),
      },
    });
    // No assignment for this user — only the isDefault role exists.

    const resolved = await resolveUserPermissions(userId, guildId);

    expect(resolved.permissions).toEqual(new Set());
    expect(resolved.isGuildAdmin).toBe(false);
    expect(resolved.isGuildMember).toBe(true);
  });

  it("applies an isDefault role to an admin when requirePermissions is true", async () => {
    const prisma = getPrisma();
    const guildId = "dda-default-admin";
    const userId = "user-5";
    mockAdminMember(guildId);

    await prisma.dashboardGuildSettings.create({
      data: { guildId, requirePermissions: true },
    });
    await prisma.dashboardRole.create({
      data: {
        guildId,
        name: "Baseline",
        isDefault: true,
        permissions: JSON.stringify(["logging.entries.view"]),
      },
    });

    const resolved = await resolveUserPermissions(userId, guildId);

    expect(resolved.permissions).toEqual(new Set(["logging.entries.view"]));
    expect(resolved.isGuildAdmin).toBe(true);
    expect(resolved.isOwner).toBe(false);
  });

  it("resolves a non-member to an empty permission set even with a stale grant row", async () => {
    const prisma = getPrisma();
    const guildId = "dda-non-member";
    const userId = "user-6";

    const role = await prisma.dashboardRole.create({
      data: { guildId, name: "Ghost Grant", permissions: JSON.stringify(["tickets.list.view"]) },
    });
    await prisma.dashboardRoleAssignment.create({
      data: { guildId, userId, roleId: role.id, assignedBy: "owner" },
    });

    mockNonMember(guildId);

    const resolved = await resolveUserPermissions(userId, guildId);

    expect(resolved.permissions).toEqual(new Set());
    expect(resolved.isGuildMember).toBe(false);
    expect(resolved.isGuildAdmin).toBe(false);
    expect(resolved.isOwner).toBe(false);
  });

  it("resolves to an empty set after the assignment is removed and the cache is invalidated", async () => {
    const prisma = getPrisma();
    const guildId = "dda-cache-invalidate";
    const userId = "user-7";
    mockPlainMember(guildId);

    const role = await prisma.dashboardRole.create({
      data: { guildId, name: "Temp Staff", permissions: JSON.stringify(["tickets.list.view"]) },
    });
    await prisma.dashboardRoleAssignment.create({
      data: { guildId, userId, roleId: role.id, assignedBy: "owner" },
    });

    const before = await resolveUserPermissions(userId, guildId);
    expect(before.permissions).toEqual(new Set(["tickets.list.view"]));

    await prisma.dashboardRoleAssignment.deleteMany({ where: { guildId, userId } });
    invalidatePermissionCache(guildId, userId);

    const after = await resolveUserPermissions(userId, guildId);
    expect(after.permissions).toEqual(new Set());
  });
});
