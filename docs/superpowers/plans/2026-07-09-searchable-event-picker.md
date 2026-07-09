# Searchable Event-Type Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the automation rule builder's trigger event picker a search box by extracting a reusable `SearchableSelect` component and consuming it from both `DiscordSelect` and the event picker.

**Architecture:** Lift the Popover-based searchable shell out of `DiscordSelect` into a data-agnostic `SearchableSelect` (`shared/ui`). Refactor `DiscordSelect` to consume it (public API + appearance unchanged). Swap the trigger panel's plain Radix `<Select>` for `SearchableSelect`, fed by a `useMemo` mapping over `constants.eventTypes` with per-event icons.

**Tech Stack:** React 19, TypeScript (strict), Radix Popover, Tailwind 4, react-i18next, Vitest + Testing Library + user-event (jsdom).

## Global Constraints

- Strict TypeScript — no `any`.
- Always use shadcn/ui wrappers from `apps/dashboard/src/client/shared/ui/` — do not use raw Radix when a wrapper exists.
- Do NOT change `DiscordSelect`'s exported `DiscordSelectProps` or its rendered text/appearance.
- No new dependencies (`cmdk`/Command is not installed and must not be added).
- No backend, schema, API, or `constants.eventTypes` changes.
- i18n: edit `packages/i18n/src/locales/en/rules.json`, then regenerate `dist` (the app serves `dist/locales`). Missing keys in other locales fall back to `en`.
- Every feature includes tests (mandatory).
- Test env markers: RTL component tests start with `// @vitest-environment jsdom` and stub `ResizeObserver` in `beforeAll` (Radix needs it under jsdom).
- Dashboard test command: `pnpm --filter @fluxcore/dashboard test <path>`. Typecheck: `pnpm --filter @fluxcore/dashboard typecheck`.

---

## File Structure

- **Create** `apps/dashboard/src/client/shared/ui/searchable-select.tsx` — generic, presentational searchable single-select (Popover shell).
- **Create** `apps/dashboard/tests/client/shared/ui/searchable-select.test.tsx` — thorough behavior tests.
- **Modify** `apps/dashboard/src/client/shared/ui/discord-select.tsx` — refactor to consume `SearchableSelect`.
- **Create** `apps/dashboard/tests/client/shared/ui/discord-select.test.tsx` — smoke test (no test exists today).
- **Modify** `apps/dashboard/src/client/features/automation/workflow/NodeDetailPanel.tsx` — swap the trigger `<Select>` for `SearchableSelect`.
- **Modify** `packages/i18n/src/locales/en/rules.json` — add `panel.searchEvent`, `panel.noEventResults`; then regenerate `dist`.

---

## Task 1: `SearchableSelect` component

**Files:**
- Create: `apps/dashboard/src/client/shared/ui/searchable-select.tsx`
- Test: `apps/dashboard/tests/client/shared/ui/searchable-select.test.tsx`

**Interfaces:**
- Consumes: `Popover`, `PopoverContent`, `PopoverTrigger` from `./popover`; `SelectSkeleton` from `./skeletons`; `cn` from `../lib/utils`.
- Produces:
  - `interface SearchableSelectOption { value: string; label: string; keywords?: string; icon?: React.ReactNode }`
  - `function SearchableSelect(props: SearchableSelectProps): JSX.Element` where
    `SearchableSelectProps = { options: SearchableSelectOption[]; value: string | null; onValueChange: (value: string | null) => void; placeholder?: string; allowNone?: boolean; noneLabel?: string; disabled?: boolean; loading?: boolean; error?: boolean; errorLabel?: string; emptyLabel?: string; noResultsLabel?: string; searchPlaceholder?: string; className?: string }`

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/tests/client/shared/ui/searchable-select.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "../../../../src/client/shared/ui/searchable-select";

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

const options: SearchableSelectOption[] = [
  { value: "memberJoin", label: "Member Join", keywords: "when a new member joins" },
  { value: "messageDeleted", label: "Message Deleted", keywords: "when a message is deleted" },
  { value: "boostStart", label: "Boost Start", keywords: "when a member starts boosting" },
];

function setup(props: Partial<React.ComponentProps<typeof SearchableSelect>> = {}) {
  const onValueChange = vi.fn();
  render(
    <SearchableSelect
      options={options}
      value={null}
      onValueChange={onValueChange}
      placeholder="Select event"
      searchPlaceholder="Search events"
      noResultsLabel="No events found"
      {...props}
    />,
  );
  return { onValueChange };
}

describe("SearchableSelect", () => {
  it("shows the placeholder when nothing is selected", () => {
    setup();
    expect(screen.getByText("Select event")).toBeInTheDocument();
  });

  it("opens and lists all options on trigger click", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button"));
    expect(screen.getByText("Member Join")).toBeInTheDocument();
    expect(screen.getByText("Message Deleted")).toBeInTheDocument();
    expect(screen.getByText("Boost Start")).toBeInTheDocument();
  });

  it("filters options by label as the user types", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button"));
    await user.type(screen.getByPlaceholderText("Search events"), "boost");
    expect(screen.getByText("Boost Start")).toBeInTheDocument();
    expect(screen.queryByText("Member Join")).not.toBeInTheDocument();
  });

  it("filters options by keywords, not just label", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button"));
    // "joins" appears only in Member Join's keywords, not its label.
    await user.type(screen.getByPlaceholderText("Search events"), "joins");
    expect(screen.getByText("Member Join")).toBeInTheDocument();
    expect(screen.queryByText("Boost Start")).not.toBeInTheDocument();
  });

  it("shows the no-results label when nothing matches", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button"));
    await user.type(screen.getByPlaceholderText("Search events"), "zzzzz");
    expect(screen.getByText("No events found")).toBeInTheDocument();
  });

  it("calls onValueChange with the value and closes on select", async () => {
    const user = userEvent.setup();
    const { onValueChange } = setup();
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("Message Deleted"));
    expect(onValueChange).toHaveBeenCalledWith("messageDeleted");
    expect(screen.queryByPlaceholderText("Search events")).not.toBeInTheDocument();
  });

  it("renders the allowNone row and emits null when picked", async () => {
    const user = userEvent.setup();
    const { onValueChange } = setup({ allowNone: true, noneLabel: "None", value: "memberJoin" });
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("None"));
    expect(onValueChange).toHaveBeenCalledWith(null);
  });

  it("renders the error label instead of the trigger when error", () => {
    setup({ error: true, errorLabel: "Failed to load" });
    expect(screen.getByText("Failed to load")).toBeInTheDocument();
    expect(screen.queryByText("Select event")).not.toBeInTheDocument();
  });

  it("renders neither trigger text nor options when loading", () => {
    setup({ loading: true });
    expect(screen.queryByText("Select event")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @fluxcore/dashboard test tests/client/shared/ui/searchable-select.test.tsx`
Expected: FAIL — cannot resolve module `searchable-select` / `SearchableSelect is not defined`.

- [ ] **Step 3: Write the component**

Create `apps/dashboard/src/client/shared/ui/searchable-select.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { SelectSkeleton } from "./skeletons";
import { cn } from "../lib/utils";

export interface SearchableSelectOption {
  value: string;
  label: string;
  /** Extra text folded into the search match (e.g. an event description). */
  keywords?: string;
  /** Optional leading icon, rendered per-row and on the trigger. */
  icon?: ReactNode;
}

export interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  allowNone?: boolean;
  noneLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  error?: boolean;
  errorLabel?: string;
  emptyLabel?: string;
  noResultsLabel?: string;
  searchPlaceholder?: string;
  className?: string;
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder,
  allowNone,
  noneLabel = "None",
  disabled,
  loading,
  error,
  errorLabel = "Failed to load",
  emptyLabel = "No options available",
  noResultsLabel = "No results found",
  searchPlaceholder = "Search...",
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter((o) =>
      `${o.label} ${o.keywords ?? ""}`.toLowerCase().includes(q),
    );
  }, [options, search]);

  const selected = options.find((o) => o.value === value);

  // Clear + focus the search box each time the popover opens.
  useEffect(() => {
    if (open) {
      setSearch("");
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  if (loading) {
    return <SelectSkeleton />;
  }

  if (error) {
    return (
      <button
        type="button"
        disabled
        className={cn(
          "flex h-9 w-full items-center rounded-sm bg-surface-lowest px-3 py-2 text-sm text-danger/70 opacity-50",
          className,
        )}
      >
        {errorLabel}
      </button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-sm bg-surface-lowest px-3 py-2 text-sm text-text focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            !selected && "text-outline",
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {selected?.icon}
            <span className="truncate">{selected?.label ?? placeholder}</span>
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="ms-2 shrink-0 opacity-50"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
        sideOffset={4}
      >
        <div className="border-b border-outline-variant/10 p-2">
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="w-full rounded-sm bg-surface-lowest px-2.5 py-1.5 text-sm text-text placeholder:text-outline focus:outline-none"
          />
        </div>

        <div className="max-h-56 overflow-y-auto p-1 scrollbar-thin">
          {allowNone && (
            <button
              type="button"
              className={cn(
                "flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-text-muted hover:bg-surface-high",
                value === null && "bg-surface-high text-text",
              )}
              onClick={() => {
                onValueChange(null);
                setOpen(false);
              }}
            >
              {noneLabel}
            </button>
          )}

          {filtered.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-text-muted">
              {search ? noResultsLabel : emptyLabel}
            </p>
          ) : (
            filtered.map((opt) => (
              <button
                type="button"
                key={opt.value}
                className={cn(
                  "flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-surface-high",
                  opt.value === value ? "bg-surface-high text-text" : "text-text",
                )}
                onClick={() => {
                  onValueChange(opt.value);
                  setOpen(false);
                }}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {opt.icon}
                  <span className="truncate">{opt.label}</span>
                </span>
                {opt.value === value && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0 text-accent"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @fluxcore/dashboard test tests/client/shared/ui/searchable-select.test.tsx`
Expected: PASS (9 tests).

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @fluxcore/dashboard typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/client/shared/ui/searchable-select.tsx apps/dashboard/tests/client/shared/ui/searchable-select.test.tsx
git commit -m "feat(dashboard): add reusable SearchableSelect component"
```

---

## Task 2: Refactor `DiscordSelect` to consume `SearchableSelect`

**Files:**
- Modify: `apps/dashboard/src/client/shared/ui/discord-select.tsx` (full rewrite of the component body; keep the file's public exports)
- Test: `apps/dashboard/tests/client/shared/ui/discord-select.test.tsx`

**Interfaces:**
- Consumes: `SearchableSelect`, `SearchableSelectOption` from `./searchable-select` (Task 1); `useChannels` from `../hooks/useChannels`; `useRoles` from `../hooks/useRoles`.
- Produces: unchanged public API — `type DiscordSelectType = "text" | "voice" | "category" | "any" | "role"`; `interface DiscordSelectProps { guildId; type; value: string | null; onValueChange: (value: string | null) => void; placeholder?; allowNone?; disabled?; className? }`; `function DiscordSelect(props): JSX.Element`.

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/tests/client/shared/ui/discord-select.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// DiscordSelect pulls its options from these hooks; mock them with static data.
vi.mock("../../../../src/client/shared/hooks/useChannels", () => ({
  useChannels: () => ({
    data: [
      { id: "1", name: "general", type: 0 },
      { id: "2", name: "voice-chat", type: 2 },
    ],
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("../../../../src/client/shared/hooks/useRoles", () => ({
  useRoles: () => ({ data: [], isLoading: false, isError: false }),
}));

import { DiscordSelect } from "../../../../src/client/shared/ui/discord-select";

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

describe("DiscordSelect", () => {
  it("lists only text channels for type='text' and filters by search", async () => {
    const user = userEvent.setup();
    render(<DiscordSelect guildId="g1" type="text" value={null} onValueChange={vi.fn()} />);
    await user.click(screen.getByRole("button"));
    expect(screen.getByText("# general")).toBeInTheDocument();
    expect(screen.queryByText("🔊 voice-chat")).not.toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("Search..."), "gen");
    expect(screen.getByText("# general")).toBeInTheDocument();
  });

  it("emits the channel id on select", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<DiscordSelect guildId="g1" type="text" value={null} onValueChange={onValueChange} />);
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("# general"));
    expect(onValueChange).toHaveBeenCalledWith("1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @fluxcore/dashboard test tests/client/shared/ui/discord-select.test.tsx`
Expected: PASS on the *current* implementation already (the behavior is unchanged). This is a characterization test — it locks in behavior the refactor must preserve. If it does not pass against the current code, fix the test before refactoring.

> Note: because DiscordSelect already produces this behavior, this test guards the refactor rather than driving new code. That is the intended TDD role here — red is not expected; the test must stay green across Step 3.

- [ ] **Step 3: Rewrite the component body**

Replace the entire contents of `apps/dashboard/src/client/shared/ui/discord-select.tsx` with:

```tsx
import { useMemo } from "react";
import { useChannels } from "../hooks/useChannels";
import { useRoles } from "../hooks/useRoles";
import { SearchableSelect, type SearchableSelectOption } from "./searchable-select";

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
  } = useChannels(guildId, { enabled: !isRole });
  const {
    data: roles,
    isLoading: roLoading,
    isError: roError,
  } = useRoles(guildId, { enabled: isRole });

  const isLoading = isRole ? roLoading : chLoading;
  const isError = isRole ? roError : chError;

  const options: SearchableSelectOption[] = useMemo(
    () =>
      isRole
        ? (roles ?? []).map((r) => ({ value: r.id, label: `● ${r.name}` }))
        : (channels ?? [])
            .filter((c) => {
              if (type === "text") return c.type === 0;
              if (type === "voice") return c.type === 2;
              if (type === "category") return c.type === 4;
              return c.type === 0 || c.type === 2;
            })
            .map((c) => ({ value: c.id, label: channelLabel(c.name, c.type) })),
    [isRole, roles, channels, type],
  );

  return (
    <SearchableSelect
      options={options}
      value={value}
      onValueChange={onValueChange}
      placeholder={placeholder ?? (isRole ? "Select a role" : "Select a channel")}
      allowNone={allowNone}
      disabled={disabled}
      loading={isLoading}
      error={isError}
      emptyLabel={isRole ? "No roles available" : "No channels available"}
      className={className}
    />
  );
}
```

- [ ] **Step 4: Run the test + full dashboard client suite**

Run: `pnpm --filter @fluxcore/dashboard test tests/client/shared/ui/discord-select.test.tsx`
Expected: PASS (2 tests).

Run: `pnpm --filter @fluxcore/dashboard test tests/client`
Expected: PASS — no regressions in any consumer of `DiscordSelect`.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @fluxcore/dashboard typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/client/shared/ui/discord-select.tsx apps/dashboard/tests/client/shared/ui/discord-select.test.tsx
git commit -m "refactor(dashboard): back DiscordSelect with SearchableSelect"
```

---

## Task 3: Searchable event picker in the trigger panel + i18n

**Files:**
- Modify: `apps/dashboard/src/client/features/automation/workflow/NodeDetailPanel.tsx`
- Modify: `packages/i18n/src/locales/en/rules.json`

**Interfaces:**
- Consumes: `SearchableSelect` from `../../../shared/ui/searchable-select` (Task 1); `EVENT_ICONS` from `../lib/rule-icons`; existing `Icon`, `useMemo`, `constants.eventTypes`.
- Produces: no new exports — an internal UI change to `TriggerPanel`.

- [ ] **Step 1: Add the i18n keys**

In `packages/i18n/src/locales/en/rules.json`, inside the `"panel"` object, add two keys immediately after the `"selectEvent"` line (currently line 168):

```json
    "selectEvent": "Select event...",
    "searchEvent": "Search events...",
    "noEventResults": "No events found",
```

- [ ] **Step 2: Regenerate the served locales (`dist`)**

The app serves `packages/i18n/dist/locales`, not `src`. Regenerate it:

Run: `pnpm --filter @fluxcore/i18n build`
Expected: completes; `packages/i18n/dist/locales/en/rules.json` now contains `searchEvent` and `noEventResults`.

Verify:

Run: `grep -c "searchEvent\|noEventResults" packages/i18n/dist/locales/en/rules.json`
Expected: `2`

- [ ] **Step 3: Update `NodeDetailPanel.tsx` imports**

Change the React import (line 1) from:

```tsx
import { useState } from "react";
```

to:

```tsx
import { useState, useMemo } from "react";
```

Add these two imports alongside the existing imports (e.g. after the `Select` import block that ends at line 21):

```tsx
import { SearchableSelect } from "../../../shared/ui/searchable-select";
import { EVENT_ICONS } from "../lib/rule-icons";
```

> Keep the existing `Select`/`SelectContent`/`SelectItem`/`SelectTrigger`/`SelectValue` import — `ActionPanel` and `StepPanel` still use it.

- [ ] **Step 4: Build the event options and swap the picker**

In `function TriggerPanel(...)`, just after the existing `const variables = ...` line (currently line 154), add:

```tsx
  const eventOptions = useMemo(
    () =>
      Object.entries(constants.eventTypes).map(([value, info]) => ({
        value,
        label: info.label,
        keywords: info.description,
        icon: <Icon name={EVENT_ICONS[value] ?? "bolt"} size={16} />,
      })),
    [constants.eventTypes],
  );
```

Then replace the event-type `<Select>` block (currently lines 198–209):

```tsx
            <Select value={eventType || undefined} onValueChange={onEventTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder={t("panel.selectEvent")} />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(constants.eventTypes).map(([key, info]) => (
                  <SelectItem key={key} value={key}>
                    {info.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
```

with:

```tsx
            <SearchableSelect
              options={eventOptions}
              value={eventType || null}
              onValueChange={(v) => v && onEventTypeChange(v)}
              placeholder={t("panel.selectEvent")}
              searchPlaceholder={t("panel.searchEvent")}
              noResultsLabel={t("panel.noEventResults")}
            />
```

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @fluxcore/dashboard typecheck`
Expected: no errors.

- [ ] **Step 6: Run the full dashboard client suite (regression)**

Run: `pnpm --filter @fluxcore/dashboard test tests/client`
Expected: PASS — no regressions in the automation/rules UI.

- [ ] **Step 7: Manual smoke (optional but recommended)**

Start the dashboard (`pnpm dev:dashboard`), open a guild's Rules → add/edit a rule → open the trigger node. Confirm the event field is now a searchable dropdown: typing "boost" narrows to Boost Start/Boost End; each row shows its event icon; selecting one sets the trigger and shows its description below.

- [ ] **Step 8: Commit**

```bash
git add apps/dashboard/src/client/features/automation/workflow/NodeDetailPanel.tsx packages/i18n/src/locales/en/rules.json packages/i18n/dist/locales/en/rules.json
git commit -m "feat(rules): searchable event-type picker in the trigger panel"
```

---

## Final verification

- [ ] **Full suite:** `pnpm --filter @fluxcore/dashboard test` → all green.
- [ ] **Typecheck:** `pnpm --filter @fluxcore/dashboard typecheck` → clean.
- [ ] **i18n parity:** `dist/locales/en/rules.json` contains `searchEvent` + `noEventResults` (other locales fall back to `en`).

---

## Self-Review

**Spec coverage:**
- Generic `SearchableSelect` (spec §Components 1) → Task 1. ✅
- `DiscordSelect` refactor, API/appearance unchanged (spec §Components 2) → Task 2 (characterization test + `emptyLabel`/`errorLabel`/placeholder pass-throughs preserve strings). ✅
- Event picker integration with icons + description keywords (spec §Components 3) → Task 3 Steps 3–4. ✅
- `eventType || null` binding (spec self-review note) → Task 3 Step 4. ✅
- i18n keys + dist sync (spec §i18n) → Task 3 Steps 1–2. ✅
- Tests: thorough SearchableSelect + DiscordSelect smoke + regression (spec §Tests) → Tasks 1–3. ✅
- Constraints: no new deps, no backend/schema, `Select` import retained → honored. ✅

**Type consistency:** `SearchableSelectOption`/`SearchableSelectProps` defined in Task 1 are used verbatim in Tasks 2–3. `value: string | null` flows consistently; Task 3 adapts `eventType` (`string`) via `eventType || null` and `(v) => v && onEventTypeChange(v)`. `onValueChange` signature identical everywhere. ✅

**Placeholder scan:** No TBD/TODO; every code step shows complete code. ✅
