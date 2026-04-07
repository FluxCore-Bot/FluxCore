# Custom Command Regex ReDoS — Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Severity:** MEDIUM
**Goal:** Reject regex-trigger custom commands whose pattern is exponential / catastrophic-backtracking-prone before they are persisted, so the bot's hot path cannot be DOSed.
**Architecture:** Use the `safe-regex` package (already common in Node ecosystems; small footprint) inside both POST and PUT handlers to validate user-supplied patterns. If the pattern is unsafe, reject with 400. We also enforce a max length of 200 chars and reject patterns containing nested unbounded repetition.
**Tech Stack:** Fastify 5, TypeScript, Prisma 7, Vitest

---

## Vulnerability
`apps/dashboard/src/server/features/commands/routes.ts:111-118` and `:220-227` compile user input via `new RegExp(body.name, "i")`. They only check that the pattern *parses* — not that it can be evaluated in bounded time. A malicious admin (or compromised account) can save `(a+)+$` as a regex trigger; every subsequent message in the guild will then run the bot's regex matcher into catastrophic backtracking, freezing the message handler.

## Files
- Modify: `apps/dashboard/src/server/features/commands/routes.ts:110-118, 219-227`
- Modify: `apps/dashboard/package.json` (add `safe-regex` dep, inside Docker)
- Test: `apps/dashboard/tests/server/features/commands/regexValidation.test.ts` (new file)

## Tasks

### Task 1: Reject pathological regex patterns

- [ ] **Step 1: Install safe-regex (inside Docker)**

```bash
docker compose -f docker-compose.yml run --rm dashboard pnpm add safe-regex
docker compose -f docker-compose.yml run --rm dashboard pnpm add -D @types/safe-regex
```

- [ ] **Step 2: Write the failing test**

Create `apps/dashboard/tests/server/features/commands/regexValidation.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: { token: "t", clientId: "c", dashboardSessionSecret: "s", logLevel: "info" },
}));

const session = {
  userId: "user-1",
  username: "u",
  guilds: [{ id: "guild-1", name: "T", permissions: BigInt(0x20).toString() }],
};
vi.mock("../../../../src/server/shared/session.js", () => ({
  getSession: vi.fn().mockResolvedValue(session),
  touchSession: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../../../src/server/shared/discordApi.js", () => ({
  isBotInGuild: vi.fn().mockResolvedValue(true),
  getGuildOwnerId: vi.fn().mockResolvedValue("owner-1"),
}));
vi.mock("../../../../src/server/shared/permissions.js", () => ({
  resolveUserPermissions: vi.fn().mockResolvedValue({ permissions: new Set(["*"]), isOwner: true }),
  hasPermission: vi.fn().mockReturnValue(true),
  invalidatePermissionCache: vi.fn(),
  createDashboardAuditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@fluxcore/systems/customCommands/persistence", () => ({
  getCustomCommands: vi.fn().mockResolvedValue([]),
  getCustomCommandCount: vi.fn().mockResolvedValue(0),
  createCustomCommand: vi.fn().mockResolvedValue({ id: 1 }),
  updateCustomCommand: vi.fn().mockResolvedValue({ id: 1 }),
  deleteCustomCommand: vi.fn(),
}));
vi.mock("@fluxcore/systems/customCommands/constants", () => ({
  MAX_COMMANDS_PER_GUILD: 100,
  TRIGGER_TYPES: ["exact", "startsWith", "contains", "regex"],
}));
vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import { registerCustomCommandRoutes } from "../../../../src/server/features/commands/routes.js";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: "test-secret" });
  registerCustomCommandRoutes(app);
  await app.ready();
  return app;
}

describe("POST /custom-commands — regex safety", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("rejects catastrophic backtracking pattern (a+)+$", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/guilds/guild-1/custom-commands",
      cookies: { session: app.signCookie("valid") },
      payload: { name: "(a+)+$", triggerType: "regex" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/unsafe|regex/i);
  });

  it("rejects nested quantifier pattern (a*)*", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/guilds/guild-1/custom-commands",
      cookies: { session: app.signCookie("valid") },
      payload: { name: "(a*)*", triggerType: "regex" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("accepts a simple safe regex", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/guilds/guild-1/custom-commands",
      cookies: { session: app.signCookie("valid") },
      payload: { name: "^hello", triggerType: "regex" },
    });
    expect(res.statusCode).toBe(201);
  });
});
```

- [ ] **Step 3: Run test to verify fail**

```bash
pnpm --filter @fluxcore/dashboard test -- regexValidation
```

Expected: the two unsafe-pattern tests FAIL — current handler accepts them.

- [ ] **Step 4: Implement the fix**

Edit `apps/dashboard/src/server/features/commands/routes.ts` — at the top of the file add:

```typescript
import safeRegex from "safe-regex";

const MAX_REGEX_LENGTH = 200;

function validateRegexPattern(pattern: string): string | null {
  if (pattern.length > MAX_REGEX_LENGTH) {
    return `Regex pattern too long (max ${MAX_REGEX_LENGTH} chars)`;
  }
  try {
    new RegExp(pattern, "i");
  } catch {
    return "Invalid regex pattern";
  }
  if (!safeRegex(pattern)) {
    return "Unsafe regex pattern (catastrophic backtracking risk)";
  }
  return null;
}
```

Then replace lines 110-118 (POST handler) with:

```typescript
      // Validate regex if trigger type is regex
      if (body.triggerType === "regex") {
        const err = validateRegexPattern(body.name);
        if (err) {
          reply.code(400).send({ error: err });
          return;
        }
      }
```

And replace lines 219-227 (PUT handler) with:

```typescript
      // Validate regex if trigger type is being changed to regex
      if (body.triggerType === "regex" && body.name) {
        const err = validateRegexPattern(body.name);
        if (err) {
          reply.code(400).send({ error: err });
          return;
        }
      }
```

- [ ] **Step 5: Run test to verify pass**

```bash
pnpm --filter @fluxcore/dashboard test -- regexValidation
pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/server/features/commands/routes.ts apps/dashboard/tests/server/features/commands/regexValidation.test.ts apps/dashboard/package.json pnpm-lock.yaml
git commit -m "fix(commands): reject unsafe regex patterns to prevent ReDoS"
```
