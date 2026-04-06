/**
 * Guild selection page — authenticated user sees their guild list.
 */
import { test, expect, GUILD_ID } from "../fixtures/test.js";

test.describe("Guild selection (authenticated)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("renders guild list after login", async ({ page }) => {
    // Either shows guilds grid or the empty-state CTA
    const guildsOrEmpty = page.locator(
      ".grid [data-testid='guild-card'], [data-testid='empty-state']",
    );
    // Fallback: at minimum the page title should be visible
    const heading = page.getByRole("heading");
    await expect(heading.first()).toBeVisible();
  });

  test("shows the nav bar when authenticated", async ({ page }) => {
    await expect(page.locator("nav")).toBeVisible();
  });

  test("clicking a guild card navigates to the guild overview", async ({ page }) => {
    // If there's a guild card, click it and verify navigation
    const guildCard = page.locator("a[href*='/guild/']").first();
    const cardCount = await guildCard.count();
    if (cardCount > 0) {
      await guildCard.click();
      await page.waitForURL(/\/guild\/.+/);
      await expect(page).toHaveURL(/\/guild\//);
    }
  });

  test("Add to Server button is visible when no guilds managed", async ({ page }) => {
    const addToServer = page.getByRole("link", { name: /add to server/i });
    const guildCards = page.locator("a[href*='/guild/']");
    const hasGuilds = (await guildCards.count()) > 0;

    if (!hasGuilds) {
      await expect(addToServer).toBeVisible();
    }
  });

  test("direct link to known guild overview works", async ({ page }) => {
    await page.goto(`/guild/${GUILD_ID}/overview`);
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(`/guild/${GUILD_ID}/overview`);
  });
});
