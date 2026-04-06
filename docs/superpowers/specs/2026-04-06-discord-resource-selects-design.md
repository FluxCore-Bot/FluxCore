# Discord Resource Select Components — Design Spec

**Date:** 2026-04-06  
**Branch:** `fix/discord-resource-selects`  
**Status:** Approved

---

## Problem

Eight dashboard feature pages require users to type raw Discord channel or role IDs into plain text inputs. The API to fetch guild channels and roles already exists (`GET /api/guilds/:guildId/channels` and `/roles`), the `useChannels` and `useRoles` hooks already exist, and `ActionFields.tsx` / `ConditionsEditor.tsx` already use proper select menus. The remaining pages bypass all of this.

---

## Goal

Replace every channel/role text input with a proper select menu populated from the current guild's live data. No text fallback — only dropdown selection.

---

## Architecture

### Two new shared components

#### `DiscordSelect` — `apps/dashboard/src/client/components/ui/discord-select.tsx`

Single-value select for one channel or one role.

**Props:**
```ts
interface DiscordSelectProps {
  guildId: string
  type: "text" | "voice" | "category" | "any" | "role"
  value: string | null
  onValueChange: (value: string | null) => void
  placeholder?: string
  allowNone?: boolean   // adds a "None" option → passes null
  disabled?: boolean
}
```

**Behaviour:**
- Calls `useChannels(guildId)` when `type !== "role"`, or `useRoles(guildId)` when `type === "role"`
- Filters channels: `"text"` → type 0, `"voice"` → type 2, `"category"` → type 4, `"any"` → types 0 | 2
- Channel labels: `# name` (text), `🔊 name` (voice), `📁 name` (category)
- Role labels: colored dot (`●`) using the role's hex color + role name
- Loading state: disabled `<SelectTrigger>` with skeleton pulse
- Error state: disabled trigger, label text "Failed to load"
- Empty list: single non-interactive item "No channels available" / "No roles available"
- `allowNone`: prepends a "None" `<SelectItem>` that calls `onValueChange(null)`

#### `DiscordMultiSelect` — `apps/dashboard/src/client/components/ui/discord-multi-select.tsx`

Multi-value chip-style select for multiple channels or roles.

**Props:**
```ts
interface DiscordMultiSelectProps {
  guildId: string
  type: "text" | "voice" | "any" | "role"
  selectedIds: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
  label?: string
}
```

**Behaviour:**
- Same internal fetch as `DiscordSelect`
- `<Select>` shows only unselected options; hidden once all options are selected
- Selected items render as removable chips (Badge with ×)
- Chip label falls back to raw ID if the channel/role no longer exists in the guild
- Loading/error states same as `DiscordSelect`

**`ConditionsEditor` refactor:**  
The private `IdSelector` component inside `ConditionsEditor.tsx` is replaced with `DiscordMultiSelect`. The `channels: Channel[]` and `roles: Role[]` props are removed from `ConditionsEditorProps`; the component receives `guildId: string` instead and fetches data internally.

---

## Pages Updated

| Page | Field | Change |
|------|-------|--------|
| `welcome.tsx` | Welcome channel | `Input` → `DiscordSelect type="text"` |
| `welcome.tsx` | Farewell channel | `Input` → `DiscordSelect type="text"` |
| `welcome.tsx` | Auto-role IDs | `Input` (comma CSV) → `DiscordMultiSelect type="role"` |
| `leveling.tsx` | Role reward role | `Input` → `DiscordSelect type="role"` |
| `leveling.tsx` | No-XP channels | `Input` (comma CSV) → `DiscordMultiSelect type="text"` |
| `leveling.tsx` | No-XP roles | `Input` (comma CSV) → `DiscordMultiSelect type="role"` |
| `leveling.tsx` | Multiplier target ID | `Input` → `DiscordSelect` with `type` driven by the multiplier-type select: `"text"` when "channels", `"role"` when "roles" |
| `tickets.tsx` | Panel channel | `Input` → `DiscordSelect type="text"` |
| `tickets.tsx` | Staff roles | `Input` (comma CSV) → `DiscordMultiSelect type="role"` |
| `tickets.tsx` | Transcript channel | `Input` → `DiscordSelect type="text"` |
| `starboard.tsx` | Starboard channel | `Input` → `DiscordSelect type="text"` |
| `starboard.tsx` | Ignored channels | `Input` (comma CSV) → `DiscordMultiSelect type="text"` |
| `suggestions.tsx` | Channel | `Input` → `DiscordSelect type="text"` |
| `suggestions.tsx` | Review channel | `Input` → `DiscordSelect type="text"` |
| `giveaways.tsx` | Channel | `Input` → `DiscordSelect type="text"` |
| `giveaways.tsx` | Required role | `Input` → `DiscordSelect type="role"` |
| `security.tsx` | Whitelisted roles | `Input` (comma CSV) → `DiscordMultiSelect type="role"` |
| `security.tsx` | Log channel | `Input` → `DiscordSelect type="text"` |

---

## State Shape Changes

Pages currently using `useState<string>` for comma-separated IDs change to `useState<string[]>`. The `.split(",").map(s => s.trim()).filter(Boolean)` parsing in save handlers is removed — the array is passed directly.

Pages using `useState<string>` for single-value IDs stay as `string | null` (matching `onValueChange` signature of `DiscordSelect`).

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| Loading | Disabled trigger with skeleton pulse |
| API error | Disabled trigger, "Failed to load" label, no toast |
| Empty guild (no channels/roles) | Enabled trigger, "No channels available" / "No roles available" item |
| Saved ID deleted from Discord | Chip falls back to raw ID display |
| All options selected (multi) | `<Select>` hidden, only chip list visible |

---

## Testing

No new unit test files. These components are thin wrappers over `useChannels`/`useRoles` (already tested) and shadcn `<Select>` (already tested). The existing Playwright e2e suite covers the affected pages end-to-end.

---

## Files Touched

**New:**
- `apps/dashboard/src/client/components/ui/discord-select.tsx`
- `apps/dashboard/src/client/components/ui/discord-multi-select.tsx`

**Modified:**
- `apps/dashboard/src/client/components/ConditionsEditor.tsx` (use `DiscordMultiSelect`, remove `channels`/`roles` props, add `guildId` prop)
- `apps/dashboard/src/client/components/RuleForm.tsx` (pass `guildId` instead of `channels`/`roles` to `ConditionsEditor`)
- `apps/dashboard/src/client/routes/guild/$guildId/welcome.tsx`
- `apps/dashboard/src/client/routes/guild/$guildId/leveling.tsx`
- `apps/dashboard/src/client/routes/guild/$guildId/tickets.tsx`
- `apps/dashboard/src/client/routes/guild/$guildId/starboard.tsx`
- `apps/dashboard/src/client/routes/guild/$guildId/suggestions.tsx`
- `apps/dashboard/src/client/routes/guild/$guildId/giveaways.tsx`
- `apps/dashboard/src/client/routes/guild/$guildId/security.tsx`
