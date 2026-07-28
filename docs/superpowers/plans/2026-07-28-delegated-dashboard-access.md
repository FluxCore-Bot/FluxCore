# Delegated Dashboard Access + Generated Permission Registry — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a guild member with explicit dashboard grants see and manage a server without Discord `MANAGE_GUILD`, and derive the permission registry from the route table instead of a hand-maintained constant.

**Architecture:** `resolveUserPermissions` stops treating live Discord admin authority as a prerequisite and instead treats it as one of three sources of permissions (owner → `*`, admin → `*` or role grants, member → explicit grants only). The route gate `requireGuildAdmin` is renamed `requireGuildAccess` and authorizes on "resolved permission set is non-empty". Separately, `requirePermission(...)` self-registers every key it enforces, so the registry is a byproduct of route registration rather than a parallel list.

**Tech Stack:** Fastify 5, Prisma 7, React 19, TanStack Query/Router, Vitest 4, Zod, react-i18next, Tailwind 4 + shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-07-28-delegated-dashboard-access-design.md`

## Global Constraints

- All `pnpm` commands run inside Docker. Never run `pnpm add`/`pnpm install` on the host.
- Strict TypeScript. No `any`. No `as` casts — **including in test files**. Narrow to a structural type instead of naming a wide class.
- Never read or write `.env` files.
- Tests are mandatory for every task. Mock the logger and all Discord API calls; never mock a pure data/constants module.
- Locale source of truth is `packages/i18n/src/locales/<lang>/*.json` (48 languages). The app serves `dist/locales`. New user-facing strings must be translated in **all 48 locales** in the same change — English placeholders block a merge.
- `JSON.stringify(obj, null, 2)` is **not** format-preserving for these locale files (some are semi-compact; 17 contain `\u` escapes). Only round-trip a file when a no-op round-trip is byte-identical; otherwise splice text.
- Dashboard UI uses existing shadcn/ui wrappers in `apps/dashboard/src/client/shared/ui/`. Lucide icons via the `Icon` component. Never fill Lucide icons.
- Commit after every task. Branch: `feat/delegated-dashboard-access`.
- Verification commands: `pnpm typecheck`, `pnpm test`, `pnpm test:integration`. Note `pnpm typecheck` does **not** cover `apps/dashboard/tests/**` — a green typecheck says nothing about test files; run the tests.

---

### Task 1: `getGuildAuthority` — one live authority lookup

Today `isUserGuildAdmin` answers only "is admin". The delegated path also needs "is a member at all", and fetching that twice would double the Discord calls.

**Files:**

- Modify: `apps/dashboard/src/server/shared/guildAuthz.ts`
- Test: `apps/dashboard/tests/server/shared/guildAuthz.test.ts`

**Interfaces:**

- Consumes: `getGuildOwnerId`, `getGuildMember`, `getGuildRoles` from `./discordApi.js`; `canManageGuild` from `./guildPermissions.js`.
- Produces: `export interface GuildAuthority { isOwner: boolean; isAdmin: boolean; isMember: boolean }` and `export async function getGuildAuthority(guildId: string, userId: string): Promise<GuildAuthority>`. `isUserGuildAdmin(guildId, userId): Promise<boolean>` keeps its signature.

- [ ] **Step 1: Write the failing tests**

Append to `apps/dashboard/tests/server/shared/guildAuthz.test.ts` (reuse the existing mocks at the top of that file — do not add new ones):

```typescript
describe("getGuildAuthority", () => {
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
```

Add `getGuildAuthority` to the existing import from `../../../src/server/shared/guildAuthz.js` in that test file.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --filter @fluxcore/dashboard test -- tests/server/shared/guildAuthz.test.ts
```

Expected: FAIL — `getGuildAuthority is not a function`.

- [ ] **Step 3: Implement**

In `apps/dashboard/src/server/shared/guildAuthz.ts`, keep `computeBasePermissions` as-is and replace the exported `isUserGuildAdmin` with:

```typescript
/** A user's live authority in a guild, from the bot's view of Discord. */
export interface GuildAuthority {
  isOwner: boolean;
  /** Owner, Administrator, or Manage Server. */
  isAdmin: boolean;
  /** Currently in the guild at all. */
  isMember: boolean;
}

/**
 * Authoritative, LIVE authority check, computed from the bot's view of Discord
 * rather than the OAuth session snapshot, so access revoked on Discord is
 * honored — subject only to the short discordApi cache TTL.
 *
 * Answers owner / admin / member in one member fetch, because the delegated
 * (non-admin) permission path needs membership and the admin path needs both.
 */
export async function getGuildAuthority(
  guildId: string,
  userId: string,
): Promise<GuildAuthority> {
  const ownerId = await getGuildOwnerId(guildId);
  if (ownerId === userId) {
    return { isOwner: true, isAdmin: true, isMember: true };
  }

  const member = await getGuildMember(guildId, userId);
  if (!member) {
    return { isOwner: false, isAdmin: false, isMember: false };
  }

  const roles = await getGuildRoles(guildId);
  const perms = computeBasePermissions(guildId, member.roles, roles);
  return {
    isOwner: false,
    isAdmin: canManageGuild(perms.toString()),
    isMember: true,
  };
}

/**
 * True when the user currently has admin authority (owner, Administrator, or
 * Manage Server) in the guild. Thin wrapper over {@link getGuildAuthority}.
 */
export async function isUserGuildAdmin(
  guildId: string,
  userId: string,
): Promise<boolean> {
  const { isAdmin } = await getGuildAuthority(guildId, userId);
  return isAdmin;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm --filter @fluxcore/dashboard test -- tests/server/shared/guildAuthz.test.ts
pnpm typecheck
```

Expected: PASS, including the pre-existing `isUserGuildAdmin` tests.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/server/shared/guildAuthz.ts apps/dashboard/tests/server/shared/guildAuthz.test.ts
git commit -m "refactor(dashboard): answer owner/admin/member in one authority lookup"
```

---

### Task 2: Delegated permission resolution

**Files:**

- Modify: `apps/dashboard/src/server/shared/permissions.ts:33-150`
- Test: `apps/dashboard/tests/server/shared/permissions-resolve.test.ts` (create)

**Interfaces:**

- Consumes: `getGuildAuthority` from Task 1.
- Produces: `ResolvedPermissions` gains `isGuildMember: boolean`. `resolveUserPermissions(userId, guildId)` keeps its signature.

Resolution table (from the spec):

| User | `requirePermissions: false` | `requirePermissions: true` |
|---|---|---|
| Owner | `*` | `*` |
| Live admin | `*` | assignments ∪ `isDefault` roles ∪ overrides |
| Member with grants | assignments ∪ overrides | assignments ∪ overrides |
| Member without grants | ∅ | ∅ |
| Non-member | ∅ | ∅ |

`isDefault` roles are merged **only** on the admin path — that is what stops the toggle from admitting every member at once.

- [ ] **Step 1: Write the failing tests**

Create `apps/dashboard/tests/server/shared/permissions-resolve.test.ts`:

```typescript
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

const { resolveUserPermissions, invalidatePermissionCache } = await import(
  "../../../src/server/shared/permissions.js"
);

const TICKET_ROLE = {
  id: "role-1",
  permissions: JSON.stringify(["tickets.list.view", "tickets.list.manage"]),
};

describe("resolveUserPermissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidatePermissionCache("guild-1");
    mockFindGuildSettings.mockResolvedValue({ requirePermissions: false });
    mockFindAssignments.mockResolvedValue([]);
    mockFindDefaultRoles.mockResolvedValue([]);
    mockFindUserPermissions.mockResolvedValue([]);
  });

  it("grants the owner everything", async () => {
    mockGetGuildAuthority.mockResolvedValue({ isOwner: true, isAdmin: true, isMember: true });

    const resolved = await resolveUserPermissions("user-1", "guild-1");

    expect([...resolved.permissions]).toEqual(["*"]);
    expect(resolved.isOwner).toBe(true);
    expect(resolved.isGuildMember).toBe(true);
  });

  it("grants an admin everything in legacy mode", async () => {
    mockGetGuildAuthority.mockResolvedValue({ isOwner: false, isAdmin: true, isMember: true });
    mockFindGuildSettings.mockResolvedValue({ requirePermissions: false });

    const resolved = await resolveUserPermissions("user-1", "guild-1");

    expect([...resolved.permissions]).toEqual(["*"]);
    expect(resolved.isGuildAdmin).toBe(true);
  });

  it("restricts an admin to role grants plus default roles when the system is on", async () => {
    mockGetGuildAuthority.mockResolvedValue({ isOwner: false, isAdmin: true, isMember: true });
    mockFindGuildSettings.mockResolvedValue({ requirePermissions: true });
    mockFindAssignments.mockResolvedValue([{ roleId: "role-1", role: TICKET_ROLE }]);
    mockFindDefaultRoles.mockResolvedValue([
      { id: "role-2", permissions: JSON.stringify(["logging.entries.view"]) },
    ]);

    const resolved = await resolveUserPermissions("user-1", "guild-1");

    expect([...resolved.permissions].sort()).toEqual([
      "logging.entries.view",
      "tickets.list.manage",
      "tickets.list.view",
    ]);
  });

  it("grants a non-admin member exactly their explicit grants", async () => {
    mockGetGuildAuthority.mockResolvedValue({ isOwner: false, isAdmin: false, isMember: true });
    mockFindGuildSettings.mockResolvedValue({ requirePermissions: true });
    mockFindAssignments.mockResolvedValue([{ roleId: "role-1", role: TICKET_ROLE }]);
    mockFindUserPermissions.mockResolvedValue([{ permission: "logging.entries.view" }]);

    const resolved = await resolveUserPermissions("user-1", "guild-1");

    expect([...resolved.permissions].sort()).toEqual([
      "logging.entries.view",
      "tickets.list.view",
      "tickets.list.manage",
    ].sort());
    expect(resolved.isGuildAdmin).toBe(false);
    expect(resolved.isGuildMember).toBe(true);
  });

  it("grants a non-admin member their grants in legacy mode too", async () => {
    mockGetGuildAuthority.mockResolvedValue({ isOwner: false, isAdmin: false, isMember: true });
    mockFindGuildSettings.mockResolvedValue({ requirePermissions: false });
    mockFindAssignments.mockResolvedValue([{ roleId: "role-1", role: TICKET_ROLE }]);

    const resolved = await resolveUserPermissions("user-1", "guild-1");

    expect([...resolved.permissions].sort()).toEqual([
      "tickets.list.manage",
      "tickets.list.view",
    ]);
  });

  it("never applies default roles to a non-admin member", async () => {
    mockGetGuildAuthority.mockResolvedValue({ isOwner: false, isAdmin: false, isMember: true });
    mockFindGuildSettings.mockResolvedValue({ requirePermissions: true });
    mockFindDefaultRoles.mockResolvedValue([
      { id: "role-2", permissions: JSON.stringify(["logging.entries.view"]) },
    ]);

    const resolved = await resolveUserPermissions("user-1", "guild-1");

    expect(resolved.permissions.size).toBe(0);
  });

  it("gives a non-member nothing even with a stale grant row", async () => {
    mockGetGuildAuthority.mockResolvedValue({ isOwner: false, isAdmin: false, isMember: false });
    mockFindAssignments.mockResolvedValue([{ roleId: "role-1", role: TICKET_ROLE }]);

    const resolved = await resolveUserPermissions("user-1", "guild-1");

    expect(resolved.permissions.size).toBe(0);
    expect(resolved.isGuildMember).toBe(false);
    expect(mockFindAssignments).not.toHaveBeenCalled();
  });

  it("tolerates a role whose permissions column is not valid JSON", async () => {
    mockGetGuildAuthority.mockResolvedValue({ isOwner: false, isAdmin: false, isMember: true });
    mockFindAssignments.mockResolvedValue([
      { roleId: "role-1", role: { id: "role-1", permissions: "not json" } },
    ]);

    const resolved = await resolveUserPermissions("user-1", "guild-1");

    expect(resolved.permissions.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --filter @fluxcore/dashboard test -- tests/server/shared/permissions-resolve.test.ts
```

Expected: FAIL — `getGuildAuthority` is not called (the module still imports `isUserGuildAdmin`), and `isGuildMember` is undefined.

- [ ] **Step 3: Implement**

In `apps/dashboard/src/server/shared/permissions.ts`:

Replace the imports of `getGuildOwnerId` / `isUserGuildAdmin` with:

```typescript
import { getGuildAuthority } from "./guildAuthz.js";
```

(`getGuildOwnerId` is no longer needed here — `getGuildAuthority` answers ownership.)

Extend the cache entry and the result type with `isGuildMember`:

```typescript
interface CachedPermissions {
  permissions: Set<string>;
  isOwner: boolean;
  isGuildAdmin: boolean;
  isGuildMember: boolean;
  expiresAt: number;
}

export interface ResolvedPermissions {
  permissions: Set<string>;
  isOwner: boolean;
  /** Whether the user currently has live Discord admin authority in the guild. */
  isGuildAdmin: boolean;
  /** Whether the user is currently in the guild at all. */
  isGuildMember: boolean;
}
```

Carry `isGuildMember` through `cacheResult` and through the cache-hit early return.

Replace the body of `resolveUserPermissions` after the cache lookup with:

```typescript
  const authority = await getGuildAuthority(guildId, userId);

  if (authority.isOwner) {
    return cacheResult(key, {
      permissions: new Set(["*"]),
      isOwner: true,
      isGuildAdmin: true,
      isGuildMember: true,
    });
  }

  // Not in the guild → no authority, and no reason to read grant rows.
  if (!authority.isMember) {
    return cacheResult(key, {
      permissions: new Set(),
      isOwner: false,
      isGuildAdmin: false,
      isGuildMember: false,
    });
  }

  const prisma = getPrisma();

  // `requirePermissions` governs whether ADMINS are constrained. It never gates
  // explicit grants, which resolve the same way in both modes.
  if (authority.isAdmin) {
    const guildSettings = await prisma.dashboardGuildSettings.findUnique({
      where: { guildId },
    });
    if (!guildSettings?.requirePermissions) {
      return cacheResult(key, {
        permissions: new Set(["*"]),
        isOwner: false,
        isGuildAdmin: true,
        isGuildMember: true,
      });
    }
  }

  const permissions = await loadGrantedPermissions(guildId, userId, {
    // Default roles are an admin baseline only. Applying them to every member
    // would turn the requirePermissions toggle into a server-wide grant.
    includeDefaultRoles: authority.isAdmin,
  });

  return cacheResult(key, {
    permissions,
    isOwner: false,
    isGuildAdmin: authority.isAdmin,
    isGuildMember: true,
  });
}

/**
 * Merge a user's dashboard role permissions and per-user overrides into one set.
 */
async function loadGrantedPermissions(
  guildId: string,
  userId: string,
  options: { includeDefaultRoles: boolean },
): Promise<Set<string>> {
  const prisma = getPrisma();

  const assignments = await prisma.dashboardRoleAssignment.findMany({
    where: { guildId, userId },
    include: { role: true },
  });

  const defaultRoles = options.includeDefaultRoles
    ? await prisma.dashboardRole.findMany({ where: { guildId, isDefault: true } })
    : [];

  const allRoles = [
    ...assignments.map((a) => a.role),
    ...defaultRoles.filter((dr) => !assignments.some((a) => a.roleId === dr.id)),
  ];

  const permissions = new Set<string>();
  for (const role of allRoles) {
    for (const perm of safeJsonParse<string[]>(role.permissions, [])) {
      permissions.add(perm);
    }
  }

  const userPerms = await prisma.dashboardUserPermission.findMany({
    where: { guildId, userId },
  });
  for (const up of userPerms) {
    permissions.add(up.permission);
  }

  return permissions;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm --filter @fluxcore/dashboard test -- tests/server/shared/permissions-resolve.test.ts
pnpm typecheck
```

Expected: PASS. `pnpm typecheck` may now flag other call sites constructing `ResolvedPermissions` literals — fix them by adding `isGuildMember`.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/server/shared/permissions.ts apps/dashboard/tests/server/shared/permissions-resolve.test.ts
git commit -m "feat(permissions): resolve explicit grants for non-admin guild members"
```

---

### Task 3: `requireGuildAccess` — gate on permissions, not admin-ness

**Files:**

- Modify: `apps/dashboard/src/server/shared/middleware.ts:58-89`
- Modify (mechanical rename): all 21 files under `apps/dashboard/src/server/features/*/` that import `requireGuildAdmin`
- Test: `apps/dashboard/tests/server/shared/middleware.test.ts`

**Interfaces:**

- Consumes: `resolveUserPermissions` (Task 2).
- Produces: `requireGuildAccess(request, reply)` replaces `requireGuildAdmin`. No other export changes.

- [ ] **Step 1: Write the failing tests**

In `apps/dashboard/tests/server/shared/middleware.test.ts`, rename the import and the `describe("requireGuildAdmin")` block to `requireGuildAccess`, add `isGuildMember: true` to the default `mockResolveUserPermissions` value in `beforeEach`, and add these cases inside that block:

```typescript
    it("allows a non-admin member holding explicit grants", async () => {
      mockResolveUserPermissions.mockResolvedValue({
        permissions: new Set(["tickets.list.view"]),
        isOwner: false,
        isGuildAdmin: false,
        isGuildMember: true,
      });
      const request = createMockRequest({
        session: { userId: "user-1" },
        params: { guildId: "guild-1" },
      });
      const reply = createMockReply();

      await requireGuildAccess(request, reply);

      expect(reply.code).not.toHaveBeenCalled();
      expect(request.resolvedPermissions?.permissions.has("tickets.list.view")).toBe(true);
    });

    it("rejects a member holding no grants", async () => {
      mockResolveUserPermissions.mockResolvedValue({
        permissions: new Set(),
        isOwner: false,
        isGuildAdmin: false,
        isGuildMember: true,
      });
      const request = createMockRequest({
        session: { userId: "user-1" },
        params: { guildId: "guild-1" },
      });
      const reply = createMockReply();

      await requireGuildAccess(request, reply);

      expect(reply.code).toHaveBeenCalledWith(403);
    });

    it("rejects a non-member", async () => {
      mockResolveUserPermissions.mockResolvedValue({
        permissions: new Set(),
        isOwner: false,
        isGuildAdmin: false,
        isGuildMember: false,
      });
      const request = createMockRequest({
        session: { userId: "user-1" },
        params: { guildId: "guild-1" },
      });
      const reply = createMockReply();

      await requireGuildAccess(request, reply);

      expect(reply.code).toHaveBeenCalledWith(403);
    });
```

The existing cases (bot not in guild → 403 `botNotInGuild`; admin → pass) stay and must keep passing.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --filter @fluxcore/dashboard test -- tests/server/shared/middleware.test.ts
```

Expected: FAIL — `requireGuildAccess` is not exported.

- [ ] **Step 3: Implement — rename and re-gate**

In `apps/dashboard/src/server/shared/middleware.ts`, replace `requireGuildAdmin` with:

```typescript
/**
 * Gate for every guild-scoped route: does this user have ANY authority here?
 *
 * Authority comes from three places — guild ownership, live Discord admin
 * authority, or explicit dashboard grants (a dashboard role assignment or a
 * per-user override). A member with grants but no MANAGE_GUILD passes here and
 * is then narrowed by `requirePermission` on each route.
 */
export async function requireGuildAccess(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { guildId } = request.params as { guildId: string };
  const session = request.session!;

  if (!(await isBotInGuild(guildId))) {
    reply.code(403).send({
      error: request.t("errors:permissions.botNotInGuild"),
      errorKey: "errors:permissions.botNotInGuild",
    });
    return;
  }

  // Authorize from LIVE Discord authority + DB grants, not the cached OAuth
  // session snapshot — so access revoked on Discord is honored here.
  const resolved = await resolveUserPermissions(session.userId, guildId);
  const authorized =
    resolved.isOwner || resolved.isGuildAdmin || resolved.permissions.size > 0;
  if (!authorized) {
    reply.code(403).send({
      error: request.t("errors:permissions.noGuildPermission"),
      errorKey: "errors:permissions.noGuildPermission",
    });
    return;
  }

  request.resolvedPermissions = resolved;
}
```

Then rename every call site:

```bash
grep -rl "requireGuildAdmin" apps/dashboard/src apps/dashboard/tests \
  | xargs sed -i 's/requireGuildAdmin/requireGuildAccess/g'
grep -rn "requireGuildAdmin" apps/dashboard || echo "no references left"
```

- [ ] **Step 4: Run the full dashboard suite**

```bash
pnpm --filter @fluxcore/dashboard test
pnpm typecheck
```

Expected: PASS. Every route test that mocked `resolveUserPermissions` with `permissions: new Set(["*"])` still passes, since a non-empty set authorizes.

- [ ] **Step 5: Commit**

```bash
git add -A apps/dashboard
git commit -m "feat(permissions): gate guild routes on any authority, not admin-ness"
```

---

### Task 4: `dashboard.lookups.view` on the Discord passthrough routes

The four routes in `discord/routes.ts` carry no permission key, so after Task 3 anyone with any grant could call them. They return channel, role, and member names that nearly every picker needs.

**Files:**

- Modify: `apps/dashboard/src/server/features/discord/routes.ts` (4 route definitions)
- Modify: `packages/types/src/dashboard-permissions.ts` (add the key to the registry's `dashboard` module and to every preset)
- Test: `apps/dashboard/tests/server/features/discord/discord.test.ts`

**Interfaces:**

- Consumes: `requirePermission` from `../../shared/middleware.js` (already imported? if not, add it).
- Produces: permission key `dashboard.lookups.view`, enforced on `GET /api/guilds/:guildId/members`, `/channels`, `/roles`, and `POST /api/guilds/:guildId/refresh`.

- [ ] **Step 1: Write the failing test**

Add to `apps/dashboard/tests/server/features/discord/discord.test.ts` (follow the mocking already at the top of that file; make `hasPermission` controllable if it is currently a fixed `true` stub):

```typescript
  it("returns 403 when the caller lacks dashboard.lookups.view", async () => {
    mockHasPermission.mockReturnValue(false);
    mockGetSession.mockResolvedValue({ userId: "user-1", username: "u", guilds: [] });

    const res = await app.inject({
      method: "GET",
      url: "/api/guilds/guild-1/channels",
      cookies: { session: "sid" },
    });

    expect(res.statusCode).toBe(403);
  });
```

- [ ] **Step 2: Run it to verify it fails**

```bash
pnpm --filter @fluxcore/dashboard test -- tests/server/features/discord/discord.test.ts
```

Expected: FAIL — returns 200 because no permission is required.

- [ ] **Step 3: Implement**

In `apps/dashboard/src/server/features/discord/routes.ts`, import `requirePermission` and change each of the four `preHandler` arrays:

```typescript
preHandler: [requireAuth, requireGuildAccess, requirePermission("dashboard.lookups.view")],
```

In `packages/types/src/dashboard-permissions.ts`, add to the `dashboard` module's `permissions` array:

```typescript
      { key: "dashboard.lookups.view", label: "Use Pickers", description: "Look up channels, roles, and members for pickers" },
```

and add `"dashboard.lookups.view"` to the `permissions` array of the `moderator` and `content-manager` presets (`full-admin` has `*` and `viewer` matches `*.*.view`, so both already cover it).

- [ ] **Step 4: Run the tests**

```bash
pnpm --filter @fluxcore/dashboard test -- tests/server/features/discord/discord.test.ts
pnpm --filter @fluxcore/dashboard test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/server/features/discord/routes.ts packages/types/src/dashboard-permissions.ts apps/dashboard/tests/server/features/discord/discord.test.ts
git commit -m "feat(permissions): require dashboard.lookups.view for Discord passthroughs"
```

---

### Task 5: Close the role-assignment escalation hole

Escalation guards already exist on role create (`roles-routes.ts:129`), role update (`:250`), preset create (`:555`), and user overrides (`routes.ts:161`). `POST /dashboard-roles/:roleId/members` has none — a `dashboard.roles.manage` holder can assign themselves an existing Full Admin role.

**Files:**

- Modify: `apps/dashboard/src/server/features/permissions/roles-routes.ts` (the `POST .../members` handler, around line 408)
- Test: `apps/dashboard/tests/server/features/permissions/dashboardRoles.test.ts`

**Interfaces:**

- Consumes: `matchPermission` from `@fluxcore/types` (already imported in this file); `request.resolvedPermissions` from Task 3.
- Produces: no new exports.

- [ ] **Step 1: Write the failing tests**

Add to `apps/dashboard/tests/server/features/permissions/dashboardRoles.test.ts`, in the assignment describe block:

```typescript
    it("refuses to assign a role holding permissions the caller lacks", async () => {
      mockResolveUserPermissions.mockResolvedValue({
        permissions: new Set(["dashboard.roles.manage"]),
        isOwner: false,
        isGuildAdmin: false,
        isGuildMember: true,
      });
      mockRoleFindUnique.mockResolvedValue({
        id: "role-1",
        guildId: "guild-1",
        name: "Full Admin",
        permissions: JSON.stringify(["*"]),
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/dashboard-roles/role-1/members",
        cookies: { session: "sid" },
        payload: { userId: "user-2" },
      });

      expect(res.statusCode).toBe(403);
      expect(mockAssignmentCreate).not.toHaveBeenCalled();
    });

    it("refuses to assign any role to yourself", async () => {
      mockResolveUserPermissions.mockResolvedValue({
        permissions: new Set(["dashboard.roles.manage", "tickets.list.view"]),
        isOwner: false,
        isGuildAdmin: false,
        isGuildMember: true,
      });
      mockRoleFindUnique.mockResolvedValue({
        id: "role-1",
        guildId: "guild-1",
        name: "Ticket Staff",
        permissions: JSON.stringify(["tickets.list.view"]),
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/dashboard-roles/role-1/members",
        cookies: { session: "sid" },
        payload: { userId: "user-1" },
      });

      expect(res.statusCode).toBe(403);
      expect(mockAssignmentCreate).not.toHaveBeenCalled();
    });

    it("lets the owner assign anything, including to themselves", async () => {
      mockResolveUserPermissions.mockResolvedValue({
        permissions: new Set(["*"]),
        isOwner: true,
        isGuildAdmin: true,
        isGuildMember: true,
      });
      mockRoleFindUnique.mockResolvedValue({
        id: "role-1",
        guildId: "guild-1",
        name: "Full Admin",
        permissions: JSON.stringify(["*"]),
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/dashboard-roles/role-1/members",
        cookies: { session: "sid" },
        payload: { userId: "user-1" },
      });

      expect(res.statusCode).toBe(201);
    });

    it("allows assigning a role whose permissions the caller holds", async () => {
      mockResolveUserPermissions.mockResolvedValue({
        permissions: new Set(["dashboard.roles.manage", "tickets.*"]),
        isOwner: false,
        isGuildAdmin: false,
        isGuildMember: true,
      });
      mockRoleFindUnique.mockResolvedValue({
        id: "role-1",
        guildId: "guild-1",
        name: "Ticket Staff",
        permissions: JSON.stringify(["tickets.list.view"]),
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/guilds/guild-1/dashboard-roles/role-1/members",
        cookies: { session: "sid" },
        payload: { userId: "user-2" },
      });

      expect(res.statusCode).toBe(201);
    });
```

Use whatever mock names that file already defines for `prisma.dashboardRole.findUnique` and `prisma.dashboardRoleAssignment.create`; the names above (`mockRoleFindUnique`, `mockAssignmentCreate`) are the expected ones — match the file.

- [ ] **Step 2: Run them to verify they fail**

```bash
pnpm --filter @fluxcore/dashboard test -- tests/server/features/permissions/dashboardRoles.test.ts
```

Expected: FAIL — assignment returns 201 in the first two cases.

- [ ] **Step 3: Implement**

In the `POST .../members` handler, immediately after the existing `role`/404 check and before the `try` block:

```typescript
      // Assignment grants everything the role holds, so it is an escalation
      // vector in its own right: without this a `dashboard.roles.manage` holder
      // could hand themselves an existing Full Admin role.
      if (!request.resolvedPermissions?.isOwner) {
        if (userId === session.userId) {
          reply.code(403).send({ error: "Cannot assign a role to yourself" });
          return;
        }

        const callerPerms = request.resolvedPermissions!.permissions;
        const rolePerms = safeParsePermissions(role.permissions);
        for (const perm of rolePerms) {
          if (!matchPermission(callerPerms, perm)) {
            reply.code(403).send({
              error: "Cannot grant permissions you don't have",
              permission: perm,
            });
            return;
          }
        }
      }
```

Add this helper at the bottom of the file, next to `isValidPermissionKey`:

```typescript
function safeParsePermissions(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed)
      ? parsed.filter((p): p is string => typeof p === "string")
      : [];
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm --filter @fluxcore/dashboard test -- tests/server/features/permissions/dashboardRoles.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/server/features/permissions/roles-routes.ts apps/dashboard/tests/server/features/permissions/dashboardRoles.test.ts
git commit -m "fix(permissions): block privilege escalation via role assignment"
```

---

### Task 6: `/api/guilds` returns delegated guilds

**Files:**

- Modify: `apps/dashboard/src/server/features/guilds/routes.ts:9-58`
- Test: `apps/dashboard/tests/server/features/guilds/guilds.test.ts`

**Interfaces:**

- Consumes: `getPrisma` from `@fluxcore/database`.
- Produces: each guild object gains `access: "admin" | "delegated"`. Response schema updated so Fastify does not strip the new field.

- [ ] **Step 1: Write the failing tests**

Add to `apps/dashboard/tests/server/features/guilds/guilds.test.ts`. The file currently mocks `@fluxcore/database`? If not, add this mock next to the others at the top:

```typescript
const mockAssignmentFindMany = vi.fn().mockResolvedValue([]);
const mockUserPermissionFindMany = vi.fn().mockResolvedValue([]);
vi.mock("@fluxcore/database", () => ({
  getPrisma: () => ({
    dashboardRoleAssignment: { findMany: mockAssignmentFindMany },
    dashboardUserPermission: { findMany: mockUserPermissionFindMany },
  }),
}));
```

Tests:

```typescript
    it("includes a guild the user cannot manage but holds a dashboard grant in", async () => {
      mockGetSession.mockResolvedValueOnce({
        userId: "user-1",
        username: "testuser",
        guilds: [
          { id: "g1", name: "Guild 1", icon: null, permissions: "0" },
          { id: "g2", name: "Guild 2", icon: null, permissions: "0" },
        ],
      });
      mockAssignmentFindMany.mockResolvedValueOnce([{ guildId: "g1" }]);

      const res = await app.inject({ method: "GET", url: "/api/guilds", cookies: { session: "sid" } });

      expect(res.statusCode).toBe(200);
      expect(res.json<Array<{ id: string; access: string }>>()).toEqual([
        expect.objectContaining({ id: "g1", access: "delegated" }),
      ]);
    });

    it("includes a guild granted only through a per-user override", async () => {
      mockGetSession.mockResolvedValueOnce({
        userId: "user-1",
        username: "testuser",
        guilds: [{ id: "g1", name: "Guild 1", icon: null, permissions: "0" }],
      });
      mockUserPermissionFindMany.mockResolvedValueOnce([{ guildId: "g1" }]);

      const res = await app.inject({ method: "GET", url: "/api/guilds", cookies: { session: "sid" } });

      expect(res.json<Array<{ id: string }>>()).toHaveLength(1);
    });

    it("marks manageable guilds as admin access", async () => {
      mockGetSession.mockResolvedValueOnce({
        userId: "user-1",
        username: "testuser",
        guilds: [{ id: "g1", name: "Guild 1", icon: null, permissions: MANAGE_GUILD.toString() }],
      });

      const res = await app.inject({ method: "GET", url: "/api/guilds", cookies: { session: "sid" } });

      expect(res.json<Array<{ access: string }>>()[0].access).toBe("admin");
    });

    it("ignores a grant for a guild the user is no longer in", async () => {
      mockGetSession.mockResolvedValueOnce({
        userId: "user-1",
        username: "testuser",
        guilds: [{ id: "g1", name: "Guild 1", icon: null, permissions: "0" }],
      });
      mockAssignmentFindMany.mockResolvedValueOnce([{ guildId: "g-gone" }]);

      const res = await app.inject({ method: "GET", url: "/api/guilds", cookies: { session: "sid" } });

      expect(res.json<Array<unknown>>()).toEqual([]);
    });

    it("counts a guild once when the user is both an admin and a grantee", async () => {
      mockGetSession.mockResolvedValueOnce({
        userId: "user-1",
        username: "testuser",
        guilds: [{ id: "g1", name: "Guild 1", icon: null, permissions: MANAGE_GUILD.toString() }],
      });
      mockAssignmentFindMany.mockResolvedValueOnce([{ guildId: "g1" }]);

      const res = await app.inject({ method: "GET", url: "/api/guilds", cookies: { session: "sid" } });

      expect(res.json<Array<{ access: string }>>()).toEqual([
        expect.objectContaining({ id: "g1", access: "admin" }),
      ]);
    });
```

Use `res.json<T>()` with the generic — never a cast.

- [ ] **Step 2: Run them to verify they fail**

```bash
pnpm --filter @fluxcore/dashboard test -- tests/server/features/guilds/guilds.test.ts
```

Expected: FAIL — delegated guilds are filtered out; `access` is undefined.

- [ ] **Step 3: Implement**

In `apps/dashboard/src/server/features/guilds/routes.ts`, add `import { getPrisma } from "@fluxcore/database";` and replace `buildManageableGuilds`:

```typescript
/**
 * Guild IDs where this user holds an explicit dashboard grant — a role
 * assignment or a per-user override. These admit a user who has no Discord
 * MANAGE_GUILD at all.
 */
async function guildIdsWithGrants(userId: string): Promise<Set<string>> {
  const prisma = getPrisma();
  const [assignments, overrides] = await Promise.all([
    prisma.dashboardRoleAssignment.findMany({
      where: { userId },
      select: { guildId: true },
      distinct: ["guildId"],
    }),
    prisma.dashboardUserPermission.findMany({
      where: { userId },
      select: { guildId: true },
      distinct: ["guildId"],
    }),
  ]);

  return new Set([
    ...assignments.map((a) => a.guildId),
    ...overrides.map((o) => o.guildId),
  ]);
}

/**
 * Filter the user's OAuth guilds down to the ones they can open in the
 * dashboard: they own it, have Administrator/Manage Server, or hold an explicit
 * dashboard grant there.
 *
 * Intersecting grants with the OAuth guild list is also the membership check —
 * a grant row for a guild the user has left cannot resurface it.
 *
 * Guilds the bot has NOT been added to are included, flagged with
 * `botPresent: false`, so the dashboard can offer a preselected invite instead
 * of hiding them. This grants no access on its own — `requireGuildAccess` still
 * rejects guild-scoped requests with `botNotInGuild`.
 *
 * Bot-present guilds sort first so the actionable cards lead the grid.
 */
async function buildManageableGuilds(userId: string, guilds: OAuthGuild[]) {
  const grantedIds = await guildIdsWithGrants(userId);

  const visible = guilds
    .map((guild) => ({
      guild,
      isAdmin: guild.owner || canManageGuild(guild.permissions),
    }))
    .filter((entry) => entry.isAdmin || grantedIds.has(entry.guild.id));

  const checks = await Promise.all(
    visible.map(async (entry) => ({
      ...entry,
      botPresent: await isBotInGuild(entry.guild.id),
    })),
  );

  return checks
    .map((c) => ({
      id: c.guild.id,
      name: c.guild.name,
      icon: c.guild.icon,
      botPresent: c.botPresent,
      access: c.isAdmin ? "admin" : "delegated",
    }))
    .sort(
      (a, b) =>
        Number(b.botPresent) - Number(a.botPresent) ||
        a.name.localeCompare(b.name),
    );
}
```

Add `access: { type: "string" }` to `guildListResponseSchema`'s item properties, and update both call sites:

```typescript
      reply.send(await buildManageableGuilds(session.userId, session.guilds));
```

```typescript
      const guilds = await forceRefreshSessionGuilds(request.sessionId!);
      reply.send(await buildManageableGuilds(request.session!.userId, guilds));
```

- [ ] **Step 4: Run the tests**

```bash
pnpm --filter @fluxcore/dashboard test -- tests/server/features/guilds/
pnpm typecheck
```

Expected: PASS, including the pre-existing "excludes guilds the user cannot manage" test (no grants mocked → still excluded).

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/server/features/guilds/routes.ts apps/dashboard/tests/server/features/guilds/guilds.test.ts
git commit -m "feat(guilds): list guilds where the user holds dashboard grants"
```

---

### Task 7: Servers page shows delegated guilds

**Files:**

- Modify: `apps/dashboard/src/client/shared/lib/schemas.ts:12-19`
- Modify: `apps/dashboard/src/client/shared/components/GuildCard.tsx`
- Modify: `packages/i18n/src/locales/en/guilds.json` (+ 47 locales)
- Test: `apps/dashboard/tests/client/shared/components/GuildCard.test.tsx` (create)

**Interfaces:**

- Consumes: `access` field from Task 6.
- Produces: `Guild` type gains `access: "admin" | "delegated"`.

**Client test convention** (used by every existing client test, e.g. `tests/client/features/tempvoice/HubCard.test.tsx`): declare `// @vitest-environment jsdom` on line 1, mock `react-i18next` with an identity `t`, mock hooks directly rather than wrapping in providers, and plain `render`. Because `t` returns its key, assertions match **i18n keys**, not English.

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="#">{children}</a>,
}));

import { GuildCard } from "../../../../src/client/shared/components/GuildCard";

const baseGuild = { id: "g1", name: "Guild 1", icon: null, botPresent: true };

describe("GuildCard", () => {
  it("badges a delegated guild", () => {
    render(<GuildCard guild={{ ...baseGuild, access: "delegated" }} />);
    expect(screen.getByText("badge.delegated")).toBeInTheDocument();
  });

  it("does not badge an admin guild", () => {
    render(<GuildCard guild={{ ...baseGuild, access: "admin" }} />);
    expect(screen.queryByText("badge.delegated")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
pnpm --filter @fluxcore/dashboard test -- tests/client/GuildCard.test.tsx
```

Expected: FAIL — no badge rendered, and a type error on `access`.

- [ ] **Step 3: Implement**

`schemas.ts`:

```typescript
export const GuildSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string().nullable(),
  /** False when the user administers the guild but the bot has not been added. */
  botPresent: z.boolean(),
  /** "delegated" = access comes from dashboard grants, not Discord admin rights. */
  access: z.enum(["admin", "delegated"]),
});
```

`GuildCard.tsx` — in the bot-present branch, under the `<h3>`:

```tsx
        {guild.access === "delegated" && (
          <div className="mt-3">
            <Badge variant="outline">{t("badge.delegated")}</Badge>
          </div>
        )}
```

`GuildCard` currently has no `useTranslation` in its main export — add `const { t } = useTranslation("guilds");` there.

`packages/i18n/src/locales/en/guilds.json` — add under `badge`:

```json
    "delegated": "Delegated access"
```

Translate that one key in the other 47 locales (see the i18n procedure in Task 12, Step 3).

- [ ] **Step 4: Run the tests**

```bash
pnpm --filter @fluxcore/dashboard test
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/client/shared/lib/schemas.ts apps/dashboard/src/client/shared/components/GuildCard.tsx apps/dashboard/tests/client/GuildCard.test.tsx packages/i18n/src/locales
git commit -m "feat(guilds): badge servers reached through delegated access"
```

---

### Task 8: Collect permission keys from the route table

**Files:**

- Modify: `apps/dashboard/src/server/shared/middleware.ts` (self-registration in `requirePermission`)
- Create: `apps/dashboard/src/server/shared/permissionRegistry.ts`
- Modify: `apps/dashboard/src/server/index.ts` (call the validator after route registration)
- Test: `apps/dashboard/tests/server/shared/permissionRegistry.test.ts` (create)

**Interfaces:**

- Produces:
  - `getDeclaredPermissions(): ReadonlySet<string>` from `middleware.js`
  - `buildPermissionRegistry(keys: ReadonlySet<string>): PermissionModuleView[]` from `permissionRegistry.js`
  - `validatePermissionRegistry(keys: ReadonlySet<string>): void` — throws on an unknown module or a malformed key
  - `interface PermissionModuleView { key: string; icon: string; labelKey: string; permissions: PermissionView[] }`
  - `interface PermissionView { key: string; resourceKey: string; actionKey: string }`

Labels are i18n keys, not English text — the client translates them (Task 10).

- [ ] **Step 1: Write the failing tests**

Create `apps/dashboard/tests/server/shared/permissionRegistry.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  buildPermissionRegistry,
  validatePermissionRegistry,
} from "../../../src/server/shared/permissionRegistry.js";

describe("buildPermissionRegistry", () => {
  it("groups keys by module in MODULE_META order", () => {
    const registry = buildPermissionRegistry(
      new Set(["tickets.list.view", "dashboard.roles.view", "tickets.panels.manage"]),
    );

    expect(registry.map((m) => m.key)).toEqual(["dashboard", "tickets"]);
    expect(registry[1].permissions.map((p) => p.key)).toEqual([
      "tickets.list.view",
      "tickets.panels.manage",
    ]);
  });

  it("exposes i18n keys rather than English labels", () => {
    const [mod] = buildPermissionRegistry(new Set(["tickets.list.view"]));

    expect(mod.labelKey).toBe("permissions:permissionCategories.tickets");
    expect(mod.permissions[0]).toEqual({
      key: "tickets.list.view",
      resourceKey: "permissions:resources.list",
      actionKey: "permissions:permissionActions.view",
    });
  });

  it("carries the module icon", () => {
    const [mod] = buildPermissionRegistry(new Set(["moderation.cases.view"]));
    expect(mod.icon).toBe("Shield");
  });
});

describe("validatePermissionRegistry", () => {
  it("accepts well-formed keys in known modules", () => {
    expect(() =>
      validatePermissionRegistry(new Set(["tickets.list.view"])),
    ).not.toThrow();
  });

  it("rejects a key whose module has no metadata", () => {
    expect(() =>
      validatePermissionRegistry(new Set(["quests.list.view"])),
    ).toThrow(/quests/);
  });

  it("rejects a key that is not module.resource.action", () => {
    expect(() =>
      validatePermissionRegistry(new Set(["tickets.view"])),
    ).toThrow(/tickets\.view/);
  });

  it("rejects an unknown action verb", () => {
    expect(() =>
      validatePermissionRegistry(new Set(["tickets.list.obliterate"])),
    ).toThrow(/obliterate/);
  });
});
```

Add to `apps/dashboard/tests/server/shared/middleware.test.ts`:

```typescript
  describe("getDeclaredPermissions", () => {
    it("records every key passed to requirePermission", () => {
      requirePermission("tickets.list.view", "tickets.list.manage");

      const declared = getDeclaredPermissions();

      expect(declared.has("tickets.list.view")).toBe(true);
      expect(declared.has("tickets.list.manage")).toBe(true);
    });
  });
```

- [ ] **Step 2: Run them to verify they fail**

```bash
pnpm --filter @fluxcore/dashboard test -- tests/server/shared/permissionRegistry.test.ts tests/server/shared/middleware.test.ts
```

Expected: FAIL — module not found / `getDeclaredPermissions` not exported.

- [ ] **Step 3: Implement**

In `middleware.ts`, above `requirePermission`:

```typescript
/**
 * Every permission key any route enforces. Populated when `requirePermission`
 * runs at route-registration time, which makes the route table — not a
 * hand-maintained list — the source of truth for what permissions exist.
 */
const declaredPermissions = new Set<string>();

export function getDeclaredPermissions(): ReadonlySet<string> {
  return declaredPermissions;
}
```

and record the keys inside the factory, before the returned handler:

```typescript
export function requirePermission(...keys: string[]) {
  for (const key of keys) declaredPermissions.add(key);

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // ...unchanged...
  };
}
```

Create `apps/dashboard/src/server/shared/permissionRegistry.ts`:

```typescript
/**
 * The permission registry is derived from the route table: `requirePermission`
 * records each key it enforces, and this module turns that flat set into the
 * module → permission tree the dashboard renders. A key therefore cannot appear
 * in the UI without a route enforcing it, nor the reverse.
 *
 * Only presentation lives here. Labels are i18n keys; the client translates.
 */

/** Display metadata per module. Order is the order modules render in. */
const MODULE_META: Record<string, { icon: string; order: number }> = {
  dashboard: { icon: "LayoutDashboard", order: 0 },
  moderation: { icon: "Shield", order: 1 },
  actions: { icon: "Zap", order: 2 },
  logging: { icon: "ScrollText", order: 3 },
  welcome: { icon: "Hand", order: 4 },
  leveling: { icon: "TrendingUp", order: 5 },
  tickets: { icon: "Ticket", order: 6 },
  giveaways: { icon: "Gift", order: 7 },
  starboard: { icon: "Star", order: 8 },
  suggestions: { icon: "Lightbulb", order: 9 },
  roles: { icon: "Badge", order: 10 },
  tempvoice: { icon: "Mic", order: 11 },
  security: { icon: "ShieldAlert", order: 12 },
  scheduled: { icon: "Clock", order: 13 },
  commands: { icon: "Terminal", order: 14 },
};

/** Action verbs the key convention allows. */
const ACTIONS = new Set(["view", "manage", "execute", "purge"]);

export interface PermissionView {
  key: string;
  /** i18n key for the resource noun, e.g. "Cases". */
  resourceKey: string;
  /** i18n key for the action verb, e.g. "View". */
  actionKey: string;
}

export interface PermissionModuleView {
  key: string;
  icon: string;
  /** i18n key for the module name. */
  labelKey: string;
  permissions: PermissionView[];
}

export function buildPermissionRegistry(
  keys: ReadonlySet<string>,
): PermissionModuleView[] {
  const byModule = new Map<string, PermissionView[]>();

  for (const key of [...keys].sort()) {
    const [module, resource, action] = key.split(".");
    if (!module || !resource || !action) continue;

    const views = byModule.get(module) ?? [];
    views.push({
      key,
      resourceKey: `permissions:resources.${resource}`,
      actionKey: `permissions:permissionActions.${action}`,
    });
    byModule.set(module, views);
  }

  return [...byModule.entries()]
    .filter(([module]) => module in MODULE_META)
    .sort(([a], [b]) => MODULE_META[a].order - MODULE_META[b].order)
    .map(([module, permissions]) => ({
      key: module,
      icon: MODULE_META[module].icon,
      labelKey: `permissions:permissionCategories.${module}`,
      permissions,
    }));
}

/**
 * Fail fast when a route declares a key the UI could never render — an unknown
 * module, a malformed key, or an unknown action verb. Called once at boot.
 */
export function validatePermissionRegistry(keys: ReadonlySet<string>): void {
  const problems: string[] = [];

  for (const key of keys) {
    const parts = key.split(".");
    if (parts.length !== 3 || parts.some((p) => p.length === 0)) {
      problems.push(`"${key}" is not module.resource.action`);
      continue;
    }
    const [module, , action] = parts;
    if (!(module in MODULE_META)) {
      problems.push(`"${key}" has no MODULE_META entry for module "${module}"`);
    }
    if (!ACTIONS.has(action)) {
      problems.push(`"${key}" uses unknown action "${action}"`);
    }
  }

  if (problems.length > 0) {
    throw new Error(`Invalid permission registry:\n  ${problems.join("\n  ")}`);
  }
}
```

In `apps/dashboard/src/server/index.ts`, after the last `register*Routes(app)` call (line ~179):

```typescript
  // Routes are registered, so every requirePermission() has run — the declared
  // key set is now complete and can be checked.
  validatePermissionRegistry(getDeclaredPermissions());
```

with imports from `./shared/permissionRegistry.js` and `./shared/middleware.js`.

- [ ] **Step 4: Run the tests**

```bash
pnpm --filter @fluxcore/dashboard test -- tests/server/shared/
pnpm --filter @fluxcore/dashboard test
pnpm typecheck
```

Expected: PASS. If `validatePermissionRegistry` throws while building the app in `tests/server/index.test.ts`, a real route is declaring a bad key — fix the route, not the validator.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/server/shared/middleware.ts apps/dashboard/src/server/shared/permissionRegistry.ts apps/dashboard/src/server/index.ts apps/dashboard/tests/server/shared/permissionRegistry.test.ts apps/dashboard/tests/server/shared/middleware.test.ts
git commit -m "feat(permissions): derive the permission registry from the route table"
```

---

### Task 9: Retire the static registry

`ALL_PERMISSION_KEYS`, `expandWildcard`, and `resolveEffectivePermissions` all read the static registry. They become pure functions over a caller-supplied vocabulary.

**Files:**

- Modify: `packages/types/src/dashboard-permissions.ts` (delete `PERMISSION_REGISTRY`, `ALL_PERMISSION_KEYS`, `PermissionDefinition`, `PermissionModule`; re-signature two helpers)
- Modify: `packages/types/src/index.ts` (export list)
- Modify: `apps/dashboard/src/server/features/permissions/routes.ts` (2 call sites + `isValidPermKey` + the registry endpoint)
- Modify: `apps/dashboard/src/server/features/permissions/roles-routes.ts` (`isValidPermissionKey`)
- Test: `apps/dashboard/tests/server/shared/permissions.test.ts`

**Interfaces:**

- Consumes: `getDeclaredPermissions`, `buildPermissionRegistry` (Task 8).
- Produces:
  - `expandWildcard(pattern: string, allKeys: readonly string[]): string[]`
  - `resolveEffectivePermissions(granted: string[], allKeys: readonly string[]): string[]`
  - `ROLE_PRESETS` and `matchPermission` unchanged.

- [ ] **Step 1: Update the tests first**

In `apps/dashboard/tests/server/shared/permissions.test.ts`:

- Drop the `PERMISSION_REGISTRY` / `ALL_PERMISSION_KEYS` imports and the `describe("PERMISSION_REGISTRY")` block.
- Define a local vocabulary and pass it through:

```typescript
const KEYS = [
  "moderation.cases.view",
  "moderation.cases.manage",
  "moderation.settings.manage",
  "actions.rules.view",
  "tickets.list.view",
];

describe("expandWildcard", () => {
  it("expands * to every key", () => {
    expect(expandWildcard("*", KEYS)).toEqual(KEYS);
  });

  it("expands a module wildcard", () => {
    expect(expandWildcard("moderation.*", KEYS)).toEqual([
      "moderation.cases.view",
      "moderation.cases.manage",
      "moderation.settings.manage",
    ]);
  });

  it("expands a cross-module action wildcard", () => {
    expect(expandWildcard("*.*.view", KEYS)).toEqual([
      "moderation.cases.view",
      "actions.rules.view",
      "tickets.list.view",
    ]);
  });
});

describe("resolveEffectivePermissions", () => {
  it("returns nothing for an empty grant", () => {
    expect(resolveEffectivePermissions([], KEYS)).toEqual([]);
  });

  it("merges wildcards and literals", () => {
    expect(resolveEffectivePermissions(["moderation.*", "actions.rules.view"], KEYS)).toEqual([
      "moderation.cases.view",
      "moderation.cases.manage",
      "moderation.settings.manage",
      "actions.rules.view",
    ]);
  });
});
```

Add a drift test — this is the check that replaces the deleted registry test. It scans the route
sources rather than booting the app: the only app factory is `createApp()`, which connects to the
database and calls `process.exit` on missing config, so it is not usable from a unit test. Scanning
is also the honest check here — it reads the same `requirePermission(...)` calls the runtime set is
built from, without needing 21 modules' worth of mocks.

Create `apps/dashboard/tests/server/shared/permissionDrift.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROLE_PRESETS } from "@fluxcore/types";
import { navItems } from "../../../src/client/shared/lib/navigation.js";

const FEATURES_DIR = join(__dirname, "../../../src/server/features");

/** Every permission key enforced by a requirePermission(...) call in a route file. */
function declaredKeysFromSource(): Set<string> {
  const keys = new Set<string>();
  const callPattern = /requirePermission\(([^)]*)\)/g;
  const literalPattern = /"([^"]+)"/g;

  for (const feature of readdirSync(FEATURES_DIR)) {
    const dir = join(FEATURES_DIR, feature);
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".ts")) continue;
      const source = readFileSync(join(dir, file), "utf8");
      for (const call of source.matchAll(callPattern)) {
        for (const literal of call[1].matchAll(literalPattern)) {
          keys.add(literal[1]);
        }
      }
    }
  }
  return keys;
}

describe("permission drift", () => {
  it("finds permission keys to check", () => {
    expect(declaredKeysFromSource().size).toBeGreaterThan(40);
  });

  it("enforces every permission the sidebar navigates by", () => {
    const declared = declaredKeysFromSource();

    const missing = navItems
      .map((item) => item.permission)
      .filter((perm): perm is string => Boolean(perm))
      .filter((perm) => !declared.has(perm));

    expect(missing).toEqual([]);
  });

  it("enforces every literal key used by a role preset", () => {
    const declared = declaredKeysFromSource();

    const missing = Object.values(ROLE_PRESETS)
      .flatMap((preset) => preset.permissions)
      .filter((perm) => !perm.includes("*"))
      .filter((perm) => !declared.has(perm));

    expect(missing).toEqual([]);
  });
});
```

The first case is the guard that makes the other two meaningful — a regex that silently matched
nothing would otherwise make both pass vacuously.

- [ ] **Step 2: Run to verify they fail**

```bash
pnpm --filter @fluxcore/dashboard test -- tests/server/shared/permissions.test.ts tests/server/shared/permissionDrift.test.ts
```

Expected: FAIL — the helpers take one argument.

- [ ] **Step 3: Implement**

In `packages/types/src/dashboard-permissions.ts`: delete `PERMISSION_REGISTRY`, `ALL_PERMISSION_KEYS`, `PermissionDefinition`, and `PermissionModule`. Keep `RolePreset`, `ROLE_PRESETS`, `matchPermission`, `wildcardMatch`. Re-signature:

```typescript
/**
 * Expand a wildcard pattern to the concrete keys it covers.
 * `allKeys` is the caller's vocabulary — the dashboard passes the keys declared
 * by its route table, so this module never has to know what permissions exist.
 */
export function expandWildcard(
  pattern: string,
  allKeys: readonly string[],
): string[] {
  if (pattern === "*") return [...allKeys];
  return allKeys.filter((key) => matchPermission(new Set([pattern]), key));
}

/**
 * Given granted permissions (possibly wildcards), return every concrete key
 * they cover, out of `allKeys`.
 */
export function resolveEffectivePermissions(
  granted: string[],
  allKeys: readonly string[],
): string[] {
  const grantedSet = new Set(granted);
  return allKeys.filter((key) => matchPermission(grantedSet, key));
}
```

Update `packages/types/src/index.ts` to stop exporting `PERMISSION_REGISTRY` and `ALL_PERMISSION_KEYS`.

In `apps/dashboard/src/server/features/permissions/routes.ts`:

```typescript
import { resolveEffectivePermissions } from "@fluxcore/types";
import { getDeclaredPermissions } from "../../shared/middleware.js";
import { buildPermissionRegistry } from "../../shared/permissionRegistry.js";
```

Both `effectivePermissions` call sites become:

```typescript
        effectivePermissions: resolveEffectivePermissions(
          [...resolved.permissions],
          [...getDeclaredPermissions()],
        ),
```

The registry endpoint body becomes:

```typescript
      reply.send(buildPermissionRegistry(getDeclaredPermissions()));
```

and its response schema becomes an array:

```typescript
{ tag: "DashboardPermissions", response: { 200: { type: "array", items: { type: "object", additionalProperties: true } } } },
```

`isValidPermKey` (routes.ts) and `isValidPermissionKey` (roles-routes.ts) both replace their first line with:

```typescript
  if (getDeclaredPermissions().has(key)) return true;
```

and drop the `ALL_PERMISSION_KEYS` import.

- [ ] **Step 4: Run everything**

```bash
pnpm --filter @fluxcore/dashboard test
pnpm typecheck
```

Expected: PASS. Typecheck will point at any remaining importer of the deleted exports.

- [ ] **Step 5: Commit**

```bash
git add packages/types/src apps/dashboard/src/server/features/permissions apps/dashboard/tests/server/shared
git commit -m "refactor(permissions): drop the hand-maintained permission registry"
```

---

### Task 10: Permissions page renders the live registry

**Files:**

- Modify: `apps/dashboard/src/client/features/permissions/hooks/usePermissions.ts` (add `usePermissionRegistry`)
- Modify: `apps/dashboard/src/client/shared/lib/schemas.ts` (registry schema)
- Modify: `apps/dashboard/src/client/routes/guild/$guildId/permissions.tsx:47,284,346` (drop the static import)
- Test: `apps/dashboard/tests/client/features/permissions/usePermissionRegistry.test.tsx` (create)

**Interfaces:**

- Consumes: `GET /api/guilds/:guildId/permission-registry` (Task 9).
- Produces: `usePermissionRegistry(guildId)` returning `PermissionModuleView[]`.

- [ ] **Step 1: Write the failing test**

This one tests a react-query hook, so it needs a real `QueryClientProvider`. Declare the wrapper in
the test file — it is four lines and self-contained:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockApiFetch = vi.fn();
vi.mock("../../../../src/client/shared/lib/client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

import { usePermissionRegistry } from "../../../../src/client/features/permissions/hooks/usePermissions";

const REGISTRY = [
  {
    key: "tickets",
    icon: "Ticket",
    labelKey: "permissions:permissionCategories.tickets",
    permissions: [
      {
        key: "tickets.list.view",
        resourceKey: "permissions:resources.list",
        actionKey: "permissions:permissionActions.view",
      },
    ],
  },
];

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("usePermissionRegistry", () => {
  it("parses the served registry", async () => {
    mockApiFetch.mockResolvedValue(REGISTRY);

    const { result } = renderHook(() => usePermissionRegistry("guild-1"), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(REGISTRY));
    expect(mockApiFetch).toHaveBeenCalledWith("/api/guilds/guild-1/permission-registry");
  });

  it("rejects a registry entry missing its i18n keys", async () => {
    mockApiFetch.mockResolvedValue([{ key: "tickets", icon: "Ticket", permissions: [] }]);

    const { result } = renderHook(() => usePermissionRegistry("guild-1"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
pnpm --filter @fluxcore/dashboard test -- tests/client/usePermissionRegistry.test.tsx
```

Expected: FAIL — `usePermissionRegistry` is not exported.

- [ ] **Step 3: Implement**

`schemas.ts`:

```typescript
export const PermissionViewSchema = z.object({
  key: z.string(),
  resourceKey: z.string(),
  actionKey: z.string(),
});

export const PermissionModuleViewSchema = z.object({
  key: z.string(),
  icon: z.string(),
  labelKey: z.string(),
  permissions: z.array(PermissionViewSchema),
});

export const PermissionRegistrySchema = z.array(PermissionModuleViewSchema);
export type PermissionModuleView = z.infer<typeof PermissionModuleViewSchema>;
```

`usePermissions.ts`:

```typescript
/**
 * The permission vocabulary, served from the route table rather than a static
 * list, so the grid can never offer a permission no route enforces.
 */
export function usePermissionRegistry(guildId: string) {
  return useQuery<PermissionModuleView[]>({
    queryKey: ["guilds", guildId, "permission-registry"],
    queryFn: async () => {
      const raw = await apiFetch<unknown>(
        `/api/guilds/${guildId}/permission-registry`,
      );
      return PermissionRegistrySchema.parse(raw);
    },
    staleTime: Infinity,
    enabled: Boolean(guildId),
  });
}
```

In `permissions.tsx`: remove `PERMISSION_REGISTRY` from the `@fluxcore/types` import, call `const { data: registry = [] } = usePermissionRegistry(guildId);` in both components that referenced it, and replace the two usages:

```typescript
        const modulePerms = registry.find((m) => m.key === moduleKey);
```

```tsx
            {registry.map((mod) => {
```

Labels become translations — inside the module header:

```tsx
                    <span className="font-label text-sm font-semibold">
                      {t(mod.labelKey)}
                    </span>
```

and per permission, replacing `perm.label` / `perm.description`:

```tsx
                          <div>
                            <span className="text-text">
                              {t("roleEditor.permissionLabel", {
                                action: t(perm.actionKey),
                                resource: t(perm.resourceKey),
                              })}
                            </span>
                            <p className="font-mono text-xs text-text-muted">{perm.key}</p>
                          </div>
```

Update the `aria-label`s in that grid the same way (they currently interpolate `mod.label` and `perm.label`).

The component's `useTranslation` call must include the `permissions` namespace so `t("permissions:...")` keys resolve.

- [ ] **Step 4: Run the tests**

```bash
pnpm --filter @fluxcore/dashboard test
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/client apps/dashboard/tests/client
git commit -m "feat(permissions): render the permission grid from the served registry"
```

---

### Task 11: Registry i18n across 48 locales

**Files:**

- Modify: `packages/i18n/src/locales/<lang>/permissions.json` × 48

**Interfaces:**

- Consumes: the i18n keys emitted by Task 8 (`permissions:permissionCategories.<module>`, `permissions:resources.<resource>`, `permissions:permissionActions.<action>`).

`permissionCategories` already exists in all 48 locales with 15 entries, but keyed for the old grouping — it has `settings` and no `dashboard`.

- [ ] **Step 1: Write the failing test**

Create `packages/i18n/tests/permission-keys.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const LOCALES_DIR = join(__dirname, "../src/locales");

const REQUIRED_MODULES = [
  "dashboard", "moderation", "actions", "logging", "welcome", "leveling",
  "tickets", "giveaways", "starboard", "suggestions", "roles", "tempvoice",
  "security", "scheduled", "commands",
];

const REQUIRED_RESOURCES = [
  "roles", "audit", "settings", "lookups", "cases", "warnings", "punishments",
  "rules", "analytics", "entries", "config", "test", "leaderboard", "users",
  "rewards", "list", "panels", "messages", "events",
];

const REQUIRED_ACTIONS = ["view", "manage", "execute", "purge"];

function readPermissions(lang: string): Record<string, Record<string, string>> {
  const raw = readFileSync(join(LOCALES_DIR, lang, "permissions.json"), "utf8");
  return JSON.parse(raw) as Record<string, Record<string, string>>;
}

describe("permission registry i18n", () => {
  const languages = readdirSync(LOCALES_DIR);

  it("covers all 48 locales", () => {
    expect(languages).toHaveLength(48);
  });

  it.each(languages)("%s has every module, resource, and action label", (lang) => {
    const perms = readPermissions(lang);

    for (const key of REQUIRED_MODULES) {
      expect(perms.permissionCategories?.[key], `${lang} permissionCategories.${key}`).toBeTruthy();
    }
    for (const key of REQUIRED_RESOURCES) {
      expect(perms.resources?.[key], `${lang} resources.${key}`).toBeTruthy();
    }
    for (const key of REQUIRED_ACTIONS) {
      expect(perms.permissionActions?.[key], `${lang} permissionActions.${key}`).toBeTruthy();
    }
  });
});
```

Also add `roleEditor.permissionLabel` (used in Task 10) to the required set for the `roleEditor` block, e.g. `"permissionLabel": "{{action}} {{resource}}"` — the same interpolation shape in every locale, word order adjusted per language.

- [ ] **Step 2: Run it to verify it fails**

```bash
pnpm --filter @fluxcore/i18n test -- tests/permission-keys.test.ts
```

Expected: FAIL for all 48 locales — `resources` and `permissionActions` do not exist.

- [ ] **Step 3: Add and translate the keys**

For each of the 48 locales, `permissions.json` gains:

- `permissionCategories.dashboard` (new; the other 14 module keys already exist)
- a `resources` object with the 19 nouns above
- a `permissionActions` object with the 4 verbs
- `roleEditor.permissionLabel`

**Editing procedure — formatting matters.** These files are not uniformly formatted, and 17 of them contain `\u` escapes that a naive round-trip would rewrite. For each file:

1. Read it, `JSON.parse` it, `JSON.stringify(parsed, null, 2)` it, and compare to the original bytes.
2. If byte-identical, it is safe to write back a re-serialized version with the new keys.
3. If not, splice the new blocks in as text: insert after the closing brace of the `permissionCategories` object, matching the file's existing indentation and escape style.

Verify no unrelated lines moved:

```bash
git diff --numstat packages/i18n/src/locales | awk '$2 != 0 { print "deleted lines in " $3 }'
```

Expected: no output — additions only (plus the one `permissionCategories.dashboard` line per file).

English values:

```json
  "permissionCategories": { "dashboard": "Dashboard" },
  "resources": {
    "roles": "Roles", "audit": "Audit Log", "settings": "Settings",
    "lookups": "Pickers", "cases": "Cases", "warnings": "Warnings",
    "punishments": "Punishments", "rules": "Rules", "analytics": "Analytics",
    "entries": "Entries", "config": "Configuration", "test": "Test Messages",
    "leaderboard": "Leaderboard", "users": "Users", "rewards": "Rewards",
    "list": "List", "panels": "Panels", "messages": "Messages", "events": "Events"
  },
  "permissionActions": {
    "view": "View", "manage": "Manage", "execute": "Execute", "purge": "Purge"
  }
```

Translate all of them per locale — no English placeholders. RTL locales need no special handling here; these are plain nouns.

- [ ] **Step 4: Run the tests**

```bash
pnpm --filter @fluxcore/i18n test
pnpm --filter @fluxcore/dashboard test
```

Expected: PASS in all 48 locales.

- [ ] **Step 5: Commit**

```bash
git add packages/i18n/src/locales packages/i18n/tests/permission-keys.test.ts
git commit -m "i18n(permissions): translate registry module, resource, and action labels"
```

---

### Task 12: Overview survives without analytics permission

`OverviewPage` calls `useAnalytics` unconditionally and renders `CardGridSkeleton` whenever `isLoading || !analytics` — on a 403 that skeleton never resolves. Overview is the landing route for every delegated user.

**Files:**

- Modify: `apps/dashboard/src/client/routes/guild/$guildId/overview.tsx`
- Create: `apps/dashboard/src/client/features/overview/components/AccessSummary.tsx`
- Modify: `packages/i18n/src/locales/<lang>/overview.json` × 48
- Test: `apps/dashboard/tests/client/routes/guild/OverviewPage.test.tsx` (create)

**Interfaces:**

- Consumes: `usePermissions` (`can`, `roles`, `isLoading`), `navItems`.
- Produces: `<AccessSummary guildId={guildId} />`.

- [ ] **Step 1: Write the failing tests**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ guildId: "g1" }),
  Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
}));

const mockCan = vi.fn();
vi.mock("../../../../src/client/features/permissions/hooks/usePermissions", () => ({
  usePermissions: () => ({ can: mockCan, roles: [], isLoading: false }),
}));

const mockUseAnalytics = vi.fn();
vi.mock("../../../../src/client/features/overview/hooks/useAnalytics", () => ({
  useAnalytics: (...args: unknown[]) => mockUseAnalytics(...args),
}));

vi.mock("../../../../src/client/shared/hooks/useConstants", () => ({
  useConstants: () => ({ data: undefined }),
}));

import { OverviewPage } from "../../../../src/client/routes/guild/$guildId/overview";

describe("OverviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAnalytics.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      isFetching: false,
    });
  });

  it("shows the access summary instead of analytics without actions.analytics.view", () => {
    mockCan.mockImplementation((key: string) => key === "tickets.list.view");

    render(<OverviewPage />);

    expect(screen.getByTestId("access-summary")).toBeInTheDocument();
    expect(screen.queryByTestId("analytics-stats")).not.toBeInTheDocument();
  });

  it("does not fetch analytics the user cannot see", () => {
    mockCan.mockReturnValue(false);

    render(<OverviewPage />);

    expect(mockUseAnalytics).toHaveBeenCalledWith("g1", 7, false);
  });

  it("lists only the pages the user can open", () => {
    mockCan.mockImplementation((key: string) => key === "tickets.list.view");

    render(<OverviewPage />);

    const summary = screen.getByTestId("access-summary");
    expect(within(summary).getByText("nav.tickets")).toBeInTheDocument();
    expect(within(summary).queryByText("nav.moderation")).not.toBeInTheDocument();
  });

  it("renders an error state rather than an endless skeleton when analytics fails", () => {
    mockCan.mockReturnValue(true);
    mockUseAnalytics.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      isFetching: false,
    });

    render(<OverviewPage />);

    expect(screen.getByTestId("analytics-error")).toBeInTheDocument();
  });
});
```

`t` is mocked to return its key, so the nav assertions match `nav.tickets` / `nav.moderation` — the
`i18nKey` values in `navigation.ts`.

- [ ] **Step 2: Run to verify they fail**

```bash
pnpm --filter @fluxcore/dashboard test -- tests/client/OverviewPage.test.tsx
```

Expected: FAIL — the page renders a skeleton in all three cases.

- [ ] **Step 3: Implement**

Create `AccessSummary.tsx`:

```tsx
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Card } from "../../../shared/ui/card";
import { Badge } from "../../../shared/ui/badge";
import { Icon } from "../../../shared/components/Icon";
import { navItems } from "../../../shared/lib/navigation";
import { usePermissions } from "../../permissions/hooks/usePermissions";

/**
 * Landing content for someone whose access is delegated: overview analytics are
 * permission-gated, so without them the page would otherwise be empty. Shows
 * what they can actually open, and which dashboard roles got them here.
 */
export function AccessSummary({ guildId }: { guildId: string }) {
  const { t } = useTranslation(["overview", "common"]);
  const { can, roles } = usePermissions(guildId);

  const available = navItems.filter(
    (item) => item.permission && can(item.permission),
  );

  return (
    <Card className="p-6" data-testid="access-summary">
      <h2 className="text-lg font-bold tracking-tight">{t("overview:access.title")}</h2>
      <p className="mt-1 text-sm text-text-muted">{t("overview:access.subtitle")}</p>

      {roles.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1">
          {roles.map((role) => (
            <Badge key={role.id} variant="outline">
              {role.name}
            </Badge>
          ))}
        </div>
      )}

      {available.length === 0 ? (
        <p className="mt-6 text-sm text-text-muted">{t("overview:access.empty")}</p>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {available.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                params={{ guildId }}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-surface-high"
              >
                <Icon name={item.icon} size={18} />
                {t(item.i18nKey)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
```

In `overview.tsx`:

```tsx
  const { can, isLoading: permissionsLoading } = usePermissions(guildId);
  const canViewAnalytics = can("actions.analytics.view");
  const { data: analytics, isLoading, isError, isFetching } = useAnalytics(guildId, days, canViewAnalytics);

  if (permissionsLoading) return <CardGridSkeleton />;

  if (!canViewAnalytics) {
    return (
      <div className="space-y-8">
        <PageHeader title={t("title")} subtitle={t("subtitle")} />
        <AccessSummary guildId={guildId} />
      </div>
    );
  }

  if (isLoading) return <CardGridSkeleton />;

  if (isError || !analytics) {
    return (
      <div className="space-y-8">
        <PageHeader title={t("title")} subtitle={t("subtitle")} />
        <Card className="p-6 text-sm text-text-muted" data-testid="analytics-error">
          {t("errors.analyticsUnavailable")}
        </Card>
      </div>
    );
  }
```

Give the stats grid `data-testid="analytics-stats"`. Add the `enabled` parameter to `useAnalytics` so the query does not fire without permission:

```typescript
export function useAnalytics(guildId: string, days: number = 7, enabled = true) {
  return useQuery<AnalyticsResponse>({
    // ...
    enabled: enabled && Boolean(guildId),
  });
}
```

Add to `overview.json` (all 48 locales, same procedure as Task 11):

```json
  "access": {
    "title": "Your access",
    "subtitle": "You have been given access to parts of this server's dashboard.",
    "empty": "You don't have access to any modules yet."
  },
  "errors": { "analyticsUnavailable": "Analytics could not be loaded." }
```

- [ ] **Step 4: Run the tests**

```bash
pnpm --filter @fluxcore/dashboard test
pnpm --filter @fluxcore/i18n test
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/client apps/dashboard/tests/client packages/i18n/src/locales
git commit -m "fix(overview): render for users without analytics permission"
```

---

### Task 13: Role editor warns about missing picker access

**Files:**

- Modify: `apps/dashboard/src/client/routes/guild/$guildId/permissions.tsx` (role editor)
- Modify: `packages/i18n/src/locales/<lang>/permissions.json` × 48
- Test: `apps/dashboard/tests/client/features/permissions/lookupsWarning.test.ts` (create)

The warning's condition is pure logic over a permission set, so test it as a function rather than
driving the whole role editor through a stubbed registry. Extract it in Step 3 and import it.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { needsLookupsPermission } from "../../../../src/client/features/permissions/lookupsWarning";

describe("needsLookupsPermission", () => {
  it("warns when a role can configure things but cannot use pickers", () => {
    expect(needsLookupsPermission(new Set(["tickets.panels.manage"]))).toBe(true);
  });

  it("stays quiet once lookups are granted", () => {
    expect(
      needsLookupsPermission(new Set(["tickets.panels.manage", "dashboard.lookups.view"])),
    ).toBe(false);
  });

  it("stays quiet for a view-only role", () => {
    expect(needsLookupsPermission(new Set(["tickets.list.view"]))).toBe(false);
  });

  it("stays quiet for a role whose wildcard already covers lookups", () => {
    expect(needsLookupsPermission(new Set(["dashboard.*"]))).toBe(false);
    expect(needsLookupsPermission(new Set(["*"]))).toBe(false);
  });

  it("warns for a module wildcard that does not cover lookups", () => {
    expect(needsLookupsPermission(new Set(["tickets.*"]))).toBe(true);
  });

  it("stays quiet for an empty role", () => {
    expect(needsLookupsPermission(new Set())).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter @fluxcore/dashboard test -- tests/client/RoleEditorLookupsWarning.test.tsx
```

Expected: FAIL — no warning element exists.

- [ ] **Step 3: Implement**

First export the client matcher so there is one implementation, not two: in
`usePermissions.ts`, change `function matchPermission(...)` to `export function matchPermission(...)`.

Create `apps/dashboard/src/client/features/permissions/lookupsWarning.ts`:

```typescript
import { matchPermission } from "./hooks/usePermissions";

/**
 * Channel/role/member pickers on nearly every page call the Discord lookup
 * routes, which require dashboard.lookups.view. A role that can configure
 * things but cannot use pickers renders empty dropdowns — worth warning about
 * while the role is being edited rather than after it is assigned.
 */
export function needsLookupsPermission(granted: Set<string>): boolean {
  if (matchPermission(granted, "dashboard.lookups.view")) return false;

  return [...granted].some(
    (perm) => perm.endsWith(".manage") || perm.endsWith(".*") || perm === "*",
  );
}
```

In the role editor component, above the permission grid:

```tsx
  const needsLookups = needsLookupsPermission(permissions);

  {needsLookups && (
    <Alert data-testid="lookups-warning" className="mt-2">
      <Icon name="warning" size={16} />
      <div className="flex flex-wrap items-center gap-2">
        <span>{t("roleEditor.lookupsWarning")}</span>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => togglePermission("dashboard.lookups.view")}
        >
          {t("roleEditor.grantLookups")}
        </Button>
      </div>
    </Alert>
  )}
```

Also label what `dashboard.roles.manage` really grants, since delegated access makes it the power to
admit new people to the dashboard. In the permission grid, when rendering the key
`dashboard.roles.manage`, render `t("roleEditor.admissionNote")` beneath it in
`text-xs text-warning`.

Add to `permissions.json` (48 locales, same procedure as Task 11):

```json
    "lookupsWarning": "This role can configure modules but cannot look up channels, roles, or members — its pickers will be empty.",
    "grantLookups": "Grant picker access",
    "admissionNote": "Also lets holders give other members dashboard access."
```

- [ ] **Step 4: Run the tests**

```bash
pnpm --filter @fluxcore/dashboard test
pnpm --filter @fluxcore/i18n test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/client apps/dashboard/tests/client packages/i18n/src/locales
git commit -m "feat(permissions): warn when a role lacks picker access"
```

---

### Task 14: Integration test — delegated access end to end

**Files:**

- Create: `packages/systems/tests/integration/dashboard-delegated-access.test.ts`

**Interfaces:**

- Consumes: the real test PostgreSQL, `setupTestDatabase` / `cleanTestData` / `teardownTestDatabase`, and the factories in `packages/systems/tests/helpers/`.

- [ ] **Step 1: Write the test**

```typescript
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { getPrisma } from "@fluxcore/database";
import {
  setupTestDatabase,
  cleanTestData,
  teardownTestDatabase,
} from "../helpers/database";

const GUILD_ID = "900000000000000001";
const USER_ID = "900000000000000002";

describe("delegated dashboard access", () => {
  beforeAll(() => setupTestDatabase());
  beforeEach(() => cleanTestData());
  afterAll(() => teardownTestDatabase());

  it("resolves a role assignment into exactly that role's permissions", async () => {
    const prisma = getPrisma();
    const role = await prisma.dashboardRole.create({
      data: {
        guildId: GUILD_ID,
        name: "Ticket Staff",
        permissions: JSON.stringify(["tickets.list.view", "tickets.list.manage"]),
      },
    });
    await prisma.dashboardRoleAssignment.create({
      data: { guildId: GUILD_ID, userId: USER_ID, roleId: role.id, assignedBy: "owner" },
    });

    const assignments = await prisma.dashboardRoleAssignment.findMany({
      where: { guildId: GUILD_ID, userId: USER_ID },
      include: { role: true },
    });

    expect(JSON.parse(assignments[0].role.permissions)).toEqual([
      "tickets.list.view",
      "tickets.list.manage",
    ]);
  });

  it("does not hand a default role to a user with no assignment", async () => {
    const prisma = getPrisma();
    await prisma.dashboardRole.create({
      data: {
        guildId: GUILD_ID,
        name: "Baseline",
        isDefault: true,
        permissions: JSON.stringify(["logging.entries.view"]),
      },
    });

    const assignments = await prisma.dashboardRoleAssignment.findMany({
      where: { guildId: GUILD_ID, userId: USER_ID },
    });

    expect(assignments).toEqual([]);
  });

  it("drops the assignment when the role is deleted", async () => {
    const prisma = getPrisma();
    const role = await prisma.dashboardRole.create({
      data: {
        guildId: GUILD_ID,
        name: "Temp",
        permissions: JSON.stringify(["tickets.list.view"]),
      },
    });
    await prisma.dashboardRoleAssignment.create({
      data: { guildId: GUILD_ID, userId: USER_ID, roleId: role.id, assignedBy: "owner" },
    });

    await prisma.dashboardRole.delete({ where: { id: role.id } });

    expect(
      await prisma.dashboardRoleAssignment.findMany({ where: { guildId: GUILD_ID, userId: USER_ID } }),
    ).toEqual([]);
  });
});
```

Use whatever the helpers module is actually named in `packages/systems/tests/helpers/` — match the imports used by the existing integration tests.

- [ ] **Step 2: Run it**

```bash
pnpm test:integration
```

Expected: PASS. The suite runs with `fileParallelism: false`; do not add `singleFork`.

- [ ] **Step 3: Commit**

```bash
git add packages/systems/tests/integration/dashboard-delegated-access.test.ts
git commit -m "test(permissions): cover delegated grant resolution against the real DB"
```

---

### Task 15: Full verification

- [ ] **Step 1: Run everything**

```bash
pnpm typecheck
pnpm test
pnpm test:integration
```

All three must pass. `pnpm typecheck` does not cover dashboard test files — the test run is the only evidence for those.

- [ ] **Step 2: Manual smoke check**

```bash
pnpm dev
```

1. As the guild owner, enable the permission system, create a "Ticket Staff" role with `tickets.*` + `dashboard.lookups.view`, and assign it to an account that has **no** Discord admin rights.
2. Log in as that account: the server appears on the servers page with the delegated badge.
3. Open it: the sidebar shows only Tickets; Overview shows the access summary, not an endless skeleton.
4. Navigating directly to `/guild/<id>/moderation` shows the permission-denied page.
5. Remove the assignment; within a minute the guild disappears from that account's list.

- [ ] **Step 3: Update the feature spec**

`docs/features/dashboard-permissions.md` line 12 and line 21 still say the dashboard is admin-only. Replace both with the model in this plan and link to the design spec. Commit:

```bash
git add docs/features/dashboard-permissions.md
git commit -m "docs(permissions): record delegated access in the feature spec"
```
