/**
 * Landing page — unauthenticated visitor sees the marketing landing.
 * These tests deliberately bypass the saved auth storageState.
 */
import { test, expect } from "@playwright/test";

test.use({ storageState: undefined });

test.describe("Landing page (unauthenticated)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("renders the landing page when not logged in", async ({ page }) => {
    // The LandingPage component is rendered when there is no user session
    await expect(page.locator("body")).toBeVisible();
    // Should not be on a guild page
    await expect(page).not.toHaveURL(/\/guild\//);
  });

  test("shows a login / Discord OAuth link", async ({ page }) => {
    // The landing should contain an anchor pointing to the Discord auth route
    const loginLink = page.locator("a[href*='/api/auth/discord'], a[href*='discord.com/oauth2']");
    await expect(loginLink.first()).toBeVisible();
  });

  test("has no horizontal overflow", async ({ page }) => {
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 2);
  });
});
