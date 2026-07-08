# OAuth State Cookie Replay on Token-Exchange Failure — Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Severity:** MEDIUM
**Goal:** Clear the `oauth_state` cookie immediately after the state is validated so a failed token exchange cannot leave a replayable state.
**Architecture:** Move `reply.clearCookie("oauth_state", ...)` from the success branch to right after the successful state comparison, before the network call to Discord. This guarantees one-time-use semantics regardless of downstream errors.
**Tech Stack:** Fastify 5, TypeScript, Prisma 7, Vitest

---

## Vulnerability
`apps/dashboard/src/server/features/auth/routes.ts:50-98` validates the `oauth_state` cookie against the query `state`, then proceeds to call `exchangeCode`. If `exchangeCode` throws (network error, Discord 5xx, code already redeemed), the catch handler sends a 500 response without clearing `oauth_state`. The cookie remains valid for its 5-minute `maxAge`, so an attacker who tricks a user into re-visiting the callback (or replays a captured request) can re-use the same state value to validate a second authorization code.

## Files
- Modify: `apps/dashboard/src/server/features/auth/routes.ts:60-98`
- Test: `apps/dashboard/tests/server/features/auth/routes.test.ts`

## Tasks

### Task 1: Clear oauth_state cookie immediately after validation

- [ ] **Step 1: Write the failing test**

Add to `apps/dashboard/tests/server/features/auth/routes.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("../../../../src/server/shared/auth.js", async () => {
  const actual = await vi.importActual<
    typeof import("../../../../src/server/shared/auth.js")
  >("../../../../src/server/shared/auth.js");
  return {
    ...actual,
    exchangeCode: vi.fn(async () => {
      throw new Error("Discord 500");
    }),
    fetchUser: vi.fn(),
    fetchGuilds: vi.fn(),
  };
});

describe("/auth/callback failure cleanup", () => {
  it("clears oauth_state cookie even when token exchange fails", async () => {
    const app = await buildApp(); // helper from Task 2 of plan 02
    // First hit /auth/login to get a signed state cookie
    const loginRes = await app.inject({
      method: "GET",
      url: "/auth/login",
    });
    const setCookie = loginRes.headers["set-cookie"] as string | string[];
    const cookieHeader = Array.isArray(setCookie) ? setCookie.join("; ") : setCookie;
    const stateMatch = /oauth_state=([^;]+)/.exec(cookieHeader);
    expect(stateMatch).toBeTruthy();

    const res = await app.inject({
      method: "GET",
      url: "/auth/callback?code=abc&state=state-123",
      cookies: { oauth_state: decodeURIComponent(stateMatch![1]) },
    });

    expect(res.statusCode).toBe(500);
    const cleared = res.headers["set-cookie"];
    const clearedStr = Array.isArray(cleared) ? cleared.join("; ") : (cleared ?? "");
    expect(clearedStr).toMatch(/oauth_state=;/);
    await app.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test apps/dashboard/tests/server/features/auth/routes.test.ts`
Expected: FAIL — `oauth_state` is not cleared on the error path.

- [ ] **Step 3: Implement fix**

Edit `apps/dashboard/src/server/features/auth/routes.ts` lines 56-98:

```typescript
    const unsignedState = request.unsignCookie(stateCookie);
    if (!unsignedState.valid || unsignedState.value !== state) {
      reply
        .clearCookie("oauth_state", { path: "/" })
        .code(403)
        .send({ error: "Invalid state parameter" });
      return;
    }

    // State is valid — burn it immediately so it cannot be replayed
    // regardless of whether the rest of the flow succeeds.
    reply.clearCookie("oauth_state", { path: "/" });

    try {
      const callbackUrl = buildCallbackUrl(config.dashboardPublicUrl);
      const token = await exchangeCode(code, callbackUrl);
      const [user, guilds] = await Promise.all([
        fetchUser(token.access_token),
        fetchGuilds(token.access_token),
      ]);

      const sessionId = await createSession({
        userId: user.id,
        username: user.username,
        avatar: user.avatar,
        accessToken: token.access_token,
        guilds,
      });

      reply
        .setCookie("session", sessionId, {
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          secure: isProduction,
          signed: true,
          maxAge: 604800,
        })
        .redirect("/");
    } catch (error) {
      logger.error(
        "OAuth callback failed",
        error instanceof Error ? error : new Error(String(error)),
      );
      reply.code(500).send({ error: "Authentication failed" });
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test apps/dashboard/tests/server/features/auth/routes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/server/features/auth/routes.ts apps/dashboard/tests/server/features/auth/routes.test.ts
git commit -m "fix(security): clear oauth_state cookie before token exchange"
```
