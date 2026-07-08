# Add Explicit CSRF Tokens to Mutating Routes — Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Severity:** MEDIUM
**Goal:** Add a synchronizer-token (double-submit cookie) CSRF defense to all state-mutating dashboard routes.
**Architecture:** Add a `requireCsrf` Fastify hook that checks `x-csrf-token` request header against a separately stored, non-HttpOnly `csrf_token` cookie. Also add a `/auth/csrf` GET endpoint that issues a fresh token. Apply the hook to POST/PUT/PATCH/DELETE under `/api/*`.
**Tech Stack:** Fastify 5, TypeScript, Prisma 7, Vitest

---

## Vulnerability
`apps/dashboard/src/server/shared/middleware.ts` and the route registrations in `index.ts` rely solely on `SameSite=lax` cookies and Content-Type checks for CSRF defense. `SameSite=lax` allows top-level POST navigations from browsers in some scenarios (e.g. form submission via `<form method=post>` triggered by user click on an attacker page), and lacks the explicit synchronizer-token guarantee. There is no CSRF token validation at all on `POST /api/guilds/:guildId/...` routes.

## Files
- Add: `apps/dashboard/src/server/shared/csrf.ts`
- Modify: `apps/dashboard/src/server/index.ts` (register hook + route)
- Modify: `apps/dashboard/src/server/features/auth/routes.ts` (issue token on login)
- Test: `apps/dashboard/tests/server/shared/csrf.test.ts`

## Tasks

### Task 1: Implement CSRF helper + Fastify hook

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/tests/server/shared/csrf.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import { generateCsrfToken, requireCsrf } from "../../../src/server/shared/csrf.js";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: "x".repeat(64) });
  app.get("/issue", async (_req, reply) => {
    const token = generateCsrfToken();
    reply
      .setCookie("csrf_token", token, { path: "/", sameSite: "lax" })
      .send({ token });
  });
  app.post("/safe", { preHandler: requireCsrf }, async () => ({ ok: true }));
  return app;
}

describe("CSRF double-submit", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    app = await buildApp();
  });

  it("rejects POST without csrf cookie", async () => {
    const res = await app.inject({ method: "POST", url: "/safe" });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("rejects POST with mismatched token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/safe",
      cookies: { csrf_token: "abc" },
      headers: { "x-csrf-token": "xyz" },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("accepts POST with matching token", async () => {
    const issue = await app.inject({ method: "GET", url: "/issue" });
    const body = issue.json() as { token: string };
    const res = await app.inject({
      method: "POST",
      url: "/safe",
      cookies: { csrf_token: body.token },
      headers: { "x-csrf-token": body.token },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it("rejects when token is short (likely empty)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/safe",
      cookies: { csrf_token: "" },
      headers: { "x-csrf-token": "" },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test apps/dashboard/tests/server/shared/csrf.test.ts`
Expected: FAIL — `csrf.ts` does not exist.

- [ ] **Step 3: Implement fix**

Create `apps/dashboard/src/server/shared/csrf.ts`:

```typescript
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyRequest, FastifyReply } from "fastify";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const TOKEN_BYTES = 32;
const MIN_TOKEN_LENGTH = TOKEN_BYTES * 2; // hex

export function generateCsrfToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

export async function requireCsrf(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (SAFE_METHODS.has(request.method)) return;

  const cookieToken = request.cookies?.csrf_token;
  const headerToken = request.headers["x-csrf-token"];
  const headerStr = Array.isArray(headerToken) ? headerToken[0] : headerToken;

  if (
    !cookieToken ||
    !headerStr ||
    cookieToken.length < MIN_TOKEN_LENGTH ||
    headerStr.length < MIN_TOKEN_LENGTH ||
    !safeEqual(cookieToken, headerStr)
  ) {
    reply.code(403).send({
      error: "CSRF token missing or invalid",
      errorKey: "errors:csrf.invalid",
    });
    return;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test apps/dashboard/tests/server/shared/csrf.test.ts`
Expected: PASS (all 4 cases).

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/server/shared/csrf.ts apps/dashboard/tests/server/shared/csrf.test.ts
git commit -m "feat(security): add CSRF double-submit token helper"
```

### Task 2: Wire CSRF into the dashboard server

- [ ] **Step 1: Write the failing test**

Add to `apps/dashboard/tests/server/features/auth/routes.test.ts`:

```typescript
describe("/auth/csrf", () => {
  it("issues a csrf_token cookie and matching body token", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/auth/csrf" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { token: string };
    expect(body.token).toMatch(/^[0-9a-f]{64}$/);
    const setCookie = res.headers["set-cookie"];
    const cookieStr = Array.isArray(setCookie) ? setCookie.join("; ") : (setCookie ?? "");
    expect(cookieStr).toContain(`csrf_token=${body.token}`);
    await app.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test apps/dashboard/tests/server/features/auth/routes.test.ts`
Expected: FAIL — route does not exist.

- [ ] **Step 3: Implement fix**

In `apps/dashboard/src/server/features/auth/routes.ts`, add inside `registerAuthRoutes` and import `generateCsrfToken`:

```typescript
import { generateCsrfToken } from "../../shared/csrf.js";

// ... inside registerAuthRoutes:
  app.get("/auth/csrf", async (_request, reply) => {
    const token = generateCsrfToken();
    reply
      .setCookie("csrf_token", token, {
        path: "/",
        httpOnly: false, // double-submit: JS must read it
        sameSite: "lax",
        secure: isProduction,
        maxAge: 604800,
      })
      .send({ token });
  });
```

In `apps/dashboard/src/server/index.ts`, after registering plugins and before route registration:

```typescript
import { requireCsrf } from "./shared/csrf.js";

// ... after fastifyCookie / fastifyHelmet / fastifyRateLimit:
  app.addHook("preHandler", async (request, reply) => {
    if (
      request.url.startsWith("/api/") &&
      !["GET", "HEAD", "OPTIONS"].includes(request.method)
    ) {
      await requireCsrf(request, reply);
    }
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test apps/dashboard/tests/server/features/auth/routes.test.ts`
Expected: PASS. Then run the broader dashboard tests to ensure existing routes still pass when given CSRF tokens (or are GETs):
Run: `pnpm --filter @fluxcore/dashboard test`
Expected: any failing route tests must be updated to include `x-csrf-token` headers + matching cookies.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/server/shared/csrf.ts apps/dashboard/src/server/features/auth/routes.ts apps/dashboard/src/server/index.ts apps/dashboard/tests/server/features/auth/routes.test.ts apps/dashboard/tests/server/shared/csrf.test.ts
git commit -m "feat(security): enforce CSRF double-submit on /api mutating routes"
```
