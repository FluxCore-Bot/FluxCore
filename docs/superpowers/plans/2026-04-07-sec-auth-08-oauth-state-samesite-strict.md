# oauth_state Cookie SameSite=strict — Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Severity:** LOW
**Goal:** Tighten the `oauth_state` cookie's `SameSite` attribute from `lax` to `strict` so it cannot be sent on cross-site top-level navigations.
**Architecture:** The cookie is only ever read by `/auth/callback`, which is reached as a redirect from Discord. Discord's OAuth redirect is a top-level navigation from a different origin — `SameSite=strict` would normally drop the cookie in that case, BUT the destination is the same origin as the cookie. Since the user follows Discord's `Location` header back to our domain, the request is treated as a same-site top-level navigation in modern browsers and the cookie is sent. Verify with a Vitest assertion on the `Set-Cookie` header.
**Tech Stack:** Fastify 5, TypeScript, Prisma 7, Vitest

---

## Vulnerability
`apps/dashboard/src/server/features/auth/routes.ts:31` sets `oauth_state` with `sameSite: "lax"`. While `lax` is generally safe for OAuth state cookies, `strict` is preferable for cookies that should never participate in any cross-site context. This is a defense-in-depth hardening.

## Files
- Modify: `apps/dashboard/src/server/features/auth/routes.ts:31`
- Test: `apps/dashboard/tests/server/features/auth/routes.test.ts`

## Tasks

### Task 1: Set oauth_state cookie SameSite=strict

- [ ] **Step 1: Write the failing test**

Add to `apps/dashboard/tests/server/features/auth/routes.test.ts`:

```typescript
describe("/auth/login oauth_state cookie attributes", () => {
  it("sets SameSite=Strict on the oauth_state cookie", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/auth/login" });
    const setCookies = res.headers["set-cookie"];
    const cookieList = Array.isArray(setCookies) ? setCookies : [setCookies ?? ""];
    const stateCookie = cookieList.find((c) => c.startsWith("oauth_state="));
    expect(stateCookie).toBeDefined();
    expect(stateCookie!.toLowerCase()).toContain("samesite=strict");
    await app.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test apps/dashboard/tests/server/features/auth/routes.test.ts`
Expected: FAIL — current cookie is `SameSite=Lax`.

- [ ] **Step 3: Implement fix**

Edit `apps/dashboard/src/server/features/auth/routes.ts:28-35`:

```typescript
      .setCookie("oauth_state", state, {
        path: "/",
        httpOnly: true,
        sameSite: "strict",
        secure: isProduction,
        signed: true,
        maxAge: 300, // 5 minutes
      })
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test apps/dashboard/tests/server/features/auth/routes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/server/features/auth/routes.ts apps/dashboard/tests/server/features/auth/routes.test.ts
git commit -m "fix(security): set oauth_state cookie SameSite=strict"
```
