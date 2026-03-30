# Dashboard Permissions System

> **Phase:** Cross-cutting (applies to all dashboard modules)
> **Priority:** P0
> **Status:** Not Started
> **Depends on:** Existing auth system (Discord OAuth2 + sessions)

## Overview

Granular role-based + per-user permission system for the admin dashboard. Currently, any user with Discord's `MANAGE_GUILD` permission has **full access** to every dashboard feature. This system adds fine-grained control so guild owners can delegate specific modules/actions to specific administrators.

**Gate model:** `MANAGE_GUILD` remains the entry gate — only users with that Discord permission can access the dashboard at all. The permission system adds granularity *within* that gate.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Permission format | String keys (`module.resource.action`) | Self-documenting, unlimited scalability, easy to add new modules |
| Deny rules | No (allow-only) | MANAGE_GUILD already gates entry; simpler mental model |
| Per-user overrides | Yes | Guild owner can grant specific permissions to individuals beyond their roles |
| Non-MANAGE_GUILD access | No | Dashboard remains admin-only; permissions control what admins can do |
| Built-in presets | Yes | Ship "Moderator", "Content Manager", "DJ" templates |
| Audit retention | 90 days default, configurable per guild | Balance storage vs compliance needs |
| Wildcard support | Yes (`module.*`, `*`) | Reduces assignment burden for broad access |
| Owner bypass | Always `*` | Guild owner always has full access, non-revocable |

## Permission Key Convention

```
<module>.<resource>.<action>

module   = dashboard feature area (moderation, music, actions, etc.)
resource = entity type within module (cases, settings, rules, etc.)
action   = operation (view, create, update, delete, manage, execute)
```

`manage` = shorthand for create + update + delete on that resource.

### Complete Permission Registry

```
── dashboard
│   ├── dashboard.roles.view          View dashboard roles and assignments
│   ├── dashboard.roles.manage        Create/edit/delete dashboard roles
│   ├── dashboard.audit.view          View dashboard audit log
│   └── dashboard.settings.manage     Manage guild-wide dashboard settings
│
── moderation
│   ├── moderation.cases.view         View moderation case history
│   ├── moderation.cases.manage       Edit/delete moderation cases
│   ├── moderation.settings.manage    Configure moderation settings
│   ├── moderation.warnings.view      View warning history
│   ├── moderation.warnings.manage    Create/delete warnings
│   └── moderation.punishments.manage Configure warning punishment escalations
│
── actions
│   ├── actions.rules.view            View automation rules
│   ├── actions.rules.manage          Create/edit/delete automation rules
│   ├── actions.rules.execute         Bulk enable/disable rules
│   ├── actions.analytics.view        View rule analytics and logs
│   └── actions.settings.manage       Configure action system settings
│
── music
│   ├── music.settings.view           View music settings
│   ├── music.settings.manage         Configure music settings
│   ├── music.library.view            View music library
│   └── music.library.manage          Create/delete albums and tracks
│
── logging
│   ├── logging.entries.view          View log entries
│   ├── logging.entries.purge         Purge old log entries
│   └── logging.config.manage         Configure log channels and events
│
── welcome
│   ├── welcome.config.view           View welcome/farewell config
│   ├── welcome.config.manage         Update welcome/farewell settings
│   └── welcome.test.execute          Send test welcome/farewell messages
│
── leveling
│   ├── leveling.leaderboard.view     View leaderboard
│   ├── leveling.users.manage         Set user XP manually
│   ├── leveling.rewards.manage       Add/remove level rewards
│   └── leveling.settings.manage      Configure leveling settings
│
── tickets
│   ├── tickets.list.view             View tickets
│   ├── tickets.list.manage           Force close tickets
│   ├── tickets.panels.manage         Create/edit/delete ticket panels
│   └── tickets.settings.manage       Configure ticket settings
│
── giveaways
│   ├── giveaways.list.view           View giveaways
│   ├── giveaways.list.manage         Create/end/reroll giveaways
│
── starboard
│   ├── starboard.entries.view        View starred messages
│   └── starboard.settings.manage     Configure starboard settings
│
── suggestions
│   ├── suggestions.list.view         View suggestions
│   ├── suggestions.list.manage       Create/update status/delete suggestions
│   └── suggestions.settings.manage   Configure suggestion settings
│
── roles (role panels)
│   ├── roles.panels.view             View role panels
│   └── roles.panels.manage           Create/edit/delete/send role panels
│
── tempvoice
│   ├── tempvoice.config.view         View temp voice configs
│   └── tempvoice.config.manage       Create/edit/delete temp voice configs
│
── security (anti-raid)
│   ├── security.config.view          View anti-raid configuration
│   ├── security.config.manage        Update anti-raid settings
│   └── security.events.view          View raid event history
│
── scheduled
│   ├── scheduled.messages.view       View scheduled messages
│   ├── scheduled.messages.manage     Create/edit/delete scheduled messages
│   └── scheduled.messages.execute    Test send scheduled messages
│
── commands (custom commands)
│   ├── commands.list.view            View custom commands
│   └── commands.list.manage          Create/edit/delete custom commands
```

**Total: 49 individual permissions across 15 modules.**

### Wildcard Rules

- `*` — full access (guild owner always has this)
- `moderation.*` — all moderation permissions
- `*.settings.manage` — manage settings across all modules
- `*.*.view` — view-only across everything

Wildcard matching: walk from most-specific to least-specific. First match wins.

## Built-in Role Presets

Guilds can clone these as starting points. Presets are **not** auto-created — guild owner chooses to create from template.

### Moderator

```
moderation.*
logging.entries.view
logging.config.manage
tickets.list.view
tickets.list.manage
suggestions.list.manage
security.events.view
```

### Content Manager

```
welcome.config.*
leveling.*
starboard.*
suggestions.*
roles.panels.*
scheduled.messages.*
commands.list.*
```

### Music DJ

```
music.*
```

### Full Admin

```
*
```

### Viewer (Read-Only)

```
*.*.view
```

## Database Schema

```prisma
model DashboardRole {
  id          String   @id @default(uuid())
  guildId     String
  name        String
  color       String?  // Hex color for UI badge
  position    Int      @default(0) // Higher = more priority
  isDefault   Boolean  @default(false) // Auto-assigned to all MANAGE_GUILD users
  permissions String   @default("[]") // JSON array of permission keys (supports wildcards)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  assignments DashboardRoleAssignment[]

  @@unique([guildId, name])
  @@index([guildId])
}

model DashboardRoleAssignment {
  id        String   @id @default(uuid())
  guildId   String
  userId    String   // Discord user ID
  roleId    String
  role      DashboardRole @relation(fields: [roleId], references: [id], onDelete: Cascade)
  assignedBy String  // Who assigned this
  createdAt DateTime @default(now())

  @@unique([guildId, userId, roleId])
  @@index([guildId, userId])
}

model DashboardUserPermission {
  id         String   @id @default(uuid())
  guildId    String
  userId     String   // Discord user ID
  permission String   // Single permission key (supports wildcards)
  grantedBy  String   // Who granted this
  createdAt  DateTime @default(now())

  @@unique([guildId, userId, permission])
  @@index([guildId, userId])
}

model DashboardAuditLog {
  id         String   @id @default(uuid())
  guildId    String
  userId     String   // Who performed the action
  username   String   // Snapshot of username at time of action
  action     String   // Permission key or "dashboard.roles.create", etc.
  targetType String?  // "case", "rule", "role", "user", "settings"
  targetId   String?  // ID of affected entity
  details    String   @default("{}") // JSON — before/after, metadata
  createdAt  DateTime @default(now())

  @@index([guildId, createdAt])
  @@index([guildId, userId])
  @@index([createdAt]) // For retention cleanup
}

model DashboardGuildSettings {
  guildId              String @id
  auditRetentionDays   Int    @default(90)
  requirePermissions   Boolean @default(false) // false = legacy mode (all admins have full access)
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
}
```

### Key Design Notes

- **`requirePermissions` toggle**: When `false`, all MANAGE_GUILD users have full access (backwards compatible). When `true`, the permission system activates. This allows gradual adoption.
- **`DashboardUserPermission`**: Per-user overrides. These are merged with role permissions during resolution.
- **`position` on roles**: Higher position = evaluated first. If a user has multiple roles, all permissions are merged (union).
- **`isDefault` role**: Auto-applied to all MANAGE_GUILD users. Guild owner can set a "baseline" role.

## Permission Resolution Algorithm

```
resolvePermissions(userId, guildId):
  1. If userId is guild owner → return Set(["*"])
  2. Load DashboardGuildSettings for guildId
     - If requirePermissions === false → return Set(["*"]) (legacy mode)
  3. Load all DashboardRoleAssignment for (guildId, userId)
  4. Load all DashboardRole where isDefault === true for guildId
  5. Merge all role.permissions arrays into a Set
  6. Load all DashboardUserPermission for (guildId, userId)
  7. Add per-user permissions to the Set
  8. Return the merged Set

hasPermission(grantedSet, requiredKey):
  1. If grantedSet has "*" → true
  2. If grantedSet has requiredKey → true
  3. Walk wildcards from most-specific to least-specific:
     - "moderation.cases.view" → check "moderation.cases.*" → "moderation.*"
     - "*.cases.view" → "*.*.view"
  4. Return false (default deny)
```

### Caching Strategy

- **Permission cache key**: `perms:{guildId}:{userId}`
- **TTL**: 60 seconds
- **Invalidation**: On role assignment change, role permission edit, or user permission change, delete the cache key
- **Storage**: In-memory Map (same pattern as existing session cache)
- **Cache invalidation records**: Write to `CacheInvalidation` table so bot and dashboard stay in sync

## API Routes

All routes prefixed with `/api/guilds/:guildId/`.

### Permission Check Endpoint

```
GET /api/guilds/:guildId/my-permissions
Auth: requireAuth, requireGuildAdmin
Response: {
  permissions: string[],     // Resolved flat permission list
  roles: { id, name, color }[], // Assigned roles
  isOwner: boolean
}
```

### Dashboard Roles CRUD

```
GET    /api/guilds/:guildId/dashboard-roles
POST   /api/guilds/:guildId/dashboard-roles
PUT    /api/guilds/:guildId/dashboard-roles/:roleId
DELETE /api/guilds/:guildId/dashboard-roles/:roleId

Permission: dashboard.roles.view (GET), dashboard.roles.manage (POST/PUT/DELETE)
```

### Role Assignment

```
GET    /api/guilds/:guildId/dashboard-roles/:roleId/members
POST   /api/guilds/:guildId/dashboard-roles/:roleId/members      { userId }
DELETE /api/guilds/:guildId/dashboard-roles/:roleId/members/:userId

Permission: dashboard.roles.manage
```

### Per-User Permission Overrides

```
GET    /api/guilds/:guildId/user-permissions/:userId
PUT    /api/guilds/:guildId/user-permissions/:userId   { permissions: string[] }
DELETE /api/guilds/:guildId/user-permissions/:userId

Permission: dashboard.roles.manage
```

### Dashboard Audit Log

```
GET /api/guilds/:guildId/dashboard-audit
Query: ?userId=&action=&targetType=&from=&to=&page=&limit=
Permission: dashboard.audit.view
```

### Dashboard Settings

```
GET /api/guilds/:guildId/dashboard-settings
PUT /api/guilds/:guildId/dashboard-settings   { auditRetentionDays, requirePermissions }
Permission: dashboard.settings.manage

Note: Only guild owner can toggle requirePermissions and manage dashboard settings.
```

### Role Presets

```
GET  /api/guilds/:guildId/dashboard-roles/presets
POST /api/guilds/:guildId/dashboard-roles/from-preset   { preset: "moderator" | "content-manager" | "dj" | "full-admin" | "viewer" }
Permission: dashboard.roles.manage
```

## Middleware Changes

### New Middleware: `requirePermission`

```typescript
// apps/dashboard/src/server/middleware.ts

export function requirePermission(...keys: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const { guildId } = request.params as { guildId: string };
    const session = request.session;

    const permissions = await resolveUserPermissions(session.userId, guildId);

    for (const key of keys) {
      if (!matchPermission(permissions, key)) {
        return reply.status(403).send({
          error: "Insufficient permissions",
          required: key,
        });
      }
    }

    // Attach for downstream use (audit logging, etc.)
    request.resolvedPermissions = permissions;
  };
}
```

### Route Migration Pattern

```typescript
// Before:
{ preHandler: [requireAuth, requireGuildAdmin] }

// After (each route gets specific permission):
{ preHandler: [requireAuth, requireGuildAdmin, requirePermission("music.settings.manage")] }
```

### Audit Logging Middleware

```typescript
export function auditLog(action: string, targetType?: string) {
  return async (request: FastifyRequest, reply: FastifyReply, payload: unknown) => {
    // afterHandler — runs after successful response
    if (reply.statusCode >= 200 && reply.statusCode < 300) {
      await createDashboardAuditLog({
        guildId: (request.params as any).guildId,
        userId: request.session.userId,
        username: request.session.username,
        action,
        targetType,
        targetId: (request.params as any).ruleId || (request.params as any).id,
        details: { body: request.body },
      });
    }
  };
}
```

## Frontend Integration

### Permission Hook

```typescript
// apps/dashboard/src/client/hooks/usePermissions.ts

export function usePermissions() {
  const { guildId } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["permissions", guildId],
    queryFn: () => apiFetch<MyPermissionsResponse>(`/api/guilds/${guildId}/my-permissions`),
    staleTime: 60_000,
  });

  const can = useCallback((key: string): boolean => {
    if (!data?.permissions) return false;
    if (data.isOwner) return true;
    return matchPermission(new Set(data.permissions), key);
  }, [data]);

  return { can, permissions: data?.permissions ?? [], isOwner: data?.isOwner ?? false, isLoading };
}
```

### UI Patterns

**Conditional rendering:**
```tsx
const { can } = usePermissions();

// Hide element entirely
{can("moderation.cases.manage") && <DeleteCaseButton />}

// Disable element with tooltip
<Button disabled={!can("music.settings.manage")} title="You don't have permission">
  Save Settings
</Button>
```

**Route-level guard:**
```tsx
// In route loader or component
const { can } = usePermissions();
if (!can("moderation.cases.view")) {
  return <PermissionDenied module="Moderation" />;
}
```

**Navigation filtering:**
```tsx
// Sidebar only shows modules user can access
const navItems = ALL_NAV_ITEMS.filter(item => can(item.requiredPermission));
```

## Dashboard Pages

### Settings > Roles & Permissions

**URL:** `/guild/:guildId/settings/permissions`

**Layout:**

1. **Enable/Disable toggle** — `requirePermissions` switch at the top with explanation
2. **Roles list** (left panel)
   - Card per role: name, color badge, permission count, member count
   - "Create Role" button + "From Preset" dropdown
   - Drag to reorder (updates position)
3. **Role editor** (right panel, selected role)
   - Name + color picker
   - "Default role" toggle
   - Permission grid grouped by module:
     - Module header row with "Grant All" toggle (sets `module.*`)
     - Individual permission checkboxes under each module
     - Description tooltip on each permission
   - Member list: assigned users with remove button
   - "Add Member" search (searches Discord guild members)
4. **User Overrides tab**
   - Search for user → show their effective permissions (from roles + overrides)
   - Add/remove individual permission overrides
5. **Audit Log tab**
   - Filterable table: timestamp, user, action, target, details
   - Export to CSV

### Permission Denied Page

Shown when a user navigates to a module they can't access. Displays:
- Which permission is required
- Their current roles
- "Contact your server owner" message

## Shared Package: Permission Utilities

```
packages/types/src/dashboard-permissions.ts
```

Contains the permission registry, wildcard matcher, and preset definitions. Shared between bot (if needed), dashboard API, and dashboard client.

```typescript
export interface PermissionDefinition {
  key: string;
  label: string;
  description: string;
  module: string;
}

export interface PermissionModule {
  key: string;
  label: string;
  icon: string; // Lucide icon name
  permissions: PermissionDefinition[];
}

export const PERMISSION_REGISTRY: PermissionModule[] = [/* ... */];

export const ROLE_PRESETS: Record<string, { name: string; color: string; permissions: string[] }> = {/* ... */};

export function matchPermission(granted: Set<string>, required: string): boolean {/* ... */}

export function expandWildcard(pattern: string, registry: PermissionModule[]): string[] {/* ... */}
```

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| Privilege escalation | Users cannot create roles with permissions they don't have themselves |
| Owner protection | Guild owner always has `*`, cannot be modified |
| Race conditions on cache | Permission cache TTL is short (60s); mutations invalidate immediately |
| Audit tampering | Audit logs are append-only; no update/delete API |
| Legacy mode safety | `requirePermissions: false` gives full access — shown with a warning banner |
| Role deletion | Cascade deletes assignments; audit log records the deletion |
| XSS in role names | Sanitize name/color inputs; use parameterized queries |
| Permission check bypass | All checks happen server-side; client-side is UX-only |

## Migration Strategy

### Phase 1: Foundation (no breaking changes)

1. Add schema models, run migration
2. Implement permission registry in `packages/types/`
3. Add `requirePermission` middleware (noop when `requirePermissions: false`)
4. Add `/my-permissions` endpoint
5. Add dashboard settings CRUD
6. **Default: `requirePermissions: false`** — all existing guilds unaffected

### Phase 2: API Integration

1. Add `requirePermission(...)` to all 18 route files
2. Add `auditLog(...)` hooks on all write endpoints
3. Add dashboard roles CRUD routes
4. Add role assignment routes
5. Add per-user permission routes
6. Implement audit log cleanup cron

### Phase 3: Dashboard UI

1. Build `usePermissions` hook
2. Build Settings > Roles & Permissions page
3. Add permission checks to all existing pages (conditional rendering)
4. Filter sidebar navigation by permissions
5. Build Permission Denied component

### Phase 4: Polish

1. Add role presets UI
2. Add user override management
3. Add audit log viewer with filters and CSV export
4. Add "effective permissions" preview (shows what a user can actually do)
5. Add warning banner when `requirePermissions` is disabled

## Testing Requirements

### Unit Tests

**Middleware** (`apps/dashboard/tests/server/middleware/`):
- `requirePermission` with exact match, wildcard match, no match
- Guild owner bypass
- Legacy mode bypass (`requirePermissions: false`)
- Multiple permissions required (AND logic)

**Permission matcher** (`packages/types/tests/`):
- Exact key match
- Single-level wildcard (`music.*`)
- Multi-level wildcard (`*.settings.manage`, `*.*.view`)
- Full wildcard (`*`)
- No match → denied

**Routes** (`apps/dashboard/tests/server/routes/`):
- CRUD for dashboard roles
- Role assignment
- Per-user permission overrides
- Audit log retrieval
- Preset creation
- Permission escalation prevention

### Integration Tests

**Cache sync** (`packages/systems/tests/integration/`):
- Role created via dashboard → permission cache updated
- Role deleted → assignments cascade → cache invalidated
- User permission override added → resolved permissions include it

### Frontend Tests

- `usePermissions` hook returns correct `can()` results
- Navigation filters hidden modules correctly
- Permission denied page renders for unauthorized access

## File Structure

```
packages/types/src/
  dashboard-permissions.ts          # Registry, matcher, presets, types

packages/database/prisma/
  schema.prisma                     # +4 models

apps/dashboard/src/server/
  middleware.ts                     # +requirePermission, +auditLog
  permissions.ts                    # resolveUserPermissions, cache logic
  routes/
    dashboardRoles.ts               # Roles CRUD + assignments
    dashboardPermissions.ts         # User overrides + my-permissions
    dashboardAudit.ts               # Audit log retrieval
    dashboardSettings.ts            # Guild dashboard settings

apps/dashboard/src/client/
  hooks/usePermissions.ts           # Permission hook
  components/PermissionDenied.tsx   # Access denied component
  components/PermissionGuard.tsx    # Wrapper component
  pages/Settings/Permissions/
    index.tsx                       # Main permissions page
    RoleEditor.tsx                  # Role detail panel
    PermissionGrid.tsx              # Module/permission checkbox grid
    UserOverrides.tsx               # Per-user overrides tab
    AuditLog.tsx                    # Audit log tab
```
