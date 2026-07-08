# DashboardSession Access Token Encryption Audit — Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Severity:** CRITICAL
**Goal:** Guarantee that `DashboardSession.accessToken` is always written encrypted (AES-256-GCM) and decrypted on every read, that the column type/comment in Prisma reflects the encrypted contract, and that any pre-existing plaintext rows are migrated to ciphertext.
**Architecture:** `apps/dashboard/src/server/shared/crypto.ts` already implements AES-256-GCM (`encrypt`/`decrypt`). `apps/dashboard/src/server/shared/session.ts` calls `encrypt(data.accessToken)` on `createSession` and `decrypt(row.accessToken)` on `getSession`. We will (1) add a typed wrapper module so the contract is enforced via the type system, (2) sweep the codebase for any other write/read site that bypasses the wrapper, (3) add a one-shot data-migration script that detects rows whose value is not valid base64-of-(iv+tag+ct) and re-encrypts them, and (4) lock the contract with unit + integration tests.
**Tech Stack:** Prisma 7, PostgreSQL 18, TypeScript, Vitest

---

## Vulnerability
`packages/database/prisma/schema.prisma:109` declares `accessToken String` with no indication that the value is encrypted. Today the only writer (`createSession` in `apps/dashboard/src/server/shared/session.ts:61`) wraps the token in `encrypt(...)`, but there is no compile-time guarantee that future writers do the same. Any contributor that calls `prisma.dashboardSession.create/update` directly will silently store the OAuth bearer token in plaintext, which (a) leaks Discord account access if the DB is dumped and (b) is invisible because reads use `decrypt()` and would either succeed (returning garbage) or throw at the next request. Additionally, environments that pre-date the encryption helper may still have plaintext rows.

## Files
- Read: `apps/dashboard/src/server/shared/crypto.ts`
- Read: `apps/dashboard/src/server/shared/session.ts`
- Read: `packages/database/prisma/schema.prisma`
- Modify: `apps/dashboard/src/server/shared/crypto.ts` (add `isEncrypted` helper + `ENCRYPTED_PREFIX`)
- Modify: `apps/dashboard/src/server/shared/session.ts` (wrap all writes through a typed helper, add defensive read)
- Modify: `packages/database/prisma/schema.prisma` (add `/// @encrypted` doc comment)
- Create: `packages/database/prisma/migrations/20260407120000_encrypt_dashboard_session_tokens/migration.sql`
- Create: `scripts/migrate-encrypt-session-tokens.ts` (data backfill)
- Create: `apps/dashboard/tests/server/shared/crypto.test.ts`
- Create: `apps/dashboard/tests/server/shared/session-encryption.test.ts`

## Tasks

### Task 1: Add `isEncrypted` detection helper to crypto module

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/tests/server/shared/crypto.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: { dashboardSessionSecret: "test-secret-do-not-use-in-prod-1234567890" },
}));

import { encrypt, decrypt, isEncrypted } from "../../../src/server/shared/crypto.js";

describe("crypto helpers", () => {
  it("encrypt -> decrypt round-trips", () => {
    const plaintext = "discord_oauth_access_token_value";
    const encoded = encrypt(plaintext);
    expect(encoded).not.toBe(plaintext);
    expect(decrypt(encoded)).toBe(plaintext);
  });

  it("isEncrypted returns true for output of encrypt()", () => {
    expect(isEncrypted(encrypt("hello"))).toBe(true);
  });

  it("isEncrypted returns false for arbitrary plaintext", () => {
    expect(isEncrypted("plain-bearer-token")).toBe(false);
    expect(isEncrypted("")).toBe(false);
    expect(isEncrypted("not-base64!!!")).toBe(false);
  });

  it("decrypt throws on tampered ciphertext", () => {
    const enc = encrypt("payload");
    const tampered = enc.slice(0, -4) + "AAAA";
    expect(() => decrypt(tampered)).toThrow();
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

```bash
docker compose run --rm dashboard pnpm --filter @fluxcore/dashboard test apps/dashboard/tests/server/shared/crypto.test.ts
```

Expect: `isEncrypted is not a function`.

- [ ] **Step 3: Implement `isEncrypted` in `apps/dashboard/src/server/shared/crypto.ts`**

Append to the file:

```typescript
const MIN_ENCRYPTED_BYTES = IV_LENGTH + AUTH_TAG_LENGTH + 1;

/**
 * Best-effort check whether a stored string was produced by `encrypt()`.
 * Used to detect legacy plaintext rows during the encryption backfill.
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false;
  // Base64 alphabet check (allow padding)
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
  let buf: Buffer;
  try {
    buf = Buffer.from(value, "base64");
  } catch {
    return false;
  }
  if (buf.length < MIN_ENCRYPTED_BYTES) return false;
  // Verify by attempting decryption with the active key
  try {
    decrypt(value);
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
docker compose run --rm dashboard pnpm --filter @fluxcore/dashboard test apps/dashboard/tests/server/shared/crypto.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/server/shared/crypto.ts apps/dashboard/tests/server/shared/crypto.test.ts
git commit -m "feat(crypto): add isEncrypted helper for session token migration"
```

### Task 2: Funnel all DashboardSession writes through a typed helper

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/tests/server/shared/session-encryption.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: { dashboardSessionSecret: "test-secret-do-not-use-in-prod-1234567890" },
}));

const createMock = vi.fn();
const findUniqueMock = vi.fn();
const updateMock = vi.fn();

vi.mock("@fluxcore/database", () => ({
  getPrisma: () => ({
    dashboardSession: {
      create: createMock,
      findUnique: findUniqueMock,
      update: updateMock,
      deleteMany: vi.fn(),
    },
  }),
}));

vi.mock("@fluxcore/utils", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../src/server/shared/auth.js", () => ({
  fetchGuilds: vi.fn().mockResolvedValue([]),
}));

import { createSession } from "../../../src/server/shared/session.js";
import { isEncrypted } from "../../../src/server/shared/crypto.js";

describe("createSession", () => {
  beforeEach(() => {
    createMock.mockReset();
    createMock.mockResolvedValue(undefined);
  });

  it("never persists the access token in plaintext", async () => {
    const plaintextToken = "ya29.PLAINTEXT_BEARER_TOKEN";
    await createSession({
      userId: "1",
      username: "u",
      avatar: null,
      accessToken: plaintextToken,
      guilds: [],
    });

    expect(createMock).toHaveBeenCalledTimes(1);
    const stored = createMock.mock.calls[0][0].data.accessToken as string;
    expect(stored).not.toBe(plaintextToken);
    expect(isEncrypted(stored)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test and watch it pass for createSession (already encrypted) — but extend to assert update sites**

```bash
docker compose run --rm dashboard pnpm --filter @fluxcore/dashboard test apps/dashboard/tests/server/shared/session-encryption.test.ts
```

The first test should pass. Now add a second `it()` block that verifies any future `update({ data: { accessToken } })` callsite is also wrapped. Search the codebase to confirm there are no other writers:

```bash
docker compose run --rm dashboard sh -lc 'grep -rn "dashboardSession\." apps/dashboard/src packages | grep -E "create|update"'
```

If results contain only `session.ts:55` (`create`) and `session.ts:133/166` (`update` for `expiresAt`/`guilds`, **not** `accessToken`), the audit is clean. Document this in a code comment.

- [ ] **Step 3: Add the type-level guard in `apps/dashboard/src/server/shared/session.ts`**

Replace the inline `accessToken: encrypt(data.accessToken),` with a dedicated helper at the top of the file:

```typescript
import { encrypt, decrypt, isEncrypted } from "./crypto.js";

/**
 * Encrypt a Discord OAuth access token for storage.
 * ALL writes to DashboardSession.accessToken MUST go through this helper.
 */
function encryptAccessToken(token: string): string {
  if (!token) throw new Error("encryptAccessToken: empty token");
  return encrypt(token);
}

/**
 * Decrypt a stored access token, with a defensive fallback for the
 * (now-illegal) case of legacy plaintext rows: if the value does not
 * decrypt cleanly, log a security warning and refuse to use it.
 */
function decryptAccessToken(stored: string): string {
  if (!isEncrypted(stored)) {
    logger.error(
      "DashboardSession.accessToken is not encrypted; refusing to use. Run scripts/migrate-encrypt-session-tokens.ts",
    );
    throw new Error("Session token is not encrypted");
  }
  return decrypt(stored);
}
```

Update `createSession` to call `encryptAccessToken(data.accessToken)` and `getSession` to call `decryptAccessToken(row.accessToken)`.

- [ ] **Step 4: Run the test and watch it pass**

```bash
docker compose run --rm dashboard pnpm --filter @fluxcore/dashboard test apps/dashboard/tests/server/shared/session-encryption.test.ts
docker compose run --rm dashboard pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/server/shared/session.ts apps/dashboard/tests/server/shared/session-encryption.test.ts
git commit -m "fix(session): funnel access-token writes through typed encrypt helper"
```

### Task 3: Schema annotation + data migration for legacy plaintext rows

- [ ] **Step 1: Write the failing migration script test**

Create `apps/dashboard/tests/server/shared/session-backfill.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: { dashboardSessionSecret: "test-secret-do-not-use-in-prod-1234567890" },
}));

const findManyMock = vi.fn();
const updateMock = vi.fn();

vi.mock("@fluxcore/database", () => ({
  getPrisma: () => ({
    dashboardSession: { findMany: findManyMock, update: updateMock },
  }),
}));

vi.mock("@fluxcore/utils", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { backfillEncryptSessionTokens } from "../../../../scripts/migrate-encrypt-session-tokens.js";
import { encrypt, isEncrypted } from "../../../src/server/shared/crypto.js";

describe("backfillEncryptSessionTokens", () => {
  it("re-encrypts plaintext rows and skips already-encrypted rows", async () => {
    findManyMock.mockResolvedValue([
      { id: "a", accessToken: "plain-token-1" },
      { id: "b", accessToken: encrypt("already-ciphertext") },
      { id: "c", accessToken: "plain-token-2" },
    ]);
    updateMock.mockResolvedValue(undefined);

    const summary = await backfillEncryptSessionTokens();

    expect(summary.encrypted).toBe(2);
    expect(summary.skipped).toBe(1);
    const encryptedCalls = updateMock.mock.calls.filter(
      (c) => c[0].where.id === "a" || c[0].where.id === "c",
    );
    expect(encryptedCalls).toHaveLength(2);
    for (const call of encryptedCalls) {
      expect(isEncrypted(call[0].data.accessToken)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

```bash
docker compose run --rm dashboard pnpm --filter @fluxcore/dashboard test apps/dashboard/tests/server/shared/session-backfill.test.ts
```

Expect: cannot find module `scripts/migrate-encrypt-session-tokens.js`.

- [ ] **Step 3: Implement migration script and Prisma annotation**

Create `scripts/migrate-encrypt-session-tokens.ts`:

```typescript
import { getPrisma } from "@fluxcore/database";
import { logger } from "@fluxcore/utils";
import { encrypt, isEncrypted } from "../apps/dashboard/src/server/shared/crypto.js";

export interface BackfillSummary {
  encrypted: number;
  skipped: number;
}

export async function backfillEncryptSessionTokens(): Promise<BackfillSummary> {
  const prisma = getPrisma();
  const rows = await prisma.dashboardSession.findMany({
    select: { id: true, accessToken: true },
  });

  let encrypted = 0;
  let skipped = 0;

  for (const row of rows) {
    if (isEncrypted(row.accessToken)) {
      skipped++;
      continue;
    }
    await prisma.dashboardSession.update({
      where: { id: row.id },
      data: { accessToken: encrypt(row.accessToken) },
    });
    encrypted++;
  }

  logger.info(
    `DashboardSession backfill complete: encrypted=${encrypted} skipped=${skipped}`,
  );
  return { encrypted, skipped };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  backfillEncryptSessionTokens()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error("Backfill failed", err);
      process.exit(1);
    });
}
```

Edit `packages/database/prisma/schema.prisma` line 109 to add a doc comment:

```prisma
  /// Encrypted with AES-256-GCM via apps/dashboard/src/server/shared/crypto.ts
  /// MUST be written through encryptAccessToken() in session.ts
  accessToken       String
```

Then create the (no-op SQL) migration to lock the schema state:

```bash
docker compose run --rm dashboard pnpm db:migrate --name encrypt_dashboard_session_tokens
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
docker compose run --rm dashboard pnpm --filter @fluxcore/dashboard test apps/dashboard/tests/server/shared/session-backfill.test.ts
docker compose run --rm dashboard pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate-encrypt-session-tokens.ts packages/database/prisma/schema.prisma packages/database/prisma/migrations/ apps/dashboard/tests/server/shared/session-backfill.test.ts
git commit -m "fix(session): backfill script + schema annotation for encrypted access tokens"
```
