# Helmet CSP 'unsafe-inline' for Styles — Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Severity:** MEDIUM
**Goal:** Replace `'unsafe-inline'` in the `style-src` CSP directive with a per-request nonce that matches inline `<style>` tags emitted by the SPA.
**Architecture:** Use `@fastify/helmet`'s built-in nonce generator, expose the nonce on `request`, inject it into the served `index.html`, and update the React build to consume `window.__CSP_NONCE__` on dynamically inserted styles. For Tailwind 4 (which precompiles all styles), no inline styles are needed at all — so the nonce path is only needed for `<style>` tags Vite emits in dev/prod for HMR or critical CSS, otherwise we can simply drop `'unsafe-inline'`.
**Tech Stack:** Fastify 5, TypeScript, Prisma 7, Vitest

---

## Vulnerability
`apps/dashboard/src/server/index.ts:57-67` configures Helmet with `styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"]`. `'unsafe-inline'` defeats one of CSP's main protections: an attacker who finds a stored XSS hole can inject `<style>` blocks that exfiltrate data via background-image URL trickery, or rewrite UI to phish credentials. Tailwind 4 produces a single linked stylesheet, so inline styles are not required for normal operation.

## Files
- Modify: `apps/dashboard/src/server/index.ts:57-67`
- Test: `apps/dashboard/tests/server/index.test.ts` (new file)

## Tasks

### Task 1: Drop 'unsafe-inline' and use nonce for any inline styles

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/tests/server/index.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyHelmet from "@fastify/helmet";

// We test the CSP directive shape independently of the full server boot
describe("dashboard CSP", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    await app.register(fastifyHelmet, {
      enableCSPNonces: true,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", (_req, reply) => `'nonce-${(reply as any).cspNonce.script}'`],
          styleSrc: ["'self'", "https://fonts.googleapis.com", (_req, reply) => `'nonce-${(reply as any).cspNonce.style}'`],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https://cdn.discordapp.com"],
        },
      },
    });
    app.get("/", async (_req, reply) => {
      reply.type("text/html").send("<html></html>");
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("does not include 'unsafe-inline' in style-src", async () => {
    const res = await app.inject({ method: "GET", url: "/" });
    const csp = res.headers["content-security-policy"] as string;
    expect(csp).toBeDefined();
    const styleDirective = csp.split(";").find((d) => d.trim().startsWith("style-src"));
    expect(styleDirective).toBeDefined();
    expect(styleDirective).not.toContain("'unsafe-inline'");
    expect(styleDirective).toMatch(/'nonce-[^']+'/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test apps/dashboard/tests/server/index.test.ts`
Expected: PASS for the standalone test (it builds its own app). Now port the same expectation against the real server config — the existing `apps/dashboard/src/server/index.ts` includes `'unsafe-inline'`, so add this stricter assertion against the actual file content:

```typescript
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

it("server index.ts CSP config does not contain 'unsafe-inline'", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(
    resolve(here, "../../../src/server/index.ts"),
    "utf8",
  );
  // Locate the styleSrc array and assert it has no 'unsafe-inline'
  const match = /styleSrc:\s*\[([^\]]*)\]/.exec(src);
  expect(match, "styleSrc directive missing").toBeTruthy();
  expect(match![1]).not.toContain("'unsafe-inline'");
});
```

Run: `pnpm test apps/dashboard/tests/server/index.test.ts`
Expected: FAIL — current `index.ts` still contains `'unsafe-inline'`.

- [ ] **Step 3: Implement fix**

Edit `apps/dashboard/src/server/index.ts:57-67`:

```typescript
  await app.register(fastifyHelmet, {
    enableCSPNonces: true,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          (_req, reply) =>
            `'nonce-${(reply as unknown as { cspNonce: { script: string } }).cspNonce.script}'`,
        ],
        styleSrc: [
          "'self'",
          "https://fonts.googleapis.com",
          (_req, reply) =>
            `'nonce-${(reply as unknown as { cspNonce: { style: string } }).cspNonce.style}'`,
        ],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https://cdn.discordapp.com"],
      },
    },
  });
```

If the SPA's compiled `index.html` ships any inline `<style>` tags, the SPA fallback handler at `index.ts:131-138` must inject the nonce. Update it:

```typescript
import { readFile } from "node:fs/promises";

  if (process.env.NODE_ENV === "production") {
    const indexHtmlPath = join(__dirname, "../client/index.html");
    const indexHtmlTemplate = await readFile(indexHtmlPath, "utf8");

    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith("/api/") || request.url.startsWith("/auth/")) {
        reply.code(404).send({ error: "Not found" });
        return;
      }
      const nonce = (reply as unknown as { cspNonce: { style: string } })
        .cspNonce.style;
      const html = indexHtmlTemplate.replace(/<style/g, `<style nonce="${nonce}"`);
      reply.type("text/html").send(html);
    });
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test apps/dashboard/tests/server/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/server/index.ts apps/dashboard/tests/server/index.test.ts
git commit -m "fix(security): replace style-src 'unsafe-inline' with CSP nonce"
```
