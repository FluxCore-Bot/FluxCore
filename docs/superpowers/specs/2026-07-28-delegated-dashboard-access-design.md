# Delegated Dashboard Access + Generated Permission Registry

> **Date:** 2026-07-28
> **Status:** Approved (design)
> **Supersedes:** `docs/features/dashboard-permissions.md` design decision "Non-MANAGE_GUILD access: No" (line 21)

## Problem

Two problems, one change.

**1. The permission system can't actually delegate.** `resolveUserPermissions` returns an empty
set the moment `isUserGuildAdmin` is false (`permissions.ts:91-98`), so a member's dashboard roles
are never read. `/api/guilds` separately filters the OAuth snapshot to `owner || canManageGuild`
(`guilds/routes.ts:21`). A server owner can build a "Ticket Moderator" role, assign it to someone,
and that person still sees nothing — Discord `MANAGE_GUILD` remains a hard prerequisite, which
defeats the point of granular permissions.

**2. The permission registry is hand-maintained.** `packages/types/src/dashboard-permissions.ts`
is a 305-line literal listing 48 keys. Nothing ties it to the `requirePermission(...)` calls that
actually enforce anything, so a key can exist in the UI with no route behind it (or the reverse)
and no test catches it. The permissions page compounds this by importing the constant directly and
ignoring the `GET /api/guilds/:guildId/permission-registry` endpoint that serves the same data.

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Non-admin access | Yes, via explicit grants | The delegation feature is inert without it |
| What makes someone eligible | A `DashboardRoleAssignment` or `DashboardUserPermission` row | Explicit, auditable, opt-in per user |
| `isDefault` roles for non-admins | Never applied | Otherwise enabling the toggle admits every member at once |
| `requirePermissions` semantics | Governs whether **admins** are constrained — nothing else | Grants work in both modes; the toggle stops meaning "on/off for the system" |
| Discord lookup routes | Own permission key `dashboard.lookups.view` | Precision over convenience; broken pickers mitigated in UI |
| Registry source | Runtime, from the route table | A key cannot exist without enforcement, and vice versa |
| Registry labels | Derived i18n keys | ~52 strings instead of ~96 hardcoded English ones |

## Part A — Access Model

### Resolution order

`resolveUserPermissions(userId, guildId)`:

| User | `requirePermissions: false` | `requirePermissions: true` |
|---|---|---|
| Guild owner | `*` | `*` |
| Live guild admin | `*` (unchanged) | assignments + `isDefault` roles + overrides |
| Guild member with grants | their grants | their grants |
| Guild member, no grants | ∅ | ∅ |
| Not a member | ∅ | ∅ |

`requirePermissions` is read **only** on the admin path. Explicit grants resolve identically in
both modes. `isDefault` roles are merged **only** on the admin path.

### Live authority, fetched once

`guildAuthz.ts` gains:

```typescript
export interface GuildAuthority {
  isOwner: boolean;
  isAdmin: boolean;   // owner, Administrator, or Manage Server
  isMember: boolean;
}

export async function getGuildAuthority(guildId, userId): Promise<GuildAuthority>
```

One `getGuildMember` + `getGuildRoles` pair serves all three answers. `isUserGuildAdmin` becomes a
thin wrapper over it so existing callers and tests keep working. The non-admin path needs
`isMember` anyway, so this avoids a second round trip.

`ResolvedPermissions` gains `isGuildMember: boolean` alongside `isOwner` / `isGuildAdmin`. The 60s
cache and its invalidation are unchanged, so a kicked or demoted user loses access within 60s.

### Middleware

`requireGuildAdmin` → **`requireGuildAccess`**, renamed across all 21 route files. The gate becomes
"does this user have any authority here":

```typescript
const authorized = resolved.isOwner || resolved.isGuildAdmin || resolved.permissions.size > 0;
```

The `botNotInGuild` check and the `resolvedPermissions` attachment are unchanged. `requirePermission`
is unchanged in behavior. Every guild-scoped route already pairs with one except six: the four
Discord lookup routes (handled below) and `GET .../my-permissions` + `GET .../permission-registry`,
which stay at access level by design — anyone who can enter a guild must be able to read their own
permissions and the key vocabulary, or the UI cannot render.

Places that genuinely need admin authority (the owner-only `requirePermissions` toggle) keep
checking `isOwner` / `isGuildAdmin` explicitly — the rename does not weaken them.

### Guild list

`buildManageableGuilds` becomes a union:

1. OAuth guilds where `owner || canManageGuild(permissions)` — as today.
2. Guild IDs with an explicit grant for this user: two indexed queries
   (`dashboardRoleAssignment.findMany({ where: { userId } })`,
   `dashboardUserPermission.findMany({ where: { userId } })`), **intersected with
   `session.guilds`**. The session holds the user's full OAuth guild list, so the intersection is
   the membership check — a guild they were removed from cannot appear.

Each entry gains `access: "admin" | "delegated"`. Sorting (bot-present first, then name) is
unchanged. `POST /api/guilds/refresh` uses the same builder and so inherits this.

### Discord lookup routes

The four routes in `discord/routes.ts` (channels, roles, members, member search) currently pass
`requireGuildAdmin` with no permission key — they would otherwise become reachable by anyone with
any grant. They get `requirePermission("dashboard.lookups.view")`.

Consequence: a role with `tickets.list.manage` and no lookups permission renders empty channel and
role pickers. Mitigations, both required:

- Every built-in preset includes `dashboard.lookups.view`.
- The role editor shows an inline warning when a role holds any `*.manage` / `*.config.*`
  permission without it, with a one-click fix.

### Security gaps closed in this work

**Privilege escalation via role assignment.** Escalation guards already exist on role create
(`roles-routes.ts:129`), role update (`:250`), preset create (`:555`), and user permission
overrides (`routes.ts:161`, which additionally blocks self-grants and refuses wildcards from
non-owners). `POST /dashboard-roles/:roleId/members` has **no check at all** — a
`dashboard.roles.manage` holder can assign themselves, or anyone, an existing role that holds
permissions they lack. Today that is contained because only `MANAGE_GUILD` admins reach it; once
delegated users can, it is a direct path from "delegated moderator" to `*`.

Fix, matching the strictness already used for user overrides:

- Non-owners cannot assign a role holding any permission they do not themselves hold
  (`matchPermission` against the actor's resolved set), → 403 with the offending key.
- Non-owners cannot assign a role to themselves at all, mirroring the existing self-grant block.
- `DELETE .../members/:userId` is deliberately left open to any `dashboard.roles.manage` holder —
  removing an assignment reduces privilege and cannot escalate.

**Admission power.** `dashboard.roles.manage` now means "can admit people to the dashboard". It
stays a single key, but the permissions page labels it that way so an owner delegating it
understands what they are handing over.

## Part B — Generated Registry

### Self-registering keys

`requirePermission(...keys)` records its keys in a module-level `Set` when the factory runs — that
is, at route-registration time. After `app.ready()` the set is complete and *is* the registry.

```typescript
const declaredPermissions = new Set<string>();

export function requirePermission(...keys: string[]) {
  for (const key of keys) declaredPermissions.add(key);
  return async (request, reply) => { /* unchanged */ };
}

export function getDeclaredPermissions(): ReadonlySet<string> {
  return declaredPermissions;
}
```

### Building the tree

New `server/shared/permissionRegistry.ts` parses each `module.resource.action` key and groups it,
taking presentation from the one hand-maintained map:

```typescript
const MODULE_META: Record<string, { icon: string; order: number }> = {
  dashboard: { icon: "admin_panel_settings", order: 0 },
  moderation: { icon: "shield", order: 1 },
  // ...
};
```

Each entry carries derived i18n keys rather than English text:

- module label → `permissions:modules.<module>`
- permission label → `permissions:resources.<module>.<resource>` + `permissions:actions.<action>`
- description → `permissions:descriptions.<module>.<resource>.<action>`, falling back to a
  composed "`<action>` `<resource>`" string when absent.

**Boot validation** (runs after `app.ready()`, throws in dev, logs an error in production):

- every declared key's module has a `MODULE_META` entry;
- every key has exactly three segments;
- every non-wildcard key in `ROLE_PRESETS` is declared;
- every `navItems[].permission` is declared (asserted by test, since nav is client-side).

### Consumers

- `GET /api/guilds/:guildId/permission-registry` serves the built tree instead of the constant.
- The permissions page fetches it via a new `usePermissionRegistry(guildId)` hook and drops its
  direct import.
- `PERMISSION_REGISTRY` is deleted from `packages/types`. `matchPermission`, `expandWildcard`,
  `ROLE_PRESETS`, and the `PermissionDefinition` / `PermissionModule` types stay — the types now
  carry i18n keys instead of literal labels.
- Role-save validation (rejecting unknown permission keys) validates against the live registry.

## Part C — Landing & Overview

`OverviewPage` calls `useAnalytics` unconditionally and renders `CardGridSkeleton` while
`isLoading || !analytics`. On a 403 that skeleton never resolves — a live bug today for any
restricted admin, and the default landing for every delegated user. Changes:

- Analytics block renders only when `can("actions.analytics.view")`.
- A failed or absent query renders an error/empty state, never an indefinite skeleton.
- Users without that permission get an "access summary" panel: the nav items they can reach, as
  links, plus their assigned dashboard roles.
- Overview stays permission-free in `navItems` — it is the landing page and must always resolve.

## Part D — Permissions Page

- Grid renders from the fetched registry; labels come from i18n keys.
- Role editor: pickers warning (Part A), escalation guard reflected as disabled checkboxes with a
  tooltip explaining that you cannot grant what you do not hold.
- `dashboard.roles.manage` is labelled as granting dashboard admission.

## Part E — i18n

New keys under the `permissions` namespace: ~16 module names, ~30 resource names, 6 action verbs,
plus the new warning/labels. Per project convention these are translated in **all 48 locales** in
the same change; `en` placeholders are not acceptable. Source of truth is `src/locales`, and the
app serves `dist/locales`.

This is a net reduction: the grid is currently the only untranslated surface in the dashboard,
rendering ~96 hardcoded English strings.

## Testing

### Unit — `apps/dashboard/tests/server/`

`resolveUserPermissions`, one test per path:

- owner → `*` regardless of toggle
- admin + `requirePermissions: false` → `*`
- admin + `requirePermissions: true` → assignments ∪ defaults ∪ overrides
- non-admin member + explicit grant → exactly the grant, in **both** toggle states
- non-admin member + `isDefault` role only → ∅ (defaults must not leak)
- non-member with a stale grant row → ∅

`requireGuildAccess`: owner, admin, delegated → pass; member without grants → 403;
bot not in guild → 403 `botNotInGuild`.

Registry: keys collected from a built app match the `requirePermission` calls; unknown module →
boot validation throws; presets fully declared; every `navItems[].permission` declared.

Escalation guard: create/update role, user override, and role assignment each reject a key the
actor lacks; owner bypasses.

`/api/guilds`: returns the union; a grant for a guild the user is not in is excluded; `access` is
`"delegated"` for grant-only guilds and `"admin"` otherwise.

### Integration — `packages/systems/tests/integration/`

Assign a dashboard role to a non-admin user → the guild appears in their list, their permitted
route returns 200, a non-permitted route returns 403; remove the assignment → access gone after
cache invalidation.

### Client

`usePermissionRegistry` renders the grid from fetched data; overview renders the access-summary
panel without `actions.analytics.view` and an error state on failure (never a permanent skeleton).

Per project rules: no `any`, no `as` casts in tests; mock Discord API and the logger; use the
shared factories.

## Rollout

No schema migration — all four models already exist. No behavioral change for any existing guild
until someone assigns a dashboard role or user override to a non-admin. Recommended order:

1. `getGuildAuthority` refactor + `resolveUserPermissions` rework + tests
2. `requireGuildAccess` rename + `dashboard.lookups.view` on the Discord routes
3. Escalation guard
4. `/api/guilds` union + `access` field + servers-page badge
5. Generated registry + endpoint + client hook + delete the static constant
6. Overview fix and access-summary panel
7. i18n across 48 locales

## Out of Scope

- Mirroring Discord roles onto dashboard roles (considered, rejected — needs schema and UI beyond
  this change).
- Bot-side permission checks; this is dashboard-only.
- Audit log retention/cleanup work.
