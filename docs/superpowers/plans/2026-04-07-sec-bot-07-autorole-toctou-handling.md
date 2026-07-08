# Auto-Role TOCTOU: Handle DiscordAPIError 50013 Explicitly — Fix Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Severity:** Medium
**Goal:** When `member.roles.add(...)` fails inside the welcome auto-role block in `guildMemberAdd`, log a meaningful per-error message: distinguish "missing permissions" (Discord error code `50013`) from "unknown role" (`10011`) from generic failures, instead of swallowing every error into a single ambiguous log line. Eliminates the silent TOCTOU window where the role's hierarchy check passed but Discord returned 403 because the role moved between cache check and API call.
**Architecture:** `apps/bot/src/events/guildMemberAdd.ts` lines 125-139 filter `welcomeConfig.autoRoleIds` against `botMember.roles.highest.position`, then call `member.roles.add(rolesToAdd, ...)`. The `.catch` block currently logs only a generic message. Discord.js raises `DiscordAPIError` with a `code` field that lets us classify failures. The fix imports `DiscordAPIError` from `discord.js`, switches on `err.code`, and emits structured warn/error logs.
**Tech Stack:** discord.js v14, TypeScript, Prisma, Vitest

---

## Vulnerability

```typescript
if (rolesToAdd.length > 0) {
  await member.roles.add(rolesToAdd, "Auto-role on join").catch((err) => {
    logger.error(`Failed to assign auto-roles in guild ${member.guild.id}`,
      err instanceof Error ? err : new Error(String(err)));
  });
}
```

This swallows every failure under `logger.error`. A 403 from Discord (role hierarchy raced against the bot's cache, role was deleted, or `MANAGE_ROLES` was revoked) is indistinguishable from a transient 5xx. Operators cannot tell whether to fix permissions or whether it was a one-off. The TOCTOU window between the in-memory hierarchy check and the API call also means a "should have worked" case prints as a hard error.

## Files

- `apps/bot/src/events/guildMemberAdd.ts` (lines 125-139)
- New: `apps/bot/tests/events/autorole-error-handling.test.ts`

## Tasks

### Task 1: Classify and log auto-role errors by Discord code

- [ ] **Step 1: Write failing test** — create `apps/bot/tests/events/autorole-error-handling.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: { token: "t", clientId: "c", guildId: undefined, logLevel: "info" },
}));

const warn = vi.fn();
const error = vi.fn();
vi.mock("@fluxcore/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fluxcore/utils")>();
  return {
    ...actual,
    logger: { warn, error, info: vi.fn(), debug: vi.fn() },
  };
});

vi.mock("@fluxcore/systems/logging/config", () => ({
  getLogConfig: vi.fn().mockResolvedValue(null),
}));
vi.mock("@fluxcore/systems/logging/persistence", () => ({ createLogEntry: vi.fn() }));
vi.mock("@fluxcore/systems/logging/sender", () => ({ sendLogEmbed: vi.fn() }));
vi.mock("@fluxcore/systems/logging/formatter", () => ({ formatMemberJoin: vi.fn() }));

vi.mock("@fluxcore/systems/antiraid/config", () => ({
  getAntiRaidConfig: vi.fn().mockResolvedValue({ enabled: false }),
}));
vi.mock("@fluxcore/systems/antiraid/tracker", () => ({ recordJoin: vi.fn() }));
vi.mock("@fluxcore/systems/antiraid/actions", () => ({
  executeRaidAction: vi.fn(),
  lockdownGuild: vi.fn(),
}));
vi.mock("@fluxcore/systems/antiraid/persistence", () => ({ createRaidEvent: vi.fn() }));

vi.mock("@fluxcore/systems/welcome/config", () => ({
  getWelcomeConfig: vi.fn().mockResolvedValue({
    autoRoleIds: ["role-1"],
    welcomeEnabled: false,
    welcomeChannelId: null,
    welcomeMessage: "",
    welcomeImageEnabled: false,
    welcomeImageConfig: { sendMode: "with" },
    dmEnabled: false,
    dmMessage: "",
  }),
}));

vi.mock("@fluxcore/systems/welcome/builder", () => ({
  buildWelcomeEmbed: vi.fn(),
}));
vi.mock("@fluxcore/systems/welcome/image", () => ({
  generateWelcomeImage: vi.fn(),
  createStorageAdapter: vi.fn(),
  sanitizeDisplayName: (s: string) => s,
}));

import { DiscordAPIError } from "discord.js";

const event = (await import("../../src/events/guildMemberAdd.js")).default;

function mkMember(rolesAdd: ReturnType<typeof vi.fn>) {
  return {
    id: "m1",
    user: { bot: false, username: "alice", createdTimestamp: Date.now() - 86_400_000 * 100, displayAvatarURL: () => "", tag: "" },
    displayName: "Alice",
    guild: {
      id: "g1",
      name: "G",
      memberCount: 5,
      iconURL: () => null,
      members: { me: { roles: { highest: { position: 100 } } } },
      roles: {
        cache: new Map([["role-1", { position: 5, id: "role-1" }]]),
      },
      channels: { cache: { get: () => null } },
    },
    roles: { cache: new Map(), add: rolesAdd },
    send: vi.fn(),
  } as never;
}

function makeApiError(code: number, message: string): DiscordAPIError {
  // Construct a minimal DiscordAPIError instance
  const err = new DiscordAPIError(
    { message, code } as never,
    code,
    403,
    "PUT",
    "url",
    { files: [] } as never,
  );
  return err;
}

describe("auto-role failure handling", () => {
  beforeEach(() => {
    warn.mockClear();
    error.mockClear();
  });

  it("logs WARN with 'missing permissions' on Discord code 50013", async () => {
    const rolesAdd = vi.fn().mockRejectedValue(makeApiError(50013, "Missing Permissions"));
    await event.execute(mkMember(rolesAdd));
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/auto-role.*missing permissions/i),
    );
    expect(error).not.toHaveBeenCalled();
  });

  it("logs WARN with 'unknown role' on Discord code 10011", async () => {
    const rolesAdd = vi.fn().mockRejectedValue(makeApiError(10011, "Unknown Role"));
    await event.execute(mkMember(rolesAdd));
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/auto-role.*unknown role/i),
    );
    expect(error).not.toHaveBeenCalled();
  });

  it("logs ERROR for unexpected failure (e.g. 5xx)", async () => {
    const rolesAdd = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    await event.execute(mkMember(rolesAdd));
    expect(error).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run** — `docker compose run --rm bot pnpm test apps/bot/tests/events/autorole-error-handling.test.ts`. Expected: FAIL (current handler always logs `error`).

- [ ] **Step 3: Implement** — in `apps/bot/src/events/guildMemberAdd.ts`, add `DiscordAPIError` to the discord.js imports:

```typescript
import { AttachmentBuilder, DiscordAPIError } from "discord.js";
```

Then replace the auto-role catch (lines 134-138) with:

```typescript
      if (rolesToAdd.length > 0) {
        await member.roles.add(rolesToAdd, "Auto-role on join").catch((err) => {
          if (err instanceof DiscordAPIError) {
            if (err.code === 50013) {
              logger.warn(
                `auto-role: missing permissions in guild ${member.guild.id} (role likely moved above bot between cache check and API call)`,
              );
              return;
            }
            if (err.code === 10011) {
              logger.warn(
                `auto-role: unknown role in guild ${member.guild.id} (role was deleted between cache check and API call)`,
              );
              return;
            }
          }
          logger.error(
            `Failed to assign auto-roles in guild ${member.guild.id}`,
            err instanceof Error ? err : new Error(String(err)),
          );
        });
      }
```

- [ ] **Step 4: Run** — `docker compose run --rm bot pnpm test apps/bot/tests/events/autorole-error-handling.test.ts && docker compose run --rm bot pnpm typecheck`. Expected: PASS.

- [ ] **Step 5: Commit** —

```
fix(welcome): classify auto-role failures by Discord error code

Distinguish 50013 (missing permissions, expected after a hierarchy
race) and 10011 (unknown role, deleted between cache check and API
call) from genuine errors. Avoids drowning operators in error-level
noise for benign TOCTOU outcomes.
```
