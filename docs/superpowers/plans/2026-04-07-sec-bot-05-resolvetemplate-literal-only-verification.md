# Verify resolveTemplate Is Literal-Replacement Only — Fix Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Severity:** Medium (verify-only, with hardening)
**Goal:** Add adversarial unit tests proving `resolveTemplate` performs ONLY literal `replaceAll` substitution and never evaluates JavaScript-like expressions, function calls, or nested templates supplied via the user-controlled `ctx.extra` map. If a future maintainer ever swaps it for `eval`, `new Function`, or a templating library, the tests will fail.
**Architecture:** `packages/systems/src/actions/templateEngine.ts` is consumed by `apps/bot/src/features/automation/system/registry.ts` lines 20-25 (and many other executor blocks). The function takes a `template: string` configured by the moderator and a `context: EventContext` whose `extra` field is populated from Discord events (e.g. `{message.content}`, `{ban.reason}`) — values that are user-controlled. The current implementation iterates `Object.entries(context.extra)`, builds a `${key}` placeholder, and calls `result.replaceAll(variable, escapeTemplateVars(value))`. It already escapes user values to prevent recursion. We add tests that pin this behavior.
**Tech Stack:** discord.js v14, TypeScript, Prisma, Vitest

---

## Vulnerability

`registry.ts` line 20 calls `resolveTemplate(config.message, ctx)`. If `resolveTemplate` ever started evaluating expressions inside `${...}` or `{{...}}` (e.g. by adopting Handlebars, EJS, or `eval`), then any moderator-controlled `config.message` could exfiltrate process state. Today the implementation in `packages/systems/src/actions/templateEngine.ts` is a literal `String.prototype.replaceAll` loop and is safe — but there is no test that pins it. The escape function `escapeTemplateVars` already neutralizes recursive injection from `ctx.extra` values. Both properties need a regression test.

## Files

- `packages/systems/src/actions/templateEngine.ts` (no behavior change; add `// SECURITY` comment)
- New: `packages/systems/tests/unit/templateEngine-injection.test.ts`

## Tasks

### Task 1: Add adversarial regression tests for resolveTemplate

- [ ] **Step 1: Write failing test** — create `packages/systems/tests/unit/templateEngine-injection.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { resolveTemplate } from "../../src/actions/templateEngine.js";
import type { EventContext } from "../../src/actions/types.js";

const baseCtx: EventContext = {
  eventType: "memberJoin",
  guildId: "g1",
  guildName: "Guild",
  userId: "u1",
  userName: "alice",
  userTag: "alice#0001",
  userMention: "<@u1>",
  channelId: "c1",
  memberCount: 5,
  timestamp: "2026-04-07T00:00:00.000Z",
};

describe("resolveTemplate — literal replacement only", () => {
  it("replaces known core variables", () => {
    expect(resolveTemplate("hi {user.name}", baseCtx)).toBe("hi alice");
  });

  it("does NOT evaluate JavaScript expressions inside braces", () => {
    expect(resolveTemplate("{1+1}", baseCtx)).toBe("{1+1}");
    expect(resolveTemplate("{process.env.HOME}", baseCtx)).toBe(
      "{process.env.HOME}",
    );
  });

  it("does NOT evaluate ${...} interpolation", () => {
    // The literal $ and ${...} must be returned unchanged
    expect(resolveTemplate("${1+1}", baseCtx)).toBe("${1+1}");
  });

  it("does NOT recurse into user-controlled extra values", () => {
    // A malicious message.content tries to smuggle {user.id} as the value
    // for {message.content}. The escape MUST prevent the second resolver
    // pass from expanding it.
    const ctx: EventContext = {
      ...baseCtx,
      extra: { "message.content": "{user.id}" },
    };
    const out = resolveTemplate("said: {message.content}", ctx);
    expect(out).not.toBe("said: u1");
    expect(out).toContain("\u200B{user.id}");
  });

  it("does NOT recurse via nested core variables in extra", () => {
    const ctx: EventContext = {
      ...baseCtx,
      extra: { "ban.reason": "{user.tag}{guild}" },
    };
    const out = resolveTemplate("reason: {ban.reason}", ctx);
    expect(out).not.toContain("alice#0001");
    expect(out).toContain("\u200B{user.tag}");
  });

  it("leaves unknown {placeholders} untouched", () => {
    expect(resolveTemplate("{this.does.not.exist}", baseCtx)).toBe(
      "{this.does.not.exist}",
    );
  });

  it("truncates output to MAX_TEMPLATE_LENGTH", () => {
    const big = "x".repeat(5000);
    const out = resolveTemplate(big, baseCtx);
    expect(out.length).toBeLessThanOrEqual(2000);
  });

  it("never throws on non-string extra values being absent", () => {
    expect(() =>
      resolveTemplate("{user.name} joined {guild}", baseCtx),
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run** — `docker compose run --rm bot pnpm test packages/systems/tests/unit/templateEngine-injection.test.ts`. Expected: PASS (current implementation is already safe). If any test FAILS, then the engine has regressed and step 3 must restore the literal-replacement implementation BEFORE merging.

- [ ] **Step 3: Implement** — add a `// SECURITY` block-comment to `packages/systems/src/actions/templateEngine.ts` directly above `export function resolveTemplate`:

```typescript
/**
 * SECURITY: resolveTemplate MUST remain a pure literal-replacement function.
 * It must NEVER call eval, new Function, or any templating library that
 * evaluates expressions inside braces. User-controlled values from
 * ctx.extra are passed through escapeTemplateVars so a hostile
 * `message.content` cannot smuggle `{user.id}` into a second resolver
 * pass. Both properties are pinned by
 * tests/unit/templateEngine-injection.test.ts — do not remove that file.
 */
export function resolveTemplate(
```

- [ ] **Step 4: Run** — `docker compose run --rm bot pnpm test packages/systems/tests/unit/templateEngine-injection.test.ts && docker compose run --rm bot pnpm typecheck`. Expected: PASS.

- [ ] **Step 5: Commit** —

```
test(actions): pin resolveTemplate as literal-replacement only

Adds adversarial unit tests proving resolveTemplate does not evaluate
JavaScript expressions, ${...} interpolation, or recurse into
user-controlled ctx.extra values. Annotates the function with a
SECURITY comment so future maintainers cannot silently swap in a
templating library.
```
