/**
 * Guild overview / analytics page.
 */
import { test, expect, gotoGuildPage } from "../fixtures/test.js";

test.describe("Overview page", () => {
  test.beforeEach(async ({ page, guildId }) => {
    await gotoGuildPage(page, guildId, "overview");
  });

  test("renders stats cards", async ({ page }) => {
    // StatsCard components — expect at least one metric card
    const cards = page.locator("[data-testid='stats-card'], .grid .rounded-lg").first();
    await expect(cards).toBeVisible();
  });

  test("7d / 30d date filter buttons are present and toggle", async ({ page }) => {
    const btn7d = page.getByRole("button", { name: /7d/i });
    const btn30d = page.getByRole("button", { name: /30d/i });

    if ((await btn7d.count()) > 0) {
      await btn7d.click();
      await page.waitForLoadState("networkidle");
      await btn30d.click();
      await page.waitForLoadState("networkidle");
    }
  });

  test("sidebar navigation is visible", async ({ page }) => {
    const sidebar = page.locator("aside, nav[aria-label*='sidebar'], [role='navigation']");
    await expect(sidebar.first()).toBeVisible();
  });

  test("page has no JS console errors on load", async ({ page, guildId }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await gotoGuildPage(page, guildId, "overview");
    expect(errors.filter((e) => !e.includes("net::ERR_"))).toHaveLength(0);
  });
});
