# Discord Resource Select Components — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all channel/role text inputs across 8 dashboard feature pages with proper select menus populated from the guild's live data.

**Architecture:** Two new shared components — `DiscordSelect` (single-value) and `DiscordMultiSelect` (chip-style multi-value) — both fetch guild data internally via existing `useChannels`/`useRoles` hooks. `ConditionsEditor` is refactored to use `DiscordMultiSelect` internally, switching from `channels`/`roles` props to a single `guildId` prop. Each broken page then swaps its `<Input>` for the appropriate component.

**Tech Stack:** React 19, TanStack Query v5, shadcn/ui (`Select`, `Badge`, `Skeleton`), `useChannels`/`useRoles` hooks, Lucide via `Icon` component.

---

## File Map

**Create:**
- `apps/dashboard/src/client/components/ui/discord-select.tsx`
- `apps/dashboard/src/client/components/ui/discord-multi-select.tsx`

**Modify:**
- `apps/dashboard/src/client/components/ConditionsEditor.tsx`
- `apps/dashboard/src/client/components/RuleForm.tsx`
- `apps/dashboard/src/client/components/workflow/NodeDetailPanel.tsx`
- `apps/dashboard/src/client/components/workflow/WorkflowEditor.tsx`
- `apps/dashboard/src/client/routes/guild/$guildId/welcome.tsx`
- `apps/dashboard/src/client/routes/guild/$guildId/leveling.tsx`
- `apps/dashboard/src/client/routes/guild/$guildId/tickets.tsx`
- `apps/dashboard/src/client/routes/guild/$guildId/starboard.tsx`
- `apps/dashboard/src/client/routes/guild/$guildId/suggestions.tsx`
- `apps/dashboard/src/client/routes/guild/$guildId/giveaways.tsx`
- `apps/dashboard/src/client/routes/guild/$guildId/security.tsx`

---

## Task 0: Create the feature branch

- [ ] **Step 1: Create and switch to the feature branch**

```bash
git checkout main
git checkout -b fix/discord-resource-selects
```

---

## Task 1: Create `DiscordSelect`

**Files:**
- Create: `apps/dashboard/src/client/components/ui/discord-select.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { useChannels } from "../../lib/hooks/useChannels";
import { useRoles } from "../../lib/hooks/useRoles";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { Skeleton } from "./skeleton";

export type DiscordSelectType = "text" | "voice" | "category" | "any" | "role";

export interface DiscordSelectProps {
  guildId: string;
  type: DiscordSelectType;
  value: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  /** Adds a "None" option that passes null to onValueChange */
  allowNone?: boolean;
  disabled?: boolean;
  className?: string;
}

function channelLabel(name: string, channelType: number): string {
  if (channelType === 2) return `🔊 ${name}`;
  if (channelType === 4) return `📁 ${name}`;
  return `# ${name}`;
}

export function DiscordSelect({
  guildId,
  type,
  value,
  onValueChange,
  placeholder,
  allowNone,
  disabled,
  className,
}: DiscordSelectProps) {
  const isRole = type === "role";
  const {
    data: channels,
    isLoading: chLoading,
    isError: chError,
  } = useChannels(guildId);
  const {
    data: roles,
    isLoading: roLoading,
    isError: roError,
  } = useRoles(guildId);

  const isLoading = isRole ? roLoading : chLoading;
  const isError = isRole ? roError : chError;

  const options: { id: string; label: string }[] = isRole
    ? (roles ?? []).map((r) => ({ id: r.id, label: `● ${r.name}` }))
    : (channels ?? [])
        .filter((c) => {
          if (type === "text") return c.type === 0;
          if (type === "voice") return c.type === 2;
          if (type === "category") return c.type === 4;
          return c.type === 0 || c.type === 2; // "any"
        })
        .map((c) => ({ id: c.id, label: channelLabel(c.name, c.type) }));

  if (isLoading) {
    return <Skeleton className={`h-9 w-full ${className ?? ""}`} />;
  }

  if (isError) {
    return (
      <Select disabled>
        <SelectTrigger className={className}>
          <SelectValue placeholder="Failed to load" />
        </SelectTrigger>
      </Select>
    );
  }

  const defaultPlaceholder = isRole ? "Select a role" : "Select a channel";

  return (
    <Select
      value={value ?? ""}
      onValueChange={(v) =>
        onValueChange(v === "__none__" ? null : v || null)
      }
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder ?? defaultPlaceholder} />
      </SelectTrigger>
      <SelectContent>
        {allowNone && (
          <SelectItem value="__none__">None</SelectItem>
        )}
        {options.length === 0 ? (
          <SelectItem value="__empty__" disabled>
            {isRole ? "No roles available" : "No channels available"}
          </SelectItem>
        ) : (
          options.map((opt) => (
            <SelectItem key={opt.id} value={opt.id}>
              {opt.label}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: no errors in `discord-select.tsx`

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/client/components/ui/discord-select.tsx
git commit -m "feat(ui): add DiscordSelect component for single channel/role picks"
```

---

## Task 2: Create `DiscordMultiSelect`

**Files:**
- Create: `apps/dashboard/src/client/components/ui/discord-multi-select.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { useChannels } from "../../lib/hooks/useChannels";
import { useRoles } from "../../lib/hooks/useRoles";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { Badge } from "./badge";
import { Skeleton } from "./skeleton";
import { Label } from "./label";
import { Icon } from "../Icon";

export type DiscordMultiSelectType = "text" | "voice" | "any" | "role";

export interface DiscordMultiSelectProps {
  guildId: string;
  type: DiscordMultiSelectType;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  label?: string;
}

function channelLabel(name: string, channelType: number): string {
  return channelType === 2 ? `🔊 ${name}` : `# ${name}`;
}

export function DiscordMultiSelect({
  guildId,
  type,
  selectedIds,
  onChange,
  placeholder,
  label,
}: DiscordMultiSelectProps) {
  const isRole = type === "role";
  const {
    data: channels,
    isLoading: chLoading,
    isError: chError,
  } = useChannels(guildId);
  const {
    data: roles,
    isLoading: roLoading,
    isError: roError,
  } = useRoles(guildId);

  const isLoading = isRole ? roLoading : chLoading;
  const isError = isRole ? roError : chError;

  const allOptions: { id: string; name: string }[] = isRole
    ? (roles ?? []).map((r) => ({ id: r.id, name: r.name }))
    : (channels ?? [])
        .filter((c) => {
          if (type === "text") return c.type === 0;
          if (type === "voice") return c.type === 2;
          return c.type === 0 || c.type === 2; // "any"
        })
        .map((c) => ({ id: c.id, name: channelLabel(c.name, c.type) }));

  const available = allOptions.filter((o) => !selectedIds.includes(o.id));
  const chips = selectedIds.map((id) => {
    const found = allOptions.find((o) => o.id === id);
    return { id, label: found?.name ?? id };
  });

  function add(id: string) {
    if (!selectedIds.includes(id)) onChange([...selectedIds, id]);
  }

  function remove(id: string) {
    onChange(selectedIds.filter((v) => v !== id));
  }

  const defaultPlaceholder = isRole ? "Add a role..." : "Add a channel...";

  return (
    <div className="space-y-1.5">
      {label && <Label className="text-xs">{label}</Label>}
      {isLoading && <Skeleton className="h-8 w-full" />}
      {isError && (
        <Select disabled>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Failed to load" />
          </SelectTrigger>
        </Select>
      )}
      {!isLoading && !isError && available.length > 0 && (
        <Select value="" onValueChange={(v) => v && add(v)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder={placeholder ?? defaultPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {available.map((opt) => (
              <SelectItem key={opt.id} value={opt.id}>
                {opt.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <Badge
              key={chip.id}
              variant="secondary"
              className="gap-1 pe-1 text-[11px]"
            >
              {chip.label}
              <button
                type="button"
                onClick={() => remove(chip.id)}
                className="ms-0.5 rounded-full p-0.5 hover:bg-white/10"
              >
                <Icon name="close" size={10} />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: no errors in `discord-multi-select.tsx`

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/client/components/ui/discord-multi-select.tsx
git commit -m "feat(ui): add DiscordMultiSelect component for chip-style multi channel/role picks"
```

---

## Task 3: Refactor `ConditionsEditor` to use `DiscordMultiSelect`

**Files:**
- Modify: `apps/dashboard/src/client/components/ConditionsEditor.tsx`

The current `ConditionsEditor` has a private `IdSelector` component that takes `options: { id, name }[]` from props. We replace `IdSelector` with `DiscordMultiSelect` and change the props from `channels: Channel[], roles: Role[]` to `guildId: string`.

- [ ] **Step 1: Replace `ConditionsEditor.tsx` content**

Replace the entire file with:

```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "./Icon";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { DiscordMultiSelect } from "./ui/discord-multi-select";
import type { ActionConditions } from "../lib/schemas";

interface ConditionsEditorProps {
  guildId: string;
  conditions: ActionConditions;
  onChange: (conditions: ActionConditions) => void;
  compact?: boolean;
  /** Always show expanded, no collapse button */
  alwaysExpanded?: boolean;
}

function ChipList({
  items,
  onRemove,
  color = "secondary",
}: {
  items: { id: string; label: string }[];
  onRemove: (id: string) => void;
  color?: "secondary" | "destructive";
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Badge
          key={item.id}
          variant={color}
          className="gap-1 pe-1 text-[11px]"
        >
          {item.label}
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="ms-0.5 rounded-full p-0.5 hover:bg-white/10"
          >
            <Icon name="close" size={10} />
          </button>
        </Badge>
      ))}
    </div>
  );
}

function UserIdInput({
  label,
  selectedIds,
  onAdd,
  onRemove,
  chipColor = "secondary",
}: {
  label: string;
  selectedIds: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  chipColor?: "secondary" | "destructive";
}) {
  const { t } = useTranslation("rules");
  const [input, setInput] = useState("");

  const handleAdd = () => {
    const id = input.trim();
    if (id && /^\d{17,20}$/.test(id) && !selectedIds.includes(id)) {
      onAdd(id);
      setInput("");
    }
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-1.5">
        <Input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" && (e.preventDefault(), handleAdd())
          }
          placeholder={t("conditions.userId")}
          className="h-8 flex-1 text-xs"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={handleAdd}
          disabled={!input.trim() || !/^\d{17,20}$/.test(input.trim())}
        >
          <Icon name="add" size={14} />
        </Button>
      </div>
      <ChipList
        items={selectedIds.map((id) => ({ id, label: id }))}
        onRemove={onRemove}
        color={chipColor}
      />
    </div>
  );
}

export function ConditionsEditor({
  guildId,
  conditions,
  onChange,
  compact,
  alwaysExpanded,
}: ConditionsEditorProps) {
  const { t } = useTranslation("rules");
  const update = (patch: Partial<ActionConditions>) => {
    onChange({ ...conditions, ...patch });
  };

  const hasAnyConditions =
    (conditions.channelIds?.length ?? 0) +
      (conditions.roleIds?.length ?? 0) +
      (conditions.userIds?.length ?? 0) +
      (conditions.excludeChannelIds?.length ?? 0) +
      (conditions.excludeRoleIds?.length ?? 0) +
      (conditions.excludeUserIds?.length ?? 0) >
    0;

  const [expanded, setExpanded] = useState(
    hasAnyConditions || !!alwaysExpanded,
  );

  if (!expanded && !alwaysExpanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-text-muted transition-colors hover:border-accent/30 hover:text-accent"
      >
        <Icon name="filter_alt" size={14} />
        {t("conditions.addConditions")}
        {hasAnyConditions && (
          <Badge variant="secondary" className="ms-auto text-xs">
            {(conditions.channelIds?.length ?? 0) +
              (conditions.roleIds?.length ?? 0) +
              (conditions.userIds?.length ?? 0) +
              (conditions.excludeChannelIds?.length ?? 0) +
              (conditions.excludeRoleIds?.length ?? 0) +
              (conditions.excludeUserIds?.length ?? 0)}{" "}
            {t("conditions.active")}
          </Badge>
        )}
      </button>
    );
  }

  return (
    <div
      className={`space-y-4 rounded-lg border border-border ${compact ? "p-3" : "p-4"}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="filter_alt" size={16} className="text-accent" />
          <span className="text-xs font-semibold">{t("conditions.title")}</span>
        </div>
        {!alwaysExpanded && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setExpanded(false)}
          >
            <Icon name="expand_less" size={14} />
          </Button>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-text-muted">
        {t("conditions.description")}
      </p>

      {/* Include filters */}
      <div className="space-y-3">
        <span className="section-label text-secondary">
          {t("conditions.include")}
        </span>
        <DiscordMultiSelect
          guildId={guildId}
          type="any"
          selectedIds={conditions.channelIds ?? []}
          onChange={(ids) => update({ channelIds: ids })}
          placeholder={t("conditions.addChannel")}
          label={t("conditions.channels")}
        />
        <DiscordMultiSelect
          guildId={guildId}
          type="role"
          selectedIds={conditions.roleIds ?? []}
          onChange={(ids) => update({ roleIds: ids })}
          placeholder={t("conditions.addRole")}
          label={t("conditions.roles")}
        />
        <UserIdInput
          label={t("conditions.users")}
          selectedIds={conditions.userIds ?? []}
          onAdd={(id) => {
            const current = conditions.userIds ?? [];
            if (!current.includes(id)) update({ userIds: [...current, id] });
          }}
          onRemove={(id) =>
            update({ userIds: (conditions.userIds ?? []).filter((v) => v !== id) })
          }
        />
      </div>

      {/* Exclude filters */}
      <div className="space-y-3 border-t border-border pt-3">
        <span className="section-label text-danger">
          {t("conditions.exclude")}
        </span>
        <DiscordMultiSelect
          guildId={guildId}
          type="any"
          selectedIds={conditions.excludeChannelIds ?? []}
          onChange={(ids) => update({ excludeChannelIds: ids })}
          placeholder={t("conditions.excludeChannel")}
          label={t("conditions.channels")}
        />
        <DiscordMultiSelect
          guildId={guildId}
          type="role"
          selectedIds={conditions.excludeRoleIds ?? []}
          onChange={(ids) => update({ excludeRoleIds: ids })}
          placeholder={t("conditions.excludeRole")}
          label={t("conditions.roles")}
        />
        <UserIdInput
          label={t("conditions.users")}
          selectedIds={conditions.excludeUserIds ?? []}
          onAdd={(id) => {
            const current = conditions.excludeUserIds ?? [];
            if (!current.includes(id))
              update({ excludeUserIds: [...current, id] });
          }}
          onRemove={(id) =>
            update({
              excludeUserIds: (conditions.excludeUserIds ?? []).filter(
                (v) => v !== id,
              ),
            })
          }
          chipColor="destructive"
        />
      </div>

      {hasAnyConditions && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full text-xs text-text-muted"
          onClick={() => onChange({})}
        >
          {t("conditions.clearAll")}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: TypeScript errors on `RuleForm.tsx` and `NodeDetailPanel.tsx` because they still pass `channels`/`roles` — that's expected, fix in next task.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/client/components/ConditionsEditor.tsx
git commit -m "refactor(ui): ConditionsEditor accepts guildId, uses DiscordMultiSelect internally"
```

---

## Task 4: Update `RuleForm` and `NodeDetailPanel` / `WorkflowEditor`

**Files:**
- Modify: `apps/dashboard/src/client/components/RuleForm.tsx`
- Modify: `apps/dashboard/src/client/components/workflow/NodeDetailPanel.tsx`
- Modify: `apps/dashboard/src/client/components/workflow/WorkflowEditor.tsx`

### 4a — RuleForm

`RuleForm` currently calls `useChannels(guildId)` and `useRoles(guildId)` and passes the results to `ConditionsEditor`. Remove those two hook calls and pass `guildId` to `ConditionsEditor` instead.

- [ ] **Step 1: In `RuleForm.tsx`, remove channel/role imports and hook calls**

Remove lines 5-6:
```ts
import { useChannels } from "../lib/hooks/useChannels";
import { useRoles } from "../lib/hooks/useRoles";
```

Remove lines 55-56:
```ts
  const { data: channels = [] } = useChannels(guildId);
  const { data: roles = [] } = useRoles(guildId);
```

- [ ] **Step 2: In `RuleForm.tsx`, update the `ConditionsEditor` call (around line 272)**

Change:
```tsx
          <ConditionsEditor
            conditions={conditions}
            onChange={setConditions}
            channels={channels}
            roles={roles}
          />
```

To:
```tsx
          <ConditionsEditor
            guildId={guildId}
            conditions={conditions}
            onChange={setConditions}
          />
```

### 4b — NodeDetailPanel

`NodeDetailPanel` receives `channels: Channel[]` and `roles: Role[]` as props and passes them to both `ConditionsEditor` and `ActionFields`. Change it to receive `guildId: string`, fetch channels/roles internally, and pass `guildId` to `ConditionsEditor`.

- [ ] **Step 3: In `NodeDetailPanel.tsx`, update all panel prop interfaces**

In `NodeDetailPanel.tsx`, each panel interface (`TriggerPanelProps`, `ActionPanelProps`, any step panel interface) currently has `channels: Channel[]` and `roles: Role[]`. Replace those two fields with `guildId: string` in every interface.

Find all occurrences of:
```ts
  channels: Channel[];
  roles: Role[];
```
Replace with:
```ts
  guildId: string;
```

Also remove the `Channel` and `Role` type imports if they are no longer used elsewhere in the file.

- [ ] **Step 4: In `NodeDetailPanel.tsx`, add internal data fetching**

At the top of each panel component function (or in the main `NodeDetailPanel` function), add:
```ts
import { useChannels } from "../../lib/hooks/useChannels";
import { useRoles } from "../../lib/hooks/useRoles";
```

And inside the component body where `guildId` is available:
```ts
const { data: channels = [] } = useChannels(guildId);
const { data: roles = [] } = useRoles(guildId);
```

- [ ] **Step 5: In `NodeDetailPanel.tsx`, update `ConditionsEditor` calls**

Change:
```tsx
        <ConditionsEditor
          conditions={conditions}
          onChange={onConditionsChange}
          channels={channels}
          roles={roles}
          alwaysExpanded
        />
```
To:
```tsx
        <ConditionsEditor
          guildId={guildId}
          conditions={conditions}
          onChange={onConditionsChange}
          alwaysExpanded
        />
```

### 4c — WorkflowEditor

- [ ] **Step 6: In `WorkflowEditor.tsx`, remove channel/role hook calls and pass `guildId` to `NodeDetailPanel`**

Remove:
```ts
import { useChannels } from "../../lib/hooks/useChannels";
import { useRoles } from "../../lib/hooks/useRoles";
```
And:
```ts
  const { data: channels = [] } = useChannels(guildId);
  const { data: roles = [] } = useRoles(guildId);
```

In each `<NodeDetailPanel>` call (there are 3), replace `channels={channels} roles={roles}` with `guildId={guildId}`.

- [ ] **Step 7: Verify TypeScript compiles cleanly**

Run: `pnpm typecheck`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add apps/dashboard/src/client/components/RuleForm.tsx \
        apps/dashboard/src/client/components/workflow/NodeDetailPanel.tsx \
        apps/dashboard/src/client/components/workflow/WorkflowEditor.tsx
git commit -m "refactor(ui): pass guildId to ConditionsEditor and NodeDetailPanel instead of channels/roles arrays"
```

---

## Task 5: Fix `welcome.tsx`

**Files:**
- Modify: `apps/dashboard/src/client/routes/guild/$guildId/welcome.tsx`

**Fields to fix:**
- `welcomeChannelId`: `useState<string>` → `useState<string | null>`, replace `<Input>` with `<DiscordSelect type="text">`
- `farewellChannelId`: same
- `autoRoleIds`: `useState<string>` → `useState<string[]>`, replace `<Input>` with `<DiscordMultiSelect type="role">`

- [ ] **Step 1: Add imports**

Add to the imports at the top of the file:
```tsx
import { DiscordSelect } from "../../../components/ui/discord-select";
import { DiscordMultiSelect } from "../../../components/ui/discord-multi-select";
```

- [ ] **Step 2: Change state declarations**

Change:
```ts
  const [welcomeChannelId, setWelcomeChannelId] = useState("");
```
To:
```ts
  const [welcomeChannelId, setWelcomeChannelId] = useState<string | null>(null);
```

Change:
```ts
  const [farewellChannelId, setFarewellChannelId] = useState("");
```
To:
```ts
  const [farewellChannelId, setFarewellChannelId] = useState<string | null>(null);
```

Change:
```ts
  const [autoRoleIds, setAutoRoleIds] = useState("");
```
To:
```ts
  const [autoRoleIds, setAutoRoleIds] = useState<string[]>([]);
```

- [ ] **Step 3: Fix `useEffect` sync from server**

Change:
```ts
      setWelcomeChannelId(config.welcomeChannelId ?? "");
```
To:
```ts
      setWelcomeChannelId(config.welcomeChannelId ?? null);
```

Change:
```ts
      setFarewellChannelId(config.farewellChannelId ?? "");
```
To:
```ts
      setFarewellChannelId(config.farewellChannelId ?? null);
```

Change:
```ts
      setAutoRoleIds(config.autoRoleIds.join(", "));
```
To:
```ts
      setAutoRoleIds(config.autoRoleIds);
```

- [ ] **Step 4: Fix `handleSave`**

Remove the `roleIds` CSV parse block:
```ts
    const roleIds = autoRoleIds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
```

Change `autoRoleIds: roleIds` to `autoRoleIds: autoRoleIds` and change `welcomeChannelId: welcomeChannelId || null` to `welcomeChannelId: welcomeChannelId` and `farewellChannelId: farewellChannelId || null` to `farewellChannelId: farewellChannelId`.

- [ ] **Step 5: Replace welcome channel `<Input>` (around line 253)**

Replace:
```tsx
              <Input
                id="welcome-channel"
                placeholder={t("welcome.channelPlaceholder")}
                value={welcomeChannelId}
                onChange={(e) => setWelcomeChannelId(e.target.value)}
                className="mt-1 w-64"
              />
```
With:
```tsx
              <DiscordSelect
                guildId={guildId}
                type="text"
                value={welcomeChannelId}
                onValueChange={setWelcomeChannelId}
                placeholder={t("welcome.channelPlaceholder")}
                allowNone
                className="mt-1 w-64"
              />
```

- [ ] **Step 6: Replace farewell channel `<Input>` (around line 319)**

Replace:
```tsx
              <Input
                id="farewell-channel"
                placeholder={t("farewell.channelPlaceholder")}
                value={farewellChannelId}
                onChange={(e) => setFarewellChannelId(e.target.value)}
                className="mt-1 w-64"
              />
```
With:
```tsx
              <DiscordSelect
                guildId={guildId}
                type="text"
                value={farewellChannelId}
                onValueChange={setFarewellChannelId}
                placeholder={t("farewell.channelPlaceholder")}
                allowNone
                className="mt-1 w-64"
              />
```

- [ ] **Step 7: Replace auto-role `<Input>` (around line 400)**

Replace:
```tsx
              <Input
                id="autorole-ids"
                placeholder={t("autorole.placeholder")}
                value={autoRoleIds}
                onChange={(e) => setAutoRoleIds(e.target.value)}
                className="mt-1"
              />
```
With:
```tsx
              <DiscordMultiSelect
                guildId={guildId}
                type="role"
                selectedIds={autoRoleIds}
                onChange={setAutoRoleIds}
                placeholder={t("autorole.placeholder")}
              />
```

- [ ] **Step 8: Remove unused `Input` import if no longer used in the file**

Check if `Input` is still used elsewhere in `welcome.tsx`. The `EmbedEditor` sub-component uses `Input` for embed title/description/etc., so leave the import.

- [ ] **Step 9: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: no errors

- [ ] **Step 10: Commit**

```bash
git add "apps/dashboard/src/client/routes/guild/\$guildId/welcome.tsx"
git commit -m "fix(ui): replace channel/role text inputs with DiscordSelect in welcome page"
```

---

## Task 6: Fix `leveling.tsx`

**Files:**
- Modify: `apps/dashboard/src/client/routes/guild/$guildId/leveling.tsx`

**Fields to fix:**
- `newRewardRole`: `useState<string>` → `useState<string | null>`, replace `<Input>` with `<DiscordSelect type="role">`
- `noXpChannelsInput`: `useState<string>` → `useState<string[]>`, replace `<Input>` with `<DiscordMultiSelect type="text">`
- `noXpRolesInput`: `useState<string>` → `useState<string[]>`, replace `<Input>` with `<DiscordMultiSelect type="role">`
- Multiplier `multiplierId`: `useState<string>` stays but `<Input>` → `<DiscordSelect>` with type driven by `multiplierType`

- [ ] **Step 1: Add imports**

```tsx
import { DiscordSelect } from "../../../components/ui/discord-select";
import { DiscordMultiSelect } from "../../../components/ui/discord-multi-select";
```

- [ ] **Step 2: Change state declarations**

```ts
// Before
const [newRewardRole, setNewRewardRole] = useState("");
const [noXpChannelsInput, setNoXpChannelsInput] = useState("");
const [noXpRolesInput, setNoXpRolesInput] = useState("");

// After
const [newRewardRole, setNewRewardRole] = useState<string | null>(null);
const [noXpChannels, setNoXpChannels] = useState<string[]>([]);
const [noXpRoles, setNoXpRoles] = useState<string[]>([]);
```

- [ ] **Step 3: Fix `useEffect` sync (around line 232)**

Remove:
```ts
  const noXpChannelsValue =
    noXpChannelsInput || (settings?.noXpChannels ?? []).join(", ");
  const noXpRolesValue =
    noXpRolesInput || (settings?.noXpRoles ?? []).join(", ");
```

These derived values are no longer needed since we use `noXpChannels` and `noXpRoles` arrays directly.

In the `useEffect` that syncs from settings, there is no explicit set for noXp exclusions (they are derived). Add a `useEffect` that syncs them when settings load:

Look for the existing `useEffect` or add one that sets:
```ts
  useEffect(() => {
    if (settings) {
      setNoXpChannels(settings.noXpChannels ?? []);
      setNoXpRoles(settings.noXpRoles ?? []);
    }
  }, [settings]);
```

- [ ] **Step 4: Fix `handleAddReward`**

Change:
```ts
    if (!newRewardRole.trim()) {
      toast.error(t("toast.roleIdRequired"));
      return;
    }
    addReward.mutate(
      { level, roleId: newRewardRole.trim() },
      {
        onSuccess: () => {
          toast.success(t("toast.rewardAdded"));
          setNewRewardLevel("");
          setNewRewardRole("");
        },
```
To:
```ts
    if (!newRewardRole) {
      toast.error(t("toast.roleIdRequired"));
      return;
    }
    addReward.mutate(
      { level, roleId: newRewardRole },
      {
        onSuccess: () => {
          toast.success(t("toast.rewardAdded"));
          setNewRewardLevel("");
          setNewRewardRole(null);
        },
```

- [ ] **Step 5: Fix `handleSaveExclusions`**

Replace:
```ts
  function handleSaveExclusions() {
    const channels = noXpChannelsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const roles = noXpRolesInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    updateSettings.mutate(
      { noXpChannels: channels, noXpRoles: roles },
```
With:
```ts
  function handleSaveExclusions() {
    updateSettings.mutate(
      { noXpChannels: noXpChannels, noXpRoles: noXpRoles },
```

- [ ] **Step 6: Fix `handleAddMultiplier` — change `multiplierId.trim()` check**

Change:
```ts
    if (!multiplierId.trim() || !multiplierValue.trim()) {
```
To:
```ts
    if (!multiplierId || !multiplierValue.trim()) {
```

And change:
```ts
        [multiplierId.trim()]: val,
```
To:
```ts
        [multiplierId]: val,
```

And in `onSuccess`:
```ts
          setMultiplierId("");
```
To:
```ts
          setMultiplierId("");   // stays as string for multipliers, cleared to empty string is fine
```

- [ ] **Step 7: Replace reward role `<Input>` (around line 555)**

Replace:
```tsx
              <div>
                <Label htmlFor="reward-role">{t("roleRewards.roleId")}</Label>
                <Input
                  id="reward-role"
                  placeholder={t("roleRewards.rolePlaceholder")}
                  value={newRewardRole}
                  onChange={(e) => setNewRewardRole(e.target.value)}
                  className="w-48"
                />
              </div>
```
With:
```tsx
              <div>
                <Label htmlFor="reward-role">{t("roleRewards.roleId")}</Label>
                <DiscordSelect
                  guildId={guildId}
                  type="role"
                  value={newRewardRole}
                  onValueChange={setNewRewardRole}
                  placeholder={t("roleRewards.rolePlaceholder")}
                  className="w-48"
                />
              </div>
```

- [ ] **Step 8: Replace no-XP channels `<Input>` (around line 584)**

Replace:
```tsx
                <Input
                  id="no-xp-channels"
                  placeholder={t("exclusions.noXpChannelsPlaceholder")}
                  value={noXpChannelsValue}
                  onChange={(e) => setNoXpChannelsInput(e.target.value)}
                />
```
With:
```tsx
                <DiscordMultiSelect
                  guildId={guildId}
                  type="text"
                  selectedIds={noXpChannels}
                  onChange={setNoXpChannels}
                  placeholder={t("exclusions.noXpChannelsPlaceholder")}
                />
```

- [ ] **Step 9: Replace no-XP roles `<Input>` (around line 593)**

Replace:
```tsx
                <Input
                  id="no-xp-roles"
                  placeholder={t("exclusions.noXpRolesPlaceholder")}
                  value={noXpRolesValue}
                  onChange={(e) => setNoXpRolesInput(e.target.value)}
                />
```
With:
```tsx
                <DiscordMultiSelect
                  guildId={guildId}
                  type="role"
                  selectedIds={noXpRoles}
                  onChange={setNoXpRoles}
                  placeholder={t("exclusions.noXpRolesPlaceholder")}
                />
```

- [ ] **Step 10: Replace multiplier ID `<Input>` (around line 715)**

Find the multiplier add form. It has a Select for multiplier type (`"channels"` or `"roles"`) and an Input for the ID. Replace the Input with a `DiscordSelect` whose type depends on `multiplierType`:

Replace:
```tsx
                <Input
                  id="multiplier-id"
                  placeholder={t("multipliers.idPlaceholder")}
                  value={multiplierId}
                  onChange={(e) => setMultiplierId(e.target.value)}
                />
```
With:
```tsx
                <DiscordSelect
                  guildId={guildId}
                  type={multiplierType === "channels" ? "text" : "role"}
                  value={multiplierId || null}
                  onValueChange={(v) => setMultiplierId(v ?? "")}
                  placeholder={t("multipliers.idPlaceholder")}
                />
```

- [ ] **Step 11: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: no errors

- [ ] **Step 12: Commit**

```bash
git add "apps/dashboard/src/client/routes/guild/\$guildId/leveling.tsx"
git commit -m "fix(ui): replace channel/role text inputs with DiscordSelect in leveling page"
```

---

## Task 7: Fix `tickets.tsx`

**Files:**
- Modify: `apps/dashboard/src/client/routes/guild/$guildId/tickets.tsx`

**Fields to fix:**
- `newPanelChannel`: `useState<string>` → `useState<string | null>`, replace `<Input>` with `<DiscordSelect type="text">`
- `staffRolesInput`: `useState<string>` → `useState<string[]>`, replace `<Input>` with `<DiscordMultiSelect type="role">`
- `transcriptChannelInput`: `useState<string>` → `useState<string | null>`, replace `<Input>` with `<DiscordSelect type="text">`

- [ ] **Step 1: Add imports**

```tsx
import { DiscordSelect } from "../../../components/ui/discord-select";
import { DiscordMultiSelect } from "../../../components/ui/discord-multi-select";
```

- [ ] **Step 2: Change state declarations**

```ts
// Before
const [newPanelChannel, setNewPanelChannel] = useState("");
const [staffRolesInput, setStaffRolesInput] = useState("");
const [transcriptChannelInput, setTranscriptChannelInput] = useState("");

// After
const [newPanelChannel, setNewPanelChannel] = useState<string | null>(null);
const [staffRoles, setStaffRoles] = useState<string[]>([]);
const [transcriptChannelId, setTranscriptChannelId] = useState<string | null>(null);
```

- [ ] **Step 3: Fix panel creation handler**

Change:
```ts
    if (!newPanelName.trim() || !newPanelChannel.trim()) {
```
To:
```ts
    if (!newPanelName.trim() || !newPanelChannel) {
```

Change:
```ts
        channelId: newPanelChannel.trim(),
```
To:
```ts
        channelId: newPanelChannel,
```

Change:
```ts
          setNewPanelChannel("");
```
To:
```ts
          setNewPanelChannel(null);
```

- [ ] **Step 4: Fix settings save handler**

Replace the staff roles CSV parse:
```ts
    const staffRoleIds = staffRolesInput
      ? staffRolesInput.split(",").map((s) => s.trim()).filter(Boolean)
      : settings?.staffRoleIds ?? [];
    const transcriptChannelId = transcriptChannelInput.trim() || settings?.transcriptChannelId || null;
    updateSettings.mutate(
      { staffRoleIds, transcriptChannelId },
```
With:
```ts
    updateSettings.mutate(
      { staffRoleIds: staffRoles, transcriptChannelId },
```

- [ ] **Step 5: Fix `useEffect` sync**

In the `useEffect` that syncs from settings, replace:
```ts
    // any line setting staffRolesInput or transcriptChannelInput
```
With initialization of the new state. Look for where settings are loaded and add:
```ts
      setStaffRoles(settings?.staffRoleIds ?? []);
      setTranscriptChannelId(settings?.transcriptChannelId ?? null);
```

- [ ] **Step 6: Replace panel channel `<Input>` (around line 413)**

Replace:
```tsx
                <Input
                  id="panel-channel"
                  placeholder={t("panelBuilder.channel")}
                  value={newPanelChannel}
                  onChange={(e) => setNewPanelChannel(e.target.value)}
                />
```
With:
```tsx
                <DiscordSelect
                  guildId={guildId}
                  type="text"
                  value={newPanelChannel}
                  onValueChange={setNewPanelChannel}
                  placeholder={t("panelBuilder.channel")}
                />
```

- [ ] **Step 7: Replace staff roles `<Input>` (around line 439)**

Replace:
```tsx
                  <Input
                    id="staff-roles"
                    placeholder="e.g. 123456789, 987654321"
                    value={staffRolesValue}
                    onChange={(e) => setStaffRolesInput(e.target.value)}
                  />
```
With:
```tsx
                  <DiscordMultiSelect
                    guildId={guildId}
                    type="role"
                    selectedIds={staffRoles}
                    onChange={setStaffRoles}
                    placeholder={t("settings.staffRoles")}
                  />
```

- [ ] **Step 8: Replace transcript channel `<Input>` (around line 454)**

Replace:
```tsx
                  <Input
                    id="transcript-channel"
                    placeholder="e.g. 123456789"
                    value={transcriptChannelValue}
                    onChange={(e) => setTranscriptChannelInput(e.target.value)}
                  />
```
With:
```tsx
                  <DiscordSelect
                    guildId={guildId}
                    type="text"
                    value={transcriptChannelId}
                    onValueChange={setTranscriptChannelId}
                    allowNone
                    placeholder={t("settings.transcriptChannelDesc")}
                  />
```

- [ ] **Step 9: Remove derived value variables**

Delete:
```ts
  const staffRolesValue = staffRolesInput || (settings?.staffRoleIds ?? []).join(", ");
  const transcriptChannelValue = transcriptChannelInput || settings?.transcriptChannelId || "";
```

- [ ] **Step 10: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: no errors

- [ ] **Step 11: Commit**

```bash
git add "apps/dashboard/src/client/routes/guild/\$guildId/tickets.tsx"
git commit -m "fix(ui): replace channel/role text inputs with DiscordSelect in tickets page"
```

---

## Task 8: Fix `starboard.tsx`

**Files:**
- Modify: `apps/dashboard/src/client/routes/guild/$guildId/starboard.tsx`

**Fields to fix:**
- `channelId` (`useState<string>`): → `useState<string | null>`, replace `<Input>` with `<DiscordSelect type="text">`
- `ignoredChannels` (`useState<string>` CSV): → `useState<string[]>`, replace `<Input>` with `<DiscordMultiSelect type="text">`

- [ ] **Step 1: Add imports**

```tsx
import { DiscordSelect } from "../../../components/ui/discord-select";
import { DiscordMultiSelect } from "../../../components/ui/discord-multi-select";
```

- [ ] **Step 2: Change state declarations**

```ts
// Before
const [channelId, setChannelId] = useState("");
const [ignoredChannels, setIgnoredChannels] = useState("");

// After
const [channelId, setChannelId] = useState<string | null>(null);
const [ignoredChannels, setIgnoredChannels] = useState<string[]>([]);
```

- [ ] **Step 3: Fix `useEffect` sync**

```ts
// Before
      setChannelId(settings.channelId ?? "");
      setIgnoredChannels(settings.ignoredChannels.join(", "));

// After
      setChannelId(settings.channelId ?? null);
      setIgnoredChannels(settings.ignoredChannels);
```

- [ ] **Step 4: Fix save handler**

```ts
// Before
    const ignored = ignoredChannels
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    // ...
        channelId: channelId || null,
        // ...
        ignoredChannels: ignored,

// After
    // remove the ignored parsing block, use ignoredChannels directly
        channelId: channelId,
        // ...
        ignoredChannels: ignoredChannels,
```

- [ ] **Step 5: Replace starboard channel `<Input>` (around line 137)**

Replace:
```tsx
                <Input
                  id="starboard-channel"
                  placeholder={t("settings.channelId")}
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                />
```
With:
```tsx
                <DiscordSelect
                  guildId={guildId}
                  type="text"
                  value={channelId}
                  onValueChange={setChannelId}
                  placeholder={t("settings.channelId")}
                  allowNone
                />
```

- [ ] **Step 6: Replace ignored channels `<Input>` (around line 198)**

Replace:
```tsx
                <Input
                  id="starboard-ignored"
                  placeholder="123456789, 987654321"
                  value={ignoredChannels}
                  onChange={(e) => setIgnoredChannels(e.target.value)}
                />
```
With:
```tsx
                <DiscordMultiSelect
                  guildId={guildId}
                  type="text"
                  selectedIds={ignoredChannels}
                  onChange={setIgnoredChannels}
                  placeholder={t("settings.ignoredChannels")}
                />
```

- [ ] **Step 7: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add "apps/dashboard/src/client/routes/guild/\$guildId/starboard.tsx"
git commit -m "fix(ui): replace channel text inputs with DiscordSelect in starboard page"
```

---

## Task 9: Fix `suggestions.tsx`

**Files:**
- Modify: `apps/dashboard/src/client/routes/guild/$guildId/suggestions.tsx`

**Fields to fix:**

- `channelId` (around line 354): uncontrolled `<Input defaultValue onBlur>` → `<DiscordSelect>`
- `reviewChannelId` (around line 369): same

The page uses an immediate-save pattern — `handleChannelSetting` at line 111 calls `mutate` directly. The current inputs use `defaultValue`+`onBlur`. We switch to a controlled select that saves on `onValueChange`.

Also fix `handleChannelSetting` to handle `null` properly (currently calls `value.trim() || null`; a `null` from DiscordSelect should be passed as `null` directly).

- [ ] **Step 1: Add import**

```tsx
import { DiscordSelect } from "../../../components/ui/discord-select";
```

- [ ] **Step 2: Update `handleChannelSetting` to accept `string | null`**

Change:

```ts
  function handleChannelSetting(key: "channelId" | "reviewChannelId", value: string) {
    const channelId = value.trim() || null;
    updateSettings.mutate(
      { [key]: channelId },
```

To:

```ts
  function handleChannelSetting(key: "channelId" | "reviewChannelId", value: string | null) {
    updateSettings.mutate(
      { [key]: value },
```

- [ ] **Step 3: Replace suggestions channel `<Input>` (around line 354)**

Replace:

```tsx
                  <Input
                    id="suggestions-channel"
                    placeholder="e.g. 123456789012345678"
                    defaultValue={settings.channelId ?? ""}
                    onBlur={(e) => handleChannelSetting("channelId", e.target.value)}
                  />
```

With:

```tsx
                  <DiscordSelect
                    guildId={guildId}
                    type="text"
                    value={settings.channelId ?? null}
                    onValueChange={(v) => handleChannelSetting("channelId", v)}
                    allowNone
                    placeholder={t("settings.channel")}
                  />
```

- [ ] **Step 4: Replace review channel `<Input>` (around line 369)**

Replace:

```tsx
                  <Input
                    id="review-channel"
                    placeholder="e.g. 123456789012345678"
                    defaultValue={settings.reviewChannelId ?? ""}
                    onBlur={(e) => handleChannelSetting("reviewChannelId", e.target.value)}
                  />
```

With:

```tsx
                  <DiscordSelect
                    guildId={guildId}
                    type="text"
                    value={settings.reviewChannelId ?? null}
                    onValueChange={(v) => handleChannelSetting("reviewChannelId", v)}
                    allowNone
                    placeholder={t("common:labels.channel")}
                  />
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add "apps/dashboard/src/client/routes/guild/\$guildId/suggestions.tsx"
git commit -m "fix(ui): replace channel text inputs with DiscordSelect in suggestions page"
```

---

## Task 10: Fix `giveaways.tsx`

**Files:**
- Modify: `apps/dashboard/src/client/routes/guild/$guildId/giveaways.tsx`

**Fields to fix:**
- `channelId`: `useState<string>` → `useState<string | null>`, replace `<Input>` with `<DiscordSelect type="text">`
- `requiredRoleId`: `useState<string>` → `useState<string | null>`, replace `<Input>` with `<DiscordSelect type="role">`

- [ ] **Step 1: Add imports**

```tsx
import { DiscordSelect } from "../../../components/ui/discord-select";
```

- [ ] **Step 2: Change state declarations**

```ts
// Before
const [channelId, setChannelId] = useState("");
const [requiredRoleId, setRequiredRoleId] = useState("");

// After
const [channelId, setChannelId] = useState<string | null>(null);
const [requiredRoleId, setRequiredRoleId] = useState<string | null>(null);
```

- [ ] **Step 3: Fix creation handler**

```ts
// Before
    if (!channelId.trim()) {
// ...
        channelId: channelId.trim(),
// ...
        requiredRoleIds,
    const requiredRoleIds = requiredRoleId.trim()
      ? requiredRoleId
          .split(",")...

// After
    if (!channelId) {
// ...
        channelId: channelId,
// ...
        requiredRoleIds: requiredRoleId ? [requiredRoleId] : [],
```

After success, reset with:
```ts
          setChannelId(null);
          setRequiredRoleId(null);
```

- [ ] **Step 4: Replace channel `<Input>` (around line 389)**

Replace:
```tsx
                <Input
                  id="gw-channel"
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                />
```
With:
```tsx
                <DiscordSelect
                  guildId={guildId}
                  type="text"
                  value={channelId}
                  onValueChange={setChannelId}
                  placeholder={t("form.channel")}
                />
```

- [ ] **Step 5: Replace required role `<Input>` (around line 441)**

Replace:
```tsx
                <Input
                  id="gw-role"
                  value={requiredRoleId}
                  onChange={(e) => setRequiredRoleId(e.target.value)}
                />
```
With:
```tsx
                <DiscordSelect
                  guildId={guildId}
                  type="role"
                  value={requiredRoleId}
                  onValueChange={setRequiredRoleId}
                  placeholder={t("form.requiredRole")}
                  allowNone
                />
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add "apps/dashboard/src/client/routes/guild/\$guildId/giveaways.tsx"
git commit -m "fix(ui): replace channel/role text inputs with DiscordSelect in giveaways page"
```

---

## Task 11: Fix `security.tsx`

**Files:**
- Modify: `apps/dashboard/src/client/routes/guild/$guildId/security.tsx`

**Fields to fix:**
- `whitelistedRoleIds`: `useState<string>` → `useState<string[]>`, replace `<Input>` with `<DiscordMultiSelect type="role">`
- `logChannelId`: `useState<string>` → `useState<string | null>`, replace `<Input>` with `<DiscordSelect type="text">`

- [ ] **Step 1: Add imports**

```tsx
import { DiscordSelect } from "../../../components/ui/discord-select";
import { DiscordMultiSelect } from "../../../components/ui/discord-multi-select";
```

- [ ] **Step 2: Change state declarations**

```ts
// Before
const [whitelistedRoleIds, setWhitelistedRoleIds] = useState("");
const [logChannelId, setLogChannelId] = useState("");

// After
const [whitelistedRoleIds, setWhitelistedRoleIds] = useState<string[]>([]);
const [logChannelId, setLogChannelId] = useState<string | null>(null);
```

- [ ] **Step 3: Fix `useEffect` sync**

```ts
// Before
      setWhitelistedRoleIds(config.whitelistedRoleIds.join(", "));
      setLogChannelId(config.logChannelId ?? "");

// After
      setWhitelistedRoleIds(config.whitelistedRoleIds);
      setLogChannelId(config.logChannelId ?? null);
```

- [ ] **Step 4: Fix save handler**

Remove the CSV parse:
```ts
    const roleIds = whitelistedRoleIds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
```
Replace usage of `roleIds` with `whitelistedRoleIds`, and `logChannelId || null` with `logChannelId`.

- [ ] **Step 5: Replace whitelisted roles `<Input>` (around line 375)**

Replace:
```tsx
                <Input
                  id="whitelist-roles"
                  placeholder={t("lockdown.whitelistedRolesPlaceholder")}
                  value={whitelistedRoleIds}
                  onChange={(e) => setWhitelistedRoleIds(e.target.value)}
                />
```
With:
```tsx
                <DiscordMultiSelect
                  guildId={guildId}
                  type="role"
                  selectedIds={whitelistedRoleIds}
                  onChange={setWhitelistedRoleIds}
                  placeholder={t("lockdown.whitelistedRolesPlaceholder")}
                />
```

- [ ] **Step 6: Replace log channel `<Input>` (around line 389)**

Replace:
```tsx
                <Input
                  id="log-channel"
                  placeholder={t("lockdown.logChannelPlaceholder")}
                  value={logChannelId}
                  onChange={(e) => setLogChannelId(e.target.value)}
                />
```
With:
```tsx
                <DiscordSelect
                  guildId={guildId}
                  type="text"
                  value={logChannelId}
                  onValueChange={setLogChannelId}
                  placeholder={t("lockdown.logChannelPlaceholder")}
                  allowNone
                />
```

- [ ] **Step 7: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add "apps/dashboard/src/client/routes/guild/\$guildId/security.tsx"
git commit -m "fix(ui): replace channel/role text inputs with DiscordSelect in security page"
```

---

## Task 12: Create branch and final typecheck

- [ ] **Step 1: Create the feature branch**

```bash
git checkout -b fix/discord-resource-selects
```

Note: if you've been committing on the current branch, cherry-pick or rebase after creating the branch.

- [ ] **Step 2: Final typecheck across the whole monorepo**

Run: `pnpm typecheck`
Expected: no errors in any package

- [ ] **Step 3: Final commit if any cleanup needed**

```bash
git add -p   # stage any remaining changes
git commit -m "fix(ui): final cleanup for discord resource selects"
```
