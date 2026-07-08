# Validate Emoji Before message.react() — Fix Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Severity:** Medium
**Goal:** Validate `config.emoji` against a strict shape (single Unicode emoji code point cluster OR Discord custom-emoji form `<a?:name:id>`) before passing it to `message.react()`. This prevents action rules from triggering hundreds of failing API calls per event with garbage emoji input, surfacing a clear logged error instead.
**Architecture:** `apps/bot/src/features/automation/system/registry.ts` line 244 calls `message.react(config.emoji)` without inspecting the value. `config.emoji` is moderator-controlled via the `/actions create … emoji` option (max length 50). Discord.js will throw on invalid emoji, the executor catches it, but the call still hits the API and pollutes logs. Fix: add an `isValidEmoji()` helper and short-circuit before the API call.
**Tech Stack:** discord.js v14, TypeScript, Prisma, Vitest

---

## Vulnerability

`registry.ts` lines 236-248:

```typescript
executors.set("addReaction", async (client, ctx, config) => {
  if (!config.emoji || !ctx.extra?.["message.id"] || !ctx.channelId) return;
  const channel = await client.channels.fetch(ctx.channelId);
  if (!channel?.isTextBased() || !("messages" in channel)) return;
  try {
    const message = await (channel as TextChannel).messages.fetch(
      ctx.extra["message.id"],
    );
    await message.react(config.emoji);
  } catch (err) {
    logger.warn(`addReaction failed (...)`);
  }
});
```

A rule with `emoji: "not-an-emoji"` or `emoji: ":fake:"` will fetch the message from the API and only fail at the `react()` call. The cost is amortized per matching event. Validating up-front saves the fetch and yields a clearer log.

## Files

- `apps/bot/src/features/automation/system/registry.ts` (lines 236-248)
- New: `apps/bot/tests/features/automation/system/registry-emoji.test.ts`

## Tasks

### Task 1: Add isValidEmoji guard

- [ ] **Step 1: Write failing test** — create `apps/bot/tests/features/automation/system/registry-emoji.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: { token: "t", clientId: "c", guildId: undefined, logLevel: "info" },
}));

const warn = vi.fn();
vi.mock("@fluxcore/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fluxcore/utils")>();
  return {
    ...actual,
    logger: { warn, error: vi.fn(), info: vi.fn(), debug: vi.fn() },
  };
});

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn().mockResolvedValue({ address: "1.1.1.1", family: 4 }),
}));

const { getExecutor } = await import(
  "../../../../src/features/automation/system/registry.js"
);

const baseCtx = {
  eventType: "messageCreated" as const,
  guildId: "g1",
  userId: "u1",
  userName: "alice",
  userTag: "alice#0001",
  userMention: "<@u1>",
  channelId: "c1",
  guildName: "G",
  memberCount: 10,
  timestamp: new Date().toISOString(),
  extra: { "message.id": "m1" },
};

function mkClient(reactSpy: ReturnType<typeof vi.fn>, fetchSpy: ReturnType<typeof vi.fn>) {
  return {
    channels: {
      fetch: vi.fn().mockResolvedValue({
        isTextBased: () => true,
        messages: { fetch: fetchSpy },
      }),
    },
  } as never;
}

describe("addReaction emoji validation", () => {
  beforeEach(() => warn.mockClear());

  it("rejects garbage strings without fetching the message", async () => {
    const fetchSpy = vi.fn();
    const reactSpy = vi.fn();
    const client = mkClient(reactSpy, fetchSpy);

    const executor = getExecutor("addReaction")!;
    await executor(client, baseCtx as never, {
      type: "addReaction",
      emoji: "not-an-emoji-at-all",
    } as never);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("invalid emoji"),
    );
  });

  it("accepts a unicode emoji", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ react: vi.fn() });
    const client = mkClient(vi.fn(), fetchSpy);
    const executor = getExecutor("addReaction")!;
    await executor(client, baseCtx as never, {
      type: "addReaction",
      emoji: "\u{1F389}",
    } as never);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("accepts a Discord custom emoji <:name:id>", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ react: vi.fn() });
    const client = mkClient(vi.fn(), fetchSpy);
    const executor = getExecutor("addReaction")!;
    await executor(client, baseCtx as never, {
      type: "addReaction",
      emoji: "<:partyparrot:123456789012345678>",
    } as never);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("accepts an animated custom emoji <a:name:id>", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ react: vi.fn() });
    const client = mkClient(vi.fn(), fetchSpy);
    const executor = getExecutor("addReaction")!;
    await executor(client, baseCtx as never, {
      type: "addReaction",
      emoji: "<a:dance:123456789012345678>",
    } as never);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("rejects bare colon shortcodes like :smile:", async () => {
    const fetchSpy = vi.fn();
    const client = mkClient(vi.fn(), fetchSpy);
    const executor = getExecutor("addReaction")!;
    await executor(client, baseCtx as never, {
      type: "addReaction",
      emoji: ":smile:",
    } as never);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run** — `docker compose run --rm bot pnpm test apps/bot/tests/features/automation/system/registry-emoji.test.ts`. Expected: FAIL (no validation yet).

- [ ] **Step 3: Implement** — in `apps/bot/src/features/automation/system/registry.ts`, add the helper near the top of the file (after the imports, before the first `executors.set` call):

```typescript
/**
 * Validates that a moderator-supplied emoji is either a single Unicode
 * emoji cluster or a Discord custom-emoji literal `<:name:id>` /
 * `<a:name:id>`. Anything else is rejected to avoid hitting the Discord
 * API with garbage values.
 */
const CUSTOM_EMOJI_REGEX = /^<a?:[A-Za-z0-9_]{2,32}:\d{17,20}>$/;
// Matches strings whose code points all belong to the Unicode "Emoji"
// property (single emoji or ZWJ sequence). Length cap of 16 covers
// flag/family ZWJ sequences while preventing pathological inputs.
const UNICODE_EMOJI_REGEX = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component})(?:\u200D(?:\p{Extended_Pictographic}|\p{Emoji_Component}))*$/u;

function isValidEmoji(value: string): boolean {
  if (typeof value !== "string" || value.length === 0 || value.length > 64) {
    return false;
  }
  if (CUSTOM_EMOJI_REGEX.test(value)) return true;
  return UNICODE_EMOJI_REGEX.test(value);
}
```

Then replace the `addReaction` executor (lines 236-248) with:

```typescript
executors.set("addReaction", async (client, ctx, config) => {
  if (!config.emoji || !ctx.extra?.["message.id"] || !ctx.channelId) return;
  if (!isValidEmoji(config.emoji)) {
    logger.warn(
      `addReaction skipped: invalid emoji "${config.emoji}" for guild ${ctx.guildId ?? "unknown"}`,
    );
    return;
  }
  const channel = await client.channels.fetch(ctx.channelId);
  if (!channel?.isTextBased() || !("messages" in channel)) return;
  try {
    const message = await (channel as TextChannel).messages.fetch(
      ctx.extra["message.id"],
    );
    await message.react(config.emoji);
  } catch (err) {
    logger.warn(
      `addReaction failed (emoji: ${config.emoji}, message: ${ctx.extra?.["message.id"] ?? "unknown"}): ${err instanceof Error ? err.message : String(err)}`,
    );
  }
});
```

- [ ] **Step 4: Run** — `docker compose run --rm bot pnpm test apps/bot/tests/features/automation/system/registry-emoji.test.ts && docker compose run --rm bot pnpm typecheck`. Expected: PASS.

- [ ] **Step 5: Commit** —

```
fix(actions): validate emoji before message.react()

Reject moderator-configured emoji values that are neither a Unicode
emoji cluster nor a Discord custom-emoji literal. Prevents wasted API
calls and noisy error logs when a rule is misconfigured.
```
