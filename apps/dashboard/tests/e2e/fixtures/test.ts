/**
 * Custom Playwright fixture that provides a pre-authenticated page
 * and the GUILD_ID to use throughout specs.
 */
import { test as base, expect, type Page } from "@playwright/test";

export const GUILD_ID = process.env.TEST_GUILD_ID ?? "000000000000000002";

/** Wait for the page's network to settle (no pending /api calls) */
async function waitForApi(page: Page) {
  await page.waitForLoadState("networkidle");
}

type FluxFixtures = {
  guildId: string;
  guildPage: Page;
};

export const test = base.extend<FluxFixtures>({
  guildId: async ({}, use) => {
    await use(GUILD_ID);
  },
  /** A page already navigated to the guild root, API idle */
  guildPage: async ({ page, guildId }, use) => {
    await page.goto(`/guild/${guildId}/overview`);
    await waitForApi(page);
    await use(page);
  },
});

export { expect };

/** Navigate to a guild sub-page and wait for API */
export async function gotoGuildPage(page: Page, guildId: string, subPath: string) {
  await page.goto(`/guild/${guildId}/${subPath}`);
  await page.waitForLoadState("networkidle");
}
