import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: [["list"], ["html", { outputFolder: "tests/e2e/.report", open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    storageState: "tests/e2e/.auth/session.json",
  },
  projects: [
    // Auth setup runs first, produces the session.json used by all other projects
    {
      name: "setup",
      testMatch: "**/setup/auth.setup.ts",
      use: { storageState: undefined },
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
  // NOTE: Start the dev server before running e2e tests:
  //   pnpm dev:dashboard   (or inside Docker: pnpm dev)
  // Then: pnpm test:e2e
});
