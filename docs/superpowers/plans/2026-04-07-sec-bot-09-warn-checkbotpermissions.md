# Add checkBotPermissions to /warn — Fix Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Severity:** Low
**Goal:** Make `/warn` consistent with sibling moderation commands (`/kick`, `/ban`, `/timeout`, ...) by verifying the bot itself has `ManageMessages` before attempting to issue a warning. The warning record itself doesn't strictly need it, but escalation actions (kick/ban/timeout) chained off `checkAndExecutePunishment` will fail confusingly if the bot lacks higher permissions; we surface a clear up-front error.
**Architecture:** `apps/bot/src/features/moderation/commands/warn.ts` lines 41-46 currently calls only `checkPermissions(interaction, [PermissionFlagsBits.ManageMessages])`. Sibling `kick.ts` line 38-46 chains both `checkPermissions` and `checkBotPermissions`. The same `checkBotPermissions` helper from `@fluxcore/utils` is already imported in other commands. The fix imports it in `warn.ts` and adds the call.
**Tech Stack:** discord.js v14, TypeScript, Prisma, Vitest

---

## Vulnerability

`apps/bot/src/features/moderation/commands/warn.ts` lines 40-47:

```typescript
async execute(interaction: ChatInputCommandInteraction) {
  if (
    !(await checkPermissions(interaction, [
      PermissionFlagsBits.ManageMessages,
    ]))
  ) {
    return;
  }
```

There is no `checkBotPermissions` call. Every other moderation command in `apps/bot/src/features/moderation/commands/` chains both checks. The inconsistency means `/warn` succeeds even when the bot lacks `ManageMessages`, then the escalation pipeline fails midway with a confusing error after the warning row has already been written.

## Files

- `apps/bot/src/features/moderation/commands/warn.ts` (lines 8-47)
- `apps/bot/tests/features/moderation/commands/warn.test.ts` (extend existing)

## Tasks

### Task 1: Add checkBotPermissions check to /warn

- [ ] **Step 1: Write failing test** — append to `apps/bot/tests/features/moderation/commands/warn.test.ts` a new test inside the existing top-level `describe`. First, update the `vi.mock("@fluxcore/utils", ...)` block at the top of the file to also expose `checkBotPermissions`:

```typescript
const mockCheckBotPermissions = vi.fn().mockResolvedValue(true);
vi.mock("@fluxcore/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fluxcore/utils")>();
  return {
    ...actual,
    checkPermissions: (...args: unknown[]) => mockCheckPermissions(...args),
    checkBotPermissions: (...args: unknown[]) => mockCheckBotPermissions(...args),
    isAboveTarget: (...args: unknown[]) => mockIsAboveTarget(...args),
  };
});
```

Then add a new `it` case at the end of the file's main `describe` block:

```typescript
  it("aborts when the bot lacks ManageMessages", async () => {
    mockCheckPermissions.mockResolvedValueOnce(true);
    mockCheckBotPermissions.mockResolvedValueOnce(false);

    const interaction = createMockInteraction();
    await command.execute(interaction);

    expect(mockCheckBotPermissions).toHaveBeenCalledTimes(1);
    expect(mockCreateWarning).not.toHaveBeenCalled();
  });

  it("calls checkBotPermissions on the happy path", async () => {
    mockCheckPermissions.mockResolvedValueOnce(true);
    mockCheckBotPermissions.mockResolvedValueOnce(true);

    const interaction = createMockInteraction();
    await command.execute(interaction);

    expect(mockCheckBotPermissions).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: Run** — `docker compose run --rm bot pnpm test apps/bot/tests/features/moderation/commands/warn.test.ts`. Expected: FAIL (the command does not call `checkBotPermissions`).

- [ ] **Step 3: Implement** — in `apps/bot/src/features/moderation/commands/warn.ts`, add `checkBotPermissions` to the imports from `@fluxcore/utils`:

```typescript
import {
  successEmbed,
  errorEmbed,
  warnEmbed,
  checkPermissions,
  checkBotPermissions,
  isAboveTarget,
  logger,
} from "@fluxcore/utils";
```

Then replace the permissions block (lines 41-47) with:

```typescript
    if (
      !(await checkPermissions(interaction, [
        PermissionFlagsBits.ManageMessages,
      ])) ||
      !(await checkBotPermissions(interaction, [
        PermissionFlagsBits.ManageMessages,
      ]))
    ) {
      return;
    }
```

- [ ] **Step 4: Run** — `docker compose run --rm bot pnpm test apps/bot/tests/features/moderation/commands/warn.test.ts && docker compose run --rm bot pnpm typecheck`. Expected: PASS.

- [ ] **Step 5: Commit** —

```
fix(warn): add checkBotPermissions for parity with sibling mod commands

/warn now verifies the bot has ManageMessages before writing the
warning row, matching /kick, /ban, /timeout, etc. Surfaces a clear
"bot missing permissions" reply instead of failing midway through
the escalation pipeline.
```
