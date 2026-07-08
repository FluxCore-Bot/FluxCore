# Logger Sensitive Value Redaction — Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Severity:** MEDIUM
**Goal:** Prevent the shared `@fluxcore/utils` logger from emitting bearer tokens, Discord bot tokens, webhook URLs, and OAuth code/secret query parameters to stdout/log files.
**Architecture:** `packages/utils/src/logger.ts` exposes `logger.{debug,info,warn,error}` which currently format the message via `console.log` with no transformation. We will add a pure `redactSensitive(value: string): string` helper, run every formatted log line through it before printing, and unit-test the regexes against representative inputs (Bearer tokens, bot tokens, Discord webhook URLs, query strings with `?token=` / `?code=` / `?client_secret=`). The error stack is also redacted.
**Tech Stack:** Prisma 7, PostgreSQL 18, TypeScript, Vitest

---

## Vulnerability
`packages/utils/src/logger.ts:46-49` directly `console.log`s the caller-supplied message and any error stack. Several call sites today (e.g. `apps/dashboard/src/server/shared/auth.ts`, action executors making outbound HTTPS, music player URL handling) can inadvertently include OAuth bearer tokens, Discord bot tokens (`MTAxxxxx.G...`), webhook URLs (`https://discord.com/api/webhooks/<id>/<token>`), or full request URLs containing `?code=`, `?token=`, `?client_secret=`, `?api_key=`. Anyone with stdout access (Docker logs, log aggregator, screen-share during incident response) sees the secret. Logs are also commonly archived for longer than the secrets are valid.

## Files
- Read: `packages/utils/src/logger.ts`
- Modify: `packages/utils/src/logger.ts`
- Create: `packages/utils/tests/logger.test.ts`

## Tasks

### Task 1: Add `redactSensitive` and route all log writes through it

- [ ] **Step 1: Write the failing test**

Create `packages/utils/tests/logger.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: { logLevel: "debug" },
}));

import { logger, redactSensitive } from "../src/logger.js";

describe("redactSensitive", () => {
  it("redacts Bearer tokens", () => {
    expect(redactSensitive("Authorization: Bearer abc.def.ghi")).toBe(
      "Authorization: Bearer [REDACTED]",
    );
  });

  it("redacts Discord bot tokens (MFA-format)", () => {
    const tok = "MTAxNzg5NjU0MzIxMDk4NzY1NA.GabCde.fghIjkLmnOpqrStuvwxyz0123456789ABCDEF";
    expect(redactSensitive(`Logging in with ${tok}`)).toContain("[REDACTED]");
    expect(redactSensitive(`Logging in with ${tok}`)).not.toContain(tok);
  });

  it("redacts Discord webhook URLs", () => {
    const url = "https://discord.com/api/webhooks/1234567890/abcdefgHIJKLMNOPqrstuvwxyz";
    expect(redactSensitive(`POST to ${url}`)).toBe(
      "POST to https://discord.com/api/webhooks/[REDACTED]",
    );
  });

  it("redacts query parameters that look secret", () => {
    expect(
      redactSensitive("https://api.example.com/x?code=abc123&keep=ok"),
    ).toBe("https://api.example.com/x?code=[REDACTED]&keep=ok");
    expect(
      redactSensitive("https://api.example.com/x?client_secret=xyz"),
    ).toBe("https://api.example.com/x?client_secret=[REDACTED]");
    expect(
      redactSensitive("https://api.example.com/x?token=abc&api_key=def"),
    ).toBe("https://api.example.com/x?token=[REDACTED]&api_key=[REDACTED]");
  });

  it("leaves benign strings alone", () => {
    expect(redactSensitive("hello world")).toBe("hello world");
  });
});

describe("logger redaction", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("redacts secrets in info messages", () => {
    logger.info("token=Bearer secret123");
    const printed = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(printed).not.toContain("secret123");
    expect(printed).toContain("[REDACTED]");
  });

  it("redacts secrets in error stacks", () => {
    const err = new Error("failed");
    err.stack = "Error: failed\n    at fn (https://x?token=leak)";
    logger.error("oops", err);
    const printed = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(printed).not.toContain("leak");
    expect(printed).toContain("[REDACTED]");
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

```bash
docker compose run --rm bot pnpm --filter @fluxcore/utils test packages/utils/tests/logger.test.ts
```

Expect: `redactSensitive is not exported`.

- [ ] **Step 3: Implement redaction**

Replace `packages/utils/src/logger.ts` content (preserving the existing public API):

```typescript
import { config } from "@fluxcore/config";

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const LEVEL_MAP: Record<string, LogLevel> = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
};

const COLORS = {
  reset: "\x1b[0m",
  gray: "\x1b[90m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
};

const REDACTED = "[REDACTED]";

// Order matters: webhook URLs before generic query-param redaction.
const REDACTION_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // Bearer / token / Basic Authorization headers
  { pattern: /(Bearer\s+)[A-Za-z0-9._\-+/=]+/gi, replacement: `$1${REDACTED}` },
  { pattern: /(Basic\s+)[A-Za-z0-9+/=]+/gi, replacement: `$1${REDACTED}` },
  // Discord webhook URLs: keep the path prefix but drop id+token
  {
    pattern: /https:\/\/(?:[a-z]+\.)?discord(?:app)?\.com\/api(?:\/v\d+)?\/webhooks\/[^\s"'<>]+/gi,
    replacement: `https://discord.com/api/webhooks/${REDACTED}`,
  },
  // Discord bot tokens: 3 base64url segments separated by `.`
  {
    pattern: /[MN][A-Za-z\d]{23,28}\.[\w-]{6,7}\.[\w-]{27,}/g,
    replacement: REDACTED,
  },
  // Sensitive query parameters
  {
    pattern: /([?&](?:code|token|access_token|refresh_token|client_secret|api[_-]?key|secret|password)=)[^&\s"'<>]+/gi,
    replacement: `$1${REDACTED}`,
  },
];

export function redactSensitive(value: string): string {
  if (!value) return value;
  let out = value;
  for (const { pattern, replacement } of REDACTION_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

class Logger {
  private level: LogLevel;

  constructor() {
    this.level = LEVEL_MAP[config.logLevel] ?? LogLevel.INFO;
  }

  private timestamp(): string {
    return new Date().toISOString();
  }

  private log(
    level: LogLevel,
    label: string,
    color: string,
    message: string,
    error?: Error,
  ): void {
    if (level < this.level) return;
    const ts = `${COLORS.gray}${this.timestamp()}${COLORS.reset}`;
    const tag = `${color}[${label}]${COLORS.reset}`;
    console.log(`${ts} ${tag} ${redactSensitive(message)}`);
    if (error?.stack) {
      console.log(`${COLORS.gray}${redactSensitive(error.stack)}${COLORS.reset}`);
    }
  }

  debug(message: string): void {
    this.log(LogLevel.DEBUG, "DEBUG", COLORS.gray, message);
  }

  info(message: string): void {
    this.log(LogLevel.INFO, "INFO", COLORS.cyan, message);
  }

  warn(message: string): void {
    this.log(LogLevel.WARN, "WARN", COLORS.yellow, message);
  }

  error(message: string, error?: Error): void {
    this.log(LogLevel.ERROR, "ERROR", COLORS.red, message, error);
  }
}

export const logger = new Logger();
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
docker compose run --rm bot pnpm --filter @fluxcore/utils test packages/utils/tests/logger.test.ts
docker compose run --rm bot pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add packages/utils/src/logger.ts packages/utils/tests/logger.test.ts
git commit -m "feat(logger): redact bearer tokens, webhooks, and secret query params"
```
