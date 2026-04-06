/**
 * Auth setup — runs once before the test suite.
 *
 * Strategy: inject a test session cookie via the /api/auth/test-session endpoint
 * (enabled only when NODE_ENV=test).  The resulting browser storage state is
 * saved to .auth/session.json and reused by every spec.
 *
 * Required env vars (set in .env.test or your CI secrets):
 *   TEST_GUILD_ID   — a Discord guild ID the test user has access to
 *   TEST_SESSION    — the `fluxcore.sid` cookie value from a real login, OR
 *                     the server will auto-generate one when NODE_ENV=test
 */
import { test as setup, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = path.join(__dirname, "../.auth/session.json");

setup("authenticate", async ({ page, request }) => {
  // If a real session cookie is provided, inject it directly
  const sessionCookie = process.env.TEST_SESSION;
  if (sessionCookie) {
    await page.context().addCookies([
      {
        name: "fluxcore.sid",
        value: sessionCookie,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
  } else {
    // Fall back to the test-session endpoint (only available in NODE_ENV=test)
    const res = await request.post("/api/auth/test-session", {
      data: {
        userId: process.env.TEST_USER_ID ?? "000000000000000001",
        guildId: process.env.TEST_GUILD_ID ?? "000000000000000002",
      },
    });
    expect(res.ok(), "test-session endpoint must return 2xx — is the server running with NODE_ENV=test?").toBeTruthy();
  }

  // Verify we're logged in by hitting the /api/auth/me endpoint
  await page.goto("/");
  await expect(page).not.toHaveURL(/\/login/);

  // Persist the storage state for all subsequent tests
  await page.context().storageState({ path: SESSION_FILE });
});
