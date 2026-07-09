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

---

# ADDENDUM — Extend searchable picker to the remaining rule-builder selects

**Added 2026-07-09** after the event picker (Tasks 1–3) shipped. Scope confirmed by the user: convert **action type (×2)**, **condition field + operator**, and **action-field channel + role** to `SearchableSelect`. The generic `field.options` enum select is intentionally left as a plain `<Select>`.

## Addendum Global Constraints (in addition to the ones above)
- Reuse the existing `SearchableSelect` (Task 1); do not fork it.
- Preserve each picker's current behavior and a11y: labels, required markers, and (for channel/role fields) the `id`/`aria-required` association between `<Label htmlFor>` and the control.
- Do NOT add `useMemo` inside `StepPanel`'s `if (step.type === "action" | "condition")` branches — those are conditional code paths and a hook there violates the Rules of Hooks. Map options **inline in the `options` prop** instead. (`ActionPanel` is unbranched, but for uniformity map inline there too.)
- i18n keys go in BOTH `src` and `dist` locale files (dist is a gitignored build artifact but the running app serves it). NodeDetailPanel pickers use the `rules` namespace → `packages/i18n/{src,dist}/locales/en/rules.json`. ActionFields uses the `common` namespace → `packages/i18n/{src,dist}/locales/en/common.json`.
- Docker test/typecheck commands (NOT `pnpm --filter`):
  - Test file: `docker compose --profile bot run --rm --no-deps bot sh -c "pnpm install --no-frozen-lockfile && cd apps/dashboard && node_modules/.bin/vitest run <FILE>"`
  - Full client regression: same but `node_modules/.bin/vitest run tests/client`
  - Typecheck: `docker compose --profile bot run --rm --no-deps bot sh -c "pnpm install --no-frozen-lockfile && cd apps/dashboard && node_modules/.bin/tsc -p tsconfig.client.json --noEmit"`

---

## Task 4: Action-type pickers (×2) → SearchableSelect + shared options helper

**Files:**
- Create: `apps/dashboard/src/client/features/automation/lib/action-options.tsx`
- Test: `apps/dashboard/tests/client/features/automation/action-options.test.tsx`
- Modify: `apps/dashboard/src/client/features/automation/workflow/NodeDetailPanel.tsx` (ActionPanel ~L299-310, StepPanel action branch ~L464-475; add import)
- Modify: `packages/i18n/src/locales/en/rules.json` + `packages/i18n/dist/locales/en/rules.json`

**Interfaces:**
- Consumes: `SearchableSelectOption` from `../../../shared/ui/searchable-select`; `Icon` from `../../../shared/components/Icon`; `ACTION_ICONS` from `./rule-icons`; `Constants` from `../../../shared/lib/schemas`.
- Produces: `function buildActionTypeOptions(actionTypes: Constants["actionTypes"]): SearchableSelectOption[]`.

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/tests/client/features/automation/action-options.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { isValidElement, type ReactElement } from "react";
import { buildActionTypeOptions } from "../../../../../src/client/features/automation/lib/action-options";

const actionTypes = {
  sendMessage: { label: "Send Message", description: "Send a message to a channel" },
  mysteryAction: { label: "Mystery", description: "Unknown action" },
};

describe("buildActionTypeOptions", () => {
  it("maps value, label, and description into keywords", () => {
    const opts = buildActionTypeOptions(actionTypes);
    expect(opts).toHaveLength(2);
    expect(opts[0]).toMatchObject({
      value: "sendMessage",
      label: "Send Message",
      keywords: "Send a message to a channel",
    });
  });

  it("uses ACTION_ICONS for known types and falls back to 'bolt' for unknown", () => {
    const opts = buildActionTypeOptions(actionTypes);
    const send = opts.find((o) => o.value === "sendMessage")!;
    const mystery = opts.find((o) => o.value === "mysteryAction")!;
    expect(isValidElement(send.icon)).toBe(true);
    expect((send.icon as ReactElement<{ name: string }>).props.name).toBe("chat");
    expect((mystery.icon as ReactElement<{ name: string }>).props.name).toBe("bolt");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (Docker): `... vitest run tests/client/features/automation/action-options.test.tsx`
Expected: FAIL — cannot resolve `action-options`.

- [ ] **Step 3: Write the helper**

Create `apps/dashboard/src/client/features/automation/lib/action-options.tsx`:

```tsx
import { Icon } from "../../../shared/components/Icon";
import type { SearchableSelectOption } from "../../../shared/ui/searchable-select";
import type { Constants } from "../../../shared/lib/schemas";
import { ACTION_ICONS } from "./rule-icons";

/** Map the action-type constants into SearchableSelect options (icon + description as search keywords). */
export function buildActionTypeOptions(
  actionTypes: Constants["actionTypes"],
): SearchableSelectOption[] {
  return Object.entries(actionTypes).map(([value, info]) => ({
    value,
    label: info.label,
    keywords: info.description,
    icon: <Icon name={ACTION_ICONS[value] ?? "bolt"} size={16} />,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (Docker): `... vitest run tests/client/features/automation/action-options.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Add i18n keys (both src + dist)**

In BOTH `packages/i18n/src/locales/en/rules.json` and `packages/i18n/dist/locales/en/rules.json`, inside the `"panel"` object, add after the `"noEventResults"` line:

```json
    "noEventResults": "No events found",
    "search": "Search...",
    "noResults": "No results",
```

Verify: `grep -c '"search"\|"noResults"' packages/i18n/dist/locales/en/rules.json` → expect `2`.

- [ ] **Step 6: Wire both action-type pickers**

In `NodeDetailPanel.tsx`, add the import next to the existing `EVENT_ICONS`/rule-icons import block:

```tsx
import { buildActionTypeOptions } from "../lib/action-options";
```

In **ActionPanel**, replace the action-type `<Select>` block (the one with `placeholder={t("panel.selectAction")}` and `Object.entries(constants.actionTypes)`):

```tsx
            <SearchableSelect
              options={buildActionTypeOptions(constants.actionTypes)}
              value={action.type || null}
              onValueChange={(v) => v && handleTypeChange(v)}
              placeholder={t("panel.selectAction")}
              searchPlaceholder={t("panel.search")}
              noResultsLabel={t("panel.noResults")}
            />
```

In **StepPanel** (the `if (step.type === "action")` branch), replace its action-type `<Select>` block identically but bound to that branch's `handleTypeChange`:

```tsx
            <SearchableSelect
              options={buildActionTypeOptions(constants.actionTypes)}
              value={step.action.type || null}
              onValueChange={(v) => v && handleTypeChange(v)}
              placeholder={t("panel.selectAction")}
              searchPlaceholder={t("panel.search")}
              noResultsLabel={t("panel.noResults")}
            />
```

(Both `handleTypeChange` handlers already accept `(newType: string)`.) Keep the `Select`/`SelectItem`/etc. import — StepPanel's condition branch and ActionFields' generic enum still use it (until Task 5).

- [ ] **Step 7: Typecheck + regression (Docker)**

Run typecheck → clean. Run `... vitest run tests/client` → all green (adds action-options tests; existing 57 still pass).

- [ ] **Step 8: Commit**

```bash
git add apps/dashboard/src/client/features/automation/lib/action-options.tsx \
        apps/dashboard/tests/client/features/automation/action-options.test.tsx \
        apps/dashboard/src/client/features/automation/workflow/NodeDetailPanel.tsx \
        packages/i18n/src/locales/en/rules.json
git commit -m "feat(rules): searchable action-type pickers"
```
(`dist` locale is gitignored — do not add it; the key edit there is only for the running app.)

---

## Task 5: Condition field + operator pickers → SearchableSelect

**Files:**
- Modify: `apps/dashboard/src/client/features/automation/workflow/NodeDetailPanel.tsx` (StepPanel `if (step.type === "condition")` branch — field ~L516-527, operator ~L532-543)

**Interfaces:**
- Consumes: `SearchableSelect` (already imported); `CONDITION_FIELDS`, `CONDITION_OPERATORS` (module constants already in this file); `t` from the StepPanel `useTranslation(["rules","common"])`.
- Produces: none (internal UI change). Reuses `panel.search` / `panel.noResults` keys added in Task 4 (no new i18n).

- [ ] **Step 1: Replace the field picker**

In StepPanel's condition branch, replace the field `<Select>` block (`placeholder={t("panel.selectField")}`, mapping `CONDITION_FIELDS`) with:

```tsx
          <SearchableSelect
            options={CONDITION_FIELDS.map((f) => ({ value: f.value, label: t(f.labelKey) }))}
            value={step.condition.field || null}
            onValueChange={(v) => v && updateCondition({ field: v as StepConditionConfig["field"] })}
            placeholder={t("panel.selectField")}
            searchPlaceholder={t("panel.search")}
            noResultsLabel={t("panel.noResults")}
          />
```

- [ ] **Step 2: Replace the operator picker**

Replace the operator `<Select>` block (`placeholder={t("panel.selectOperator")}`, mapping `CONDITION_OPERATORS`) with:

```tsx
          <SearchableSelect
            options={CONDITION_OPERATORS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
            value={step.condition.operator || null}
            onValueChange={(v) => v && updateCondition({ operator: v as StepConditionConfig["operator"] })}
            placeholder={t("panel.selectOperator")}
            searchPlaceholder={t("panel.search")}
            noResultsLabel={t("panel.noResults")}
          />
```

(Options are mapped inline — no `useMemo`, because these render inside a conditional branch. The lists are 8 and 12 items; recomputing per render is negligible.)

- [ ] **Step 3: Typecheck + regression (Docker)**

Typecheck → clean. `... vitest run tests/client` → all green.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/client/features/automation/workflow/NodeDetailPanel.tsx
git commit -m "feat(rules): searchable condition field & operator pickers"
```

---

## Task 6: Extend `SearchableSelect` (id/aria-required) + ActionFields channel & role pickers

**Files:**
- Modify: `apps/dashboard/src/client/shared/ui/searchable-select.tsx` (add `id` + `required` props, forward to trigger)
- Modify: `apps/dashboard/tests/client/shared/ui/searchable-select.test.tsx` (one test for id/aria-required forwarding)
- Modify: `apps/dashboard/src/client/features/automation/components/ActionFields.tsx` (channel field ~L77-102, role field ~L104-120; add SearchableSelect import)
- Modify: `packages/i18n/src/locales/en/common.json` + `packages/i18n/dist/locales/en/common.json`

**Interfaces:**
- Adds to `SearchableSelectProps`: `id?: string` and `required?: boolean`. The trigger `<button>` gets `id={id}` and `aria-required={required || undefined}`. No behavior change for existing callers (both optional/undefined).

- [ ] **Step 1: Extend SearchableSelect — add the failing test first**

Append to `apps/dashboard/tests/client/shared/ui/searchable-select.test.tsx` (inside the existing `describe`):

```tsx
  it("forwards id and aria-required to the trigger for label association", () => {
    render(
      <SearchableSelect
        options={options}
        value={null}
        onValueChange={vi.fn()}
        placeholder="Select event"
        id="my-field"
        required
      />,
    );
    const trigger = screen.getByRole("button");
    expect(trigger).toHaveAttribute("id", "my-field");
    expect(trigger).toHaveAttribute("aria-required", "true");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run (Docker): `... vitest run tests/client/shared/ui/searchable-select.test.tsx`
Expected: FAIL — trigger has no `id`/`aria-required` (the new props don't exist yet).

- [ ] **Step 3: Add the props and forward them**

In `apps/dashboard/src/client/shared/ui/searchable-select.tsx`, add to `SearchableSelectProps`:

```tsx
  id?: string;
  required?: boolean;
```

Destructure them in the component signature (alongside the other props): add `id,` and `required,`. Then on the main trigger `<button>` (the one inside `PopoverTrigger asChild`), add the two attributes:

```tsx
        <button
          type="button"
          id={id}
          aria-required={required || undefined}
          disabled={disabled}
          className={cn(
```

(Leave the loading/error branches unchanged — ActionFields never passes `loading`/`error`, so the association always lands on the real trigger.)

- [ ] **Step 4: Run test to verify it passes**

Run (Docker): `... vitest run tests/client/shared/ui/searchable-select.test.tsx`
Expected: PASS (10 tests — the 9 existing + the new one).

- [ ] **Step 5: Add i18n keys (both src + dist)**

In BOTH `packages/i18n/src/locales/en/common.json` and `packages/i18n/dist/locales/en/common.json`, inside the `"form"` object (the one holding `selectChannel`/`selectRole`/`select`), add:

```json
    "search": "Search...",
    "noResults": "No results",
```

Verify: `grep -c '"search"\|"noResults"' packages/i18n/dist/locales/en/common.json` → expect at least `2` (may be higher if the strings appear elsewhere in the file; confirm the `form` object contains them by reading it).

- [ ] **Step 6: Convert the channel & role fields**

In `apps/dashboard/src/client/features/automation/components/ActionFields.tsx`, add the import near the top:

```tsx
import { SearchableSelect } from "../../../shared/ui/searchable-select";
```

Replace the `field.type === "channel"` `<Select>...</Select>` block with:

```tsx
            {field.type === "channel" && (
              <SearchableSelect
                id={fieldId}
                required={field.required}
                value={String(value) || null}
                onValueChange={(v) => v && onChange(field.key, v)}
                placeholder={t("form.selectChannel")}
                searchPlaceholder={t("form.search")}
                noResultsLabel={t("form.noResults")}
                options={channels
                  .filter((c) => c.type === 0 || c.type === 2)
                  .map((c) => ({
                    value: c.id,
                    label: c.name,
                    icon: (
                      <Icon
                        name={c.type === 2 ? "volume_up" : "hash"}
                        size={14}
                        className="text-text-muted"
                      />
                    ),
                  }))}
              />
            )}
```

Replace the `field.type === "role"` `<Select>...</Select>` block with:

```tsx
            {field.type === "role" && (
              <SearchableSelect
                id={fieldId}
                required={field.required}
                value={String(value) || null}
                onValueChange={(v) => v && onChange(field.key, v)}
                placeholder={t("form.selectRole")}
                searchPlaceholder={t("form.search")}
                noResultsLabel={t("form.noResults")}
                options={roles.map((r) => ({ value: r.id, label: r.name }))}
              />
            )}
```

Keep the existing `Select`/`SelectContent`/`SelectItem`/`SelectTrigger`/`SelectValue` import — the generic `field.type === "select"` enum block still uses it. (`Icon` is already imported.)

- [ ] **Step 7: Typecheck + regression (Docker)**

Typecheck → clean. `... vitest run tests/client` → all green (searchable-select now 10 tests).

- [ ] **Step 8: Commit**

```bash
git add apps/dashboard/src/client/shared/ui/searchable-select.tsx \
        apps/dashboard/tests/client/shared/ui/searchable-select.test.tsx \
        apps/dashboard/src/client/features/automation/components/ActionFields.tsx \
        packages/i18n/src/locales/en/common.json
git commit -m "feat(rules): searchable channel & role action-field pickers"
```

---

## Addendum Self-Review

**Scope coverage:** action type ×2 → Task 4; condition field + operator → Task 5; action-field channel + role → Task 6. Generic enum select intentionally excluded. ✅
**A11y:** channel/role `id`+`aria-required` preserved via the SearchableSelect extension (Task 6). ✅
**Rules of Hooks:** no `useMemo` inside StepPanel conditional branches — options mapped inline. ✅
**i18n:** `panel.search`/`panel.noResults` (rules) + `form.search`/`form.noResults` (common), both src+dist; dist gitignored, not committed. ✅
**Type consistency:** `buildActionTypeOptions` returns `SearchableSelectOption[]`; all `value` bindings use `X || null` and `(v) => v && handler(v)`, matching the established pattern. ✅
**Placeholder scan:** complete code in every step, no TBD. ✅
