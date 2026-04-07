# Whitelist Action Rule Names — Fix Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Severity:** High
**Goal:** Reject `/actions create` invocations whose `name` argument contains anything outside `[a-zA-Z0-9 _-]` or whose length is outside `1..50`, so rule names cannot smuggle markdown injection, mention syntax, code-fence escapes, or zero-width characters into autocomplete results, embeds, log lines, or audit messages.
**Architecture:** `apps/bot/src/features/general/commands/actions.ts` defines the `actions create` subcommand at line 67-129 with `setMaxLength(50)`. The user-supplied `name` flows into Prisma (`createRule({ name, ... })`), the autocomplete handler, embed builders (`successEmbed("Rule Created", ... **${name}** ...)`) , and `notifyCacheInvalidation`. There is no character-class validation. The fix introduces a `RULE_NAME_REGEX` constant in `packages/systems/src/actions/constants.ts` and a `handleCreate` guard that rejects with an `errorEmbed` when validation fails. The same guard runs in any future edit/lookup paths via a small helper.
**Tech Stack:** discord.js v14, TypeScript, Prisma, Vitest

---

## Vulnerability

`apps/bot/src/features/general/commands/actions.ts` line 70-76:

```typescript
.addStringOption((opt) =>
  opt
    .setName("name")
    .setDescription("Unique name for this rule")
    .setRequired(true)
    .setMaxLength(50),
),
```

`handleCreate` at line 474 reads it back as `interaction.options.getString("name", true)` and writes it directly to the DB. A moderator can create a rule named `"@everyone"`, `"```ts\nrm -rf /\n```"`, or `"\u200Bhidden"` which then renders inside the success embed (`successEmbed("Rule Created", "**${name}** will execute...")`) and inside autocomplete output, causing UI confusion or unintended mentions. There is no allowlist.

## Files

- `packages/systems/src/actions/constants.ts` (add `RULE_NAME_REGEX` + helper)
- `apps/bot/src/features/general/commands/actions.ts` (lines 470-547, plus delete/toggle/view lookups optionally)
- New: `apps/bot/tests/features/general/commands/actions-name-validation.test.ts`

## Tasks

### Task 1: Add RULE_NAME_REGEX constant and isValidRuleName helper

- [ ] **Step 1: Write failing test** — append to a new file `packages/systems/tests/unit/actions-name.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { isValidRuleName, RULE_NAME_REGEX } from "../../src/actions/constants.js";

describe("isValidRuleName", () => {
  it("accepts plain ASCII letters", () => {
    expect(isValidRuleName("welcome")).toBe(true);
  });
  it("accepts digits, spaces, underscores, hyphens", () => {
    expect(isValidRuleName("rule_1 - test")).toBe(true);
  });
  it("rejects empty string", () => {
    expect(isValidRuleName("")).toBe(false);
  });
  it("rejects > 50 chars", () => {
    expect(isValidRuleName("a".repeat(51))).toBe(false);
  });
  it("rejects @everyone", () => {
    expect(isValidRuleName("@everyone")).toBe(false);
  });
  it("rejects markdown backticks", () => {
    expect(isValidRuleName("`code`")).toBe(false);
  });
  it("rejects mention syntax", () => {
    expect(isValidRuleName("<@123>")).toBe(false);
  });
  it("rejects zero-width characters", () => {
    expect(isValidRuleName("hi\u200Bthere")).toBe(false);
  });
  it("RULE_NAME_REGEX matches the documented pattern", () => {
    expect(RULE_NAME_REGEX.source).toBe("^[a-zA-Z0-9 _-]{1,50}$");
  });
});
```

- [ ] **Step 2: Run** — `docker compose run --rm bot pnpm test packages/systems/tests/unit/actions-name.test.ts`. Expected: FAIL (export missing).

- [ ] **Step 3: Implement** — append to `packages/systems/src/actions/constants.ts`:

```typescript
/**
 * Allowed character set for action rule names. Restricts user-supplied
 * names so they cannot inject markdown, mention syntax, code fences, or
 * invisible characters into embeds, autocomplete output, or audit logs.
 */
export const RULE_NAME_REGEX = /^[a-zA-Z0-9 _-]{1,50}$/;

export function isValidRuleName(name: string): boolean {
  return typeof name === "string" && RULE_NAME_REGEX.test(name);
}
```

- [ ] **Step 4: Run** — `docker compose run --rm bot pnpm test packages/systems/tests/unit/actions-name.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit** —

```
feat(actions): add RULE_NAME_REGEX and isValidRuleName helper

Defines the allowlist character class for action rule names so the
slash command and dashboard can validate consistently.
```

### Task 2: Enforce isValidRuleName in /actions create handler

- [ ] **Step 1: Write failing test** — create `apps/bot/tests/features/general/commands/actions-name-validation.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: { token: "t", clientId: "c", guildId: undefined, logLevel: "info" },
}));

vi.mock("@fluxcore/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fluxcore/utils")>();
  return {
    ...actual,
    checkPermissions: vi.fn().mockResolvedValue(true),
  };
});

const mockCreateRule = vi.fn();
const mockGetRuleByName = vi.fn().mockResolvedValue(null);
const mockCountRules = vi.fn().mockResolvedValue(0);
vi.mock("@fluxcore/systems/actions/persistence", () => ({
  createRule: (...a: unknown[]) => mockCreateRule(...a),
  updateRule: vi.fn(),
  deleteRule: vi.fn(),
  getRuleByName: (...a: unknown[]) => mockGetRuleByName(...a),
  countRules: (...a: unknown[]) => mockCountRules(...a),
  getRecentLogs: vi.fn(),
  notifyCacheInvalidation: vi.fn(),
}));

vi.mock("@fluxcore/systems/actions/cache", () => ({
  addRuleToCache: vi.fn(),
  removeRuleFromCache: vi.fn(),
  updateRuleInCache: vi.fn(),
  getRulesForGuild: vi.fn().mockReturnValue([]),
}));

vi.mock("@fluxcore/systems/actions/config", () => ({
  getGuildSettingsOrDefault: vi.fn().mockReturnValue({
    maxRules: 25,
    globalEnabled: true,
    logChannelId: null,
  }),
  setGuildSettings: vi.fn(),
}));

const command = (
  await import("../../../../src/features/general/commands/actions.js")
).default;

function mkInteraction(name: string) {
  const replies: unknown[] = [];
  return {
    options: {
      getSubcommand: () => "create",
      getString: (k: string, _req?: boolean) => {
        if (k === "name") return name;
        if (k === "event") return "memberJoin";
        if (k === "action-type") return "sendMessage";
        return null;
      },
      getInteger: () => null,
      getBoolean: () => null,
      getChannel: () => null,
      getRole: () => null,
    },
    user: { id: "u1" },
    guildId: "g1",
    replies,
    reply: (payload: unknown) => {
      replies.push(payload);
      return Promise.resolve();
    },
  } as never;
}

describe("/actions create — name validation", () => {
  beforeEach(() => {
    mockCreateRule.mockReset();
    mockGetRuleByName.mockResolvedValue(null);
    mockCountRules.mockResolvedValue(0);
  });

  it("rejects @everyone", async () => {
    const ix = mkInteraction("@everyone");
    await command.execute(ix);
    expect(mockCreateRule).not.toHaveBeenCalled();
    const reply = (ix as { replies: { embeds: { data: { title: string } }[] }[] }).replies[0];
    expect(JSON.stringify(reply)).toMatch(/Invalid Name/);
  });

  it("rejects backticks", async () => {
    const ix = mkInteraction("`evil`");
    await command.execute(ix);
    expect(mockCreateRule).not.toHaveBeenCalled();
  });

  it("rejects zero-width chars", async () => {
    const ix = mkInteraction("hi\u200Bthere");
    await command.execute(ix);
    expect(mockCreateRule).not.toHaveBeenCalled();
  });

  it("accepts a normal name", async () => {
    mockCreateRule.mockResolvedValue({
      id: 1,
      guildId: "g1",
      name: "welcome_rule",
      enabled: true,
      eventType: "memberJoin",
      actions: [],
      conditions: {},
      priority: 0,
      createdBy: "u1",
    });
    const ix = mkInteraction("welcome_rule");
    await command.execute(ix);
    expect(mockCreateRule).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run** — `docker compose run --rm bot pnpm test apps/bot/tests/features/general/commands/actions-name-validation.test.ts`. Expected: FAIL (rejection branch missing).

- [ ] **Step 3: Implement** — in `apps/bot/src/features/general/commands/actions.ts`, add to the imports from `@fluxcore/systems/actions/constants`:

```typescript
import {
  EVENT_TYPES,
  ACTION_TYPES,
  MAX_ACTIONS_PER_RULE,
  CONDITION_TYPES,
  isValidRuleName,
  type ConditionType,
} from "@fluxcore/systems/actions/constants";
```

Then in `handleCreate` (around line 474), insert the validation immediately after reading `name`:

```typescript
async function handleCreate(
  interaction: ChatInputCommandInteraction,
  guildId: string,
) {
  const name = interaction.options.getString("name", true);

  if (!isValidRuleName(name)) {
    await interaction.reply({
      embeds: [
        errorEmbed(
          "Invalid Name",
          "Rule names must be 1-50 characters using only letters, digits, spaces, underscores, or hyphens.",
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  const eventType = interaction.options.getString("event", true) as ActionEventType;
```

- [ ] **Step 4: Run** — `docker compose run --rm bot pnpm test apps/bot/tests/features/general/commands/actions-name-validation.test.ts && docker compose run --rm bot pnpm typecheck`. Expected: PASS.

- [ ] **Step 5: Commit** —

```
fix(actions): whitelist /actions create rule names

Reject names that contain markdown, mention syntax, code fences, or
zero-width characters. Names must now match /^[a-zA-Z0-9 _-]{1,50}$/.
```
